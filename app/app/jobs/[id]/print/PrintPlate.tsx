"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** How much of an A4 sheet each plate gets, in mm. */
const SLOT = {
  full: { w: 190, h: 235 },
  half: { w: 190, h: 115 },
} as const;

/** How large a picture can be drawn inside a slot, as a scale factor. */
function fitScale(imgW: number, imgH: number, slotW: number, slotH: number) {
  return Math.min(slotW / imgW, slotH / imgH);
}

interface Layout {
  /** The picture's own printed size, before any rotation. */
  imgW: number;
  imgH: number;
  /** The space it actually occupies on the page once rotated. */
  frameW: number;
  frameH: number;
  rotate: boolean;
}

/**
 * A picture printed at a fixed share of the page. A wide cut list turned
 * sideways uses far more of an upright sheet than one shrunk to the
 * page's width, and the workshop works off this paper — so the picture is
 * rotated whenever that genuinely prints it bigger, and left upright when
 * it doesn't. Only mildly-wide pictures lose out from turning, which is
 * why this compares both fits rather than rotating anything landscape.
 *
 * Rotation is a paint-only transform: the picture keeps its unrotated
 * layout box and would otherwise overlap whatever sits next to it (the
 * caption, most visibly). Hence the frame, sized to the footprint the
 * turned picture really occupies.
 */
export function PrintPlate({
  file,
  size,
  caption,
}: {
  file: { name: string; url: string };
  size: "half" | "full";
  caption?: string;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [layout, setLayout] = useState<Layout | null>(null);

  const measure = useCallback(
    (img: HTMLImageElement) => {
      const { naturalWidth: w, naturalHeight: h } = img;
      if (!w || !h) return;
      const slot = SLOT[size];
      const upright = fitScale(w, h, slot.w, slot.h);
      const turned = fitScale(h, w, slot.w, slot.h);
      const rotate = turned > upright;
      const scale = rotate ? turned : upright;
      const imgW = w * scale;
      const imgH = h * scale;
      setLayout({ imgW, imgH, frameW: rotate ? imgH : imgW, frameH: rotate ? imgW : imgH, rotate });
    },
    [size]
  );

  // An image served from cache is already complete before React attaches
  // onLoad, so that event never fires and the picture silently prints at
  // its fallback size — measure on mount as well.
  useEffect(() => {
    const img = imgRef.current;
    if (img?.complete) measure(img);
  }, [measure]);

  return (
    <figure className={`print-plate print-plate-${size}`}>
      {caption && <figcaption className="label">{caption}</figcaption>}
      <span
        className="print-plate-frame"
        style={layout ? { width: `${layout.frameW}mm`, height: `${layout.frameH}mm` } : undefined}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={file.url}
          alt={file.name}
          onLoad={(e) => measure(e.currentTarget)}
          style={
            layout
              ? {
                  width: `${layout.imgW}mm`,
                  height: `${layout.imgH}mm`,
                  maxWidth: "none",
                  transform: layout.rotate ? "rotate(90deg)" : undefined,
                }
              : undefined
          }
        />
      </span>
    </figure>
  );
}
