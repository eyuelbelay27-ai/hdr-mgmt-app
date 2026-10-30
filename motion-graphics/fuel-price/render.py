"""Fuel price motion graphic ($2 -> $7) for a vertical TikTok video.

Renders 1080x1920 @ 30fps frames with Pillow and pipes them to ffmpeg.

    python3 render.py                  # dark background -> fuel_price_2_to_7.mp4
    python3 render.py --greenscreen    # chroma-key version -> fuel_price_2_to_7_greenscreen.mp4
    python3 render.py --unit "PER LITER" --start 2 --end 7
"""
import argparse
import math
import random
import subprocess

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H, FPS = 1080, 1920, 30
DURATION = 12.0
FONT_DIR = "/usr/share/fonts/opentype/inter/"

# Timeline (seconds)
T_INTRO_END = 1.0
T_RISE_START = 1.4
T_RISE_END = 8.6
T_STAMP = 8.9

WHITE = (255, 255, 255)
YELLOW = (255, 210, 64)
ORANGE = (255, 130, 30)
RED = (255, 45, 45)


def font(name, size):
    return ImageFont.truetype(FONT_DIR + name, size)


def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def ease_in_out(t):
    t = clamp(t)
    return 3 * t * t - 2 * t * t * t


def ease_out_back(t, s=1.9):
    t = clamp(t) - 1
    return t * t * ((s + 1) * t + s) + 1


def ease_out_cubic(t):
    return 1 - (1 - clamp(t)) ** 3


def lerp(a, b, t):
    return a + (b - a) * t


def lerp_color(c1, c2, t):
    return tuple(int(lerp(a, b, t)) for a, b in zip(c1, c2))


def heat_color(p):
    """White-yellow -> orange -> red as the price climbs."""
    if p < 0.5:
        return lerp_color(YELLOW, ORANGE, p / 0.5)
    return lerp_color(ORANGE, RED, (p - 0.5) / 0.5)


class Scene:
    def __init__(self, start, end, unit, greenscreen):
        self.start, self.end, self.unit = start, end, unit
        self.green = greenscreen
        self.f_title = font("InterDisplay-Black.otf", 104)
        self.f_price = font("InterDisplay-Black.otf", 250)
        self.f_unit = font("Inter-ExtraBold.otf", 46)
        self.f_badge = font("InterDisplay-Black.otf", 72)
        self.f_axis = font("Inter-Bold.otf", 36)
        self.f_head = font("InterDisplay-Black.otf", 44)
        self.f_stamp = font("InterDisplay-Black.otf", 160)
        self.f_tag = font("InterDisplay-ExtraBold.otf", 62)

        # Chart area (kept inside TikTok's safe zone: clear of top bar,
        # caption area at the bottom and the button rail on the right).
        self.cx0, self.cx1 = 150, 900
        self.cy0, self.cy1 = 1100, 1490

        # Price path: eased rise with a few realistic wobbles; exact at both ends.
        n = 400
        ts = np.linspace(0, 1, n)
        base = start + (end - start) * (ts ** 1.35)
        wobble = 0.16 * (end - start) / 5 * np.sin(ts * math.pi * 6.5) * np.sin(ts * math.pi)
        self.path_t = ts
        self.path_v = base + wobble

        if not self.green:
            yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
            g = yy / H
            top, bot = np.array([14, 16, 28]), np.array([4, 5, 10])
            self.bg = (top[None, None, :] * (1 - g[..., None]) + bot[None, None, :] * g[..., None])
            d = np.sqrt(((xx - W / 2) / (W * 0.75)) ** 2 + ((yy - 900) / (H * 0.45)) ** 2)
            self.glow_mask = np.clip(1 - d, 0, 1) ** 2
            # Faint grid lines for texture
            grid = ((xx.astype(int) % 90 == 0) | (yy.astype(int) % 90 == 0)).astype(np.float32)
            self.bg += grid[..., None] * 6

    # ---- helpers -------------------------------------------------------
    def value_at(self, t):
        return float(np.interp(t, self.path_t, self.path_v))

    def chart_xy(self, t, v):
        x = lerp(self.cx0, self.cx1, t)
        y = lerp(self.cy1, self.cy0, (v - self.start) / (self.end - self.start))
        return x, y

    def text_center(self, draw, xy, text, fnt, fill, anchor="mm", **kw):
        draw.text(xy, text, font=fnt, fill=fill, anchor=anchor, **kw)

    # ---- frame ---------------------------------------------------------
    def render(self, t):
        rise = ease_in_out((t - T_RISE_START) / (T_RISE_END - T_RISE_START))
        price = self.value_at(rise) if rise < 1 else float(self.end)
        if rise <= 0:
            price = float(self.start)
        heat = (price - self.start) / (self.end - self.start)
        hot = heat_color(clamp(heat))

        # Background
        if self.green:
            frame = Image.new("RGB", (W, H), (0, 255, 0))
        else:
            pulse = 0.0
            if t > T_STAMP:
                pulse = 0.25 * math.exp(-(t - T_STAMP) * 3)
            intensity = 0.15 + 0.55 * heat + pulse
            red = np.array([200, 20, 10], dtype=np.float32)
            arr = self.bg + self.glow_mask[..., None] * red * intensity
            frame = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))

        fg = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(fg)

        # --- Pump icon + title (intro) ---
        a_in = ease_out_back(t / 0.7)
        self.draw_pump(fg, (W // 2, 285), scale=clamp(a_in, 0, 1.3), color=hot)
        title_y = lerp(500, 440, ease_out_cubic((t - 0.15) / 0.6))
        title_alpha = int(255 * clamp((t - 0.15) / 0.4))
        self.text_center(d, (W // 2, title_y), "FUEL PRICES", self.f_title, WHITE + (title_alpha,))

        # --- Big price counter ---
        if t > 0.5:
            pa = clamp((t - 0.5) / 0.4)
            # little pop each time a whole dollar is crossed
            frac = price - math.floor(price)
            pop = 1 + 0.08 * math.exp(-frac * 14) if self.start < price < self.end and rise > 0 else 1.0
            if t > T_STAMP:
                pop = 1 + 0.06 * math.exp(-(t - T_STAMP) * 5)
            scale = lerp(0.6, 1, ease_out_back(pa)) * pop
            txt = f"${price:0.2f}"
            self.draw_scaled_text(fg, (W // 2, 680), txt, self.f_price, hot + (int(255 * pa),), scale,
                                  glow=not self.green)
            ua = int(255 * pa * 0.85)
            self.text_center(d, (W // 2, 840), self.unit, self.f_unit, (220, 220, 230, ua))

        # --- Change badge (live %), replaced by stamp at the end ---
        pct = (price - self.start) / self.start * 100
        if T_RISE_START - 0.2 < t < T_STAMP:
            ba = clamp((t - (T_RISE_START - 0.2)) / 0.3)
            self.draw_badge(d, (W // 2, 965), f"▲ +{pct:0.0f}%", ba, hot)

        # --- Chart ---
        if t > T_INTRO_END - 0.2:
            self.draw_chart(fg, t, rise, hot)

        # --- Final stamp ---
        if t >= T_STAMP:
            k = (t - T_STAMP) / 0.35
            s = lerp(2.6, 1.0, ease_out_cubic(k))
            sa = int(255 * clamp(k * 1.5))
            total = (self.end - self.start) / self.start * 100
            self.draw_scaled_text(fg, (W // 2, 975), f"+{total:0.0f}%", self.f_stamp, RED + (sa,), s,
                                  glow=not self.green, stroke=(255, 255, 255))
            ta = clamp((t - T_STAMP - 0.5) / 0.4)
            ty = lerp(1610, 1575, ease_out_cubic(ta))
            self.text_center(d, (W // 2, ty), "AND STILL CLIMBING", self.f_tag, (255, 255, 255, int(255 * ta)))

        # Screen shake on the stamp impact
        dx = dy = 0
        if T_STAMP + 0.3 < t < T_STAMP + 0.9:
            amp = 22 * math.exp(-(t - T_STAMP - 0.3) * 6)
            rnd = random.Random(int(t * FPS))
            dx, dy = rnd.uniform(-amp, amp), rnd.uniform(-amp, amp)

        frame = frame.convert("RGBA")
        frame.alpha_composite(fg, (int(dx), int(dy)) if (dx or dy) else (0, 0))

        # White flash on impact (dark version only)
        if not self.green and T_STAMP + 0.3 <= t < T_STAMP + 0.6:
            f = 1 - (t - T_STAMP - 0.3) / 0.3
            flash = Image.new("RGBA", (W, H), (255, 255, 255, int(110 * f)))
            frame.alpha_composite(flash)
        return frame.convert("RGB")

    # ---- elements ------------------------------------------------------
    def draw_scaled_text(self, canvas, center, text, fnt, fill, scale, glow=True, stroke=None):
        tmp = Image.new("RGBA", (1100, 420), (0, 0, 0, 0))
        td = ImageDraw.Draw(tmp)
        kw = {}
        if stroke:
            kw = dict(stroke_width=8, stroke_fill=stroke + (fill[3],))
        td.text((550, 210), text, font=fnt, fill=fill, anchor="mm", **kw)
        if abs(scale - 1) > 1e-3:
            tmp = tmp.resize((max(1, int(1100 * scale)), max(1, int(420 * scale))), Image.LANCZOS)
        x, y = int(center[0] - tmp.width / 2), int(center[1] - tmp.height / 2)
        if glow:
            g = tmp.filter(ImageFilter.GaussianBlur(28))
            canvas.alpha_composite(g, (x, y)) if x >= 0 and y >= 0 else self._paste(canvas, g, x, y)
        self._paste(canvas, tmp, x, y)

    @staticmethod
    def _paste(canvas, img, x, y):
        layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
        layer.paste(img, (x, y))
        canvas.alpha_composite(layer)

    def draw_badge(self, d, center, text, alpha, color):
        bbox = d.textbbox(center, text, font=self.f_badge, anchor="mm")
        pad_x, pad_y = 38, 18
        box = (bbox[0] - pad_x, bbox[1] - pad_y, bbox[2] + pad_x, bbox[3] + pad_y)
        d.rounded_rectangle(box, radius=(box[3] - box[1]) // 2, fill=color + (int(235 * alpha),))
        d.text(center, text, font=self.f_badge, fill=(15, 10, 10, int(255 * alpha)), anchor="mm")

    def draw_pump(self, canvas, center, scale, color):
        if scale <= 0.01:
            return
        S = 2  # supersample
        size = 220
        img = Image.new("RGBA", (size * S, size * S), (0, 0, 0, 0))
        g = ImageDraw.Draw(img)
        c = color + (255,)
        s = lambda *v: [x * S for x in v]
        g.rounded_rectangle(s(40, 30, 140, 200), radius=14 * S, fill=c)          # body
        g.rounded_rectangle(s(58, 50, 122, 100), radius=8 * S, fill=(20, 20, 30, 255))  # window
        g.rectangle(s(28, 192, 152, 208), fill=c)                                # base
        g.line(s(140, 70, 172, 70), fill=c, width=12 * S)                        # hose arm
        g.line(s(172, 64, 172, 160), fill=c, width=12 * S)
        g.arc(s(150, 140, 194, 184), 0, 180, fill=c, width=12 * S)
        g.line(s(150, 162, 150, 120), fill=c, width=12 * S)
        g.polygon(s(140, 108, 162, 108, 156, 128, 144, 128), fill=c)             # nozzle
        img = img.resize((int(size * scale), int(size * scale)), Image.LANCZOS)
        self._paste(canvas, img, int(center[0] - img.width / 2), int(center[1] - img.height / 2))

    def draw_chart(self, canvas, t, rise, hot):
        S = 2
        appear = clamp((t - (T_INTRO_END - 0.2)) / 0.5)
        layer = Image.new("RGBA", (W * S, H * S), (0, 0, 0, 0))
        g = ImageDraw.Draw(layer)
        P = lambda x, y: (x * S, y * S)
        axis_a = int(150 * appear)

        # Gridlines + y labels for each whole dollar
        for v in range(int(self.start), int(self.end) + 1):
            x0, y = self.chart_xy(0, v)
            g.line([P(self.cx0, y), P(self.cx1, y)], fill=(255, 255, 255, int(axis_a * 0.35)), width=2 * S)
        g.line([P(self.cx0, self.cy0 - 20), P(self.cx0, self.cy1)], fill=(255, 255, 255, axis_a), width=3 * S)
        g.line([P(self.cx0, self.cy1), P(self.cx1 + 20, self.cy1)], fill=(255, 255, 255, axis_a), width=3 * S)

        pts = []
        if rise > 0:
            m = max(2, int(rise * (len(self.path_t) - 1)) + 1)
            for i in range(m):
                pts.append(self.chart_xy(self.path_t[i], self.path_v[i]))
            pts[-1] = self.chart_xy(rise, self.value_at(rise))
            # Area fill under the line
            poly = [P(*p) for p in pts] + [P(pts[-1][0], self.cy1), P(pts[0][0], self.cy1)]
            g.polygon(poly, fill=lerp_color(hot, (90, 0, 0), 0.6) + (255,) if self.green else hot + (55,))
            g.line([P(*p) for p in pts], fill=hot + (255,), width=10 * S, joint="curve")

        layer = layer.resize((W, H), Image.LANCZOS)
        if not self.green and pts:
            glow = layer.filter(ImageFilter.GaussianBlur(16))
            canvas.alpha_composite(glow)
        canvas.alpha_composite(layer)

        d = ImageDraw.Draw(canvas)
        la = int(230 * appear)
        for v in range(int(self.start), int(self.end) + 1):
            _, y = self.chart_xy(0, v)
            d.text((self.cx0 - 18, y), f"${v}", font=self.f_axis, fill=(230, 230, 240, la), anchor="rm")

        # Glowing head dot
        if pts:
            hx, hy = pts[-1]
            r = 16 + 3 * math.sin(t * 12)
            if not self.green:
                d.ellipse((hx - r * 2, hy - r * 2, hx + r * 2, hy + r * 2), fill=hot + (60,))
            d.ellipse((hx - r, hy - r, hx + r, hy + r), fill=(255, 255, 255, 255), outline=hot + (255,), width=6)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--greenscreen", action="store_true")
    ap.add_argument("--start", type=float, default=2.0)
    ap.add_argument("--end", type=float, default=7.0)
    ap.add_argument("--unit", default="PER GALLON")
    ap.add_argument("--out")
    ap.add_argument("--still", type=float, help="render a single PNG at this time (seconds)")
    args = ap.parse_args()

    scene = Scene(args.start, args.end, args.unit, args.greenscreen)
    if args.still is not None:
        scene.render(args.still).save(args.out or f"still_{args.still:.1f}.png")
        return

    out = args.out or ("fuel_price_2_to_7_greenscreen.mp4" if args.greenscreen else "fuel_price_2_to_7.mp4")
    proc = subprocess.Popen(
        ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
         "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
         "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p",
         "-movflags", "+faststart", out],
        stdin=subprocess.PIPE,
    )
    for i in range(int(DURATION * FPS)):
        proc.stdin.write(scene.render(i / FPS).tobytes())
    proc.stdin.close()
    proc.wait()
    print("wrote", out)


if __name__ == "__main__":
    main()
