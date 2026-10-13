"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { formatEthiopianDate, toEthiopian } from "@/lib/payroll/ethiopian";
import { pulseCaptureAction } from "./actions";

export interface CheckInEmployee {
  id: string;
  name: string;
  role: string | null;
  enrolled: boolean;
  checkedIn: string | null;
  checkedOut: string | null;
}

type Mode = "check-in" | "check-out";

const ADDIS_OFFSET_MS = 3 * 60 * 60 * 1000;
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function addisNow() {
  const a = new Date(Date.now() + ADDIS_OFFSET_MS);
  const h = a.getUTCHours();
  const m = a.getUTCMinutes();
  const s = a.getUTCSeconds();
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    hour: h,
    time: `${h % 12 === 0 ? 12 : h % 12}:${pad(m)}:${pad(s)} ${h >= 12 ? "PM" : "AM"}`,
    date: `${WEEKDAYS[a.getUTCDay()]}, ${formatEthiopianDate(toEthiopian(a))}`,
  };
}

function useAddisClock() {
  const [now, setNow] = useState<ReturnType<typeof addisNow> | null>(null);
  useEffect(() => {
    setNow(addisNow());
    const t = window.setInterval(() => setNow(addisNow()), 1000);
    return () => window.clearInterval(t);
  }, []);
  return now;
}

export function CheckInScreen({
  employees,
  stats,
  dayNote,
  shiftLabel,
  lateAfter,
}: {
  employees: CheckInEmployee[];
  stats: { present: number; late: number; onLeave: number; total: number };
  dayNote: string | null;
  shiftLabel: string;
  lateAfter: string;
}) {
  const now = useAddisClock();
  const [mode, setMode] = useState<Mode | null>(null);
  const greeting = !now ? "Hello" : now.hour < 12 ? "Good morning" : now.hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="pc-kiosk">
      <div className="pc-hero">
        <div className="pc-eyebrow"><span className="pc-dot" />Face-verified attendance</div>
        <h1>{greeting}.</h1>
        <p>Choose your name, look at the camera and blink slowly.</p>
        <div className="pc-clock" aria-live="off">
          <b suppressHydrationWarning>{now?.time ?? "—"}</b>
          <small suppressHydrationWarning>{now?.date ?? ""}</small>
        </div>
      </div>

      {dayNote && <p className="pc-error" style={{ textAlign: "center", marginTop: -18, marginBottom: 18 }}>{dayNote}</p>}

      <div className="pc-actions">
        <button type="button" className="pc-action pc-in" onClick={() => setMode("check-in")}>
          <span className="pc-aicon" aria-hidden>→</span>
          <span>
            <small>Starting work</small>
            <strong>Check in</strong>
            <em>Late after {lateAfter}</em>
          </span>
          <span className="pc-arrow" aria-hidden>↗</span>
        </button>
        <button type="button" className="pc-action pc-out" onClick={() => setMode("check-out")}>
          <span className="pc-aicon" aria-hidden>←</span>
          <span>
            <small>Finishing work</small>
            <strong>Check out</strong>
            <em>Shift {shiftLabel}</em>
          </span>
          <span className="pc-arrow" aria-hidden>↘</span>
        </button>
      </div>

      <div className="pc-below">
        <div className="pc-card">
          <div className="pc-cardhead">
            <b>Today at a glance</b>
            <span className="pc-pill pc-good">{stats.total} employees</span>
          </div>
          <div className="pc-stats">
            <span><b>{stats.present}</b><small>Checked in</small></span>
            <span><b>{stats.late}</b><small>Late</small></span>
            <span><b>{stats.onLeave}</b><small>On leave</small></span>
          </div>
        </div>
        <div className="pc-card pc-privacy">
          <i aria-hidden>🔒</i>
          <div>
            <b>Your privacy</b>
            <p>
              Your face is compared on the server against the photo taken at your first check-in. No photo is kept
              from later check-ins.
            </p>
          </div>
        </div>
      </div>

      {mode && <CaptureModal mode={mode} employees={employees} onClose={() => setMode(null)} />}
    </div>
  );
}

type Phase = "pick" | "loading" | "scan" | "sending" | "done" | "cameraError";

const BLINK_TIMEOUT_MS = 30000;
const VERIFY_FRAMES = 5;
const VERIFY_MAX_TRIES = 25;
/** Average anti-spoof / liveness score needed (0..1, Human's own scale). */
const MIN_REAL = 0.5;

function CaptureModal({ mode, employees, onClose }: { mode: Mode; employees: CheckInEmployee[]; onClose: () => void }) {
  const router = useRouter();
  const [employeeId, setEmployeeId] = useState("");
  const [phase, setPhase] = useState<Phase>("pick");
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const runRef = useRef(0); // bumps on stop/close so a running loop exits
  const activeRef = useRef(true);

  const employee = employees.find((e) => e.id === employeeId) ?? null;

  const stop = useCallback(() => {
    runRef.current++;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
      stop();
    };
  }, [stop]);

  function close() {
    stop();
    onClose();
  }

  function finish(ok: boolean, message: string) {
    stop();
    setResult({ ok, message });
    setPhase("done");
    if (ok) router.refresh();
  }

  function capturePhoto(): Promise<Blob | null> {
    return new Promise((resolve) => {
      const video = videoRef.current;
      if (!video || !video.videoWidth) return resolve(null);
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(null);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.85);
    });
  }

  async function submit(emp: CheckInEmployee, descriptor: number[]) {
    setPhase("sending");
    const fd = new FormData();
    fd.set("employeeId", emp.id);
    fd.set("action", mode);
    fd.set("descriptor", JSON.stringify(descriptor));
    fd.set("livenessPassed", "true");
    if (!emp.enrolled) {
      const photo = await capturePhoto();
      if (!photo) return finish(false, "Capture failed. Try again.");
      fd.set("photo", new File([photo], "reference.jpg", { type: "image/jpeg" }));
    }
    stop();
    try {
      const res = await pulseCaptureAction(fd);
      if (!activeRef.current) return;
      if (res.error) return finish(false, res.error);
      const at = res.at ? new Date(res.at) : new Date();
      const a = new Date(at.getTime() + ADDIS_OFFSET_MS);
      const h = a.getUTCHours();
      const when = `${h % 12 === 0 ? 12 : h % 12}:${String(a.getUTCMinutes()).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
      const first = emp.name.split(" ")[0];
      finish(
        true,
        res.outcome === "registered"
          ? `Welcome, ${first}! Your face is registered and you're checked in at ${when}.`
          : res.outcome === "checkedOut"
            ? `See you tomorrow, ${first}. Checked out at ${when}.`
            : `Checked in, ${first}. ${when}.`
      );
    } catch {
      if (activeRef.current) finish(false, "Couldn't reach the server. Check the connection and try again.");
    }
  }

  async function start() {
    if (!employee) return;
    const emp = employee;
    const run = ++runRef.current;
    const alive = () => activeRef.current && runRef.current === run;
    setPhase("loading");
    setPrompt("Loading face recognition… (first time can take a moment)");

    let engine: typeof import("./faceEngine");
    let human: Awaited<ReturnType<typeof engine.loadFaceEngine>>;
    try {
      // Browser-only; loaded when the camera starts.
      engine = await import("./faceEngine");
      const [h, stream] = await Promise.all([
        engine.loadFaceEngine(),
        navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        }),
      ]);
      human = h;
      if (!alive()) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (err) {
      if (!alive()) return;
      stop();
      if (err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "NotFoundError")) {
        setPhase("cameraError");
      } else {
        finish(false, "Face recognition couldn't start on this device. Reload the page and try again.");
      }
      return;
    }

    setPhase("scan");
    const video = videoRef.current!;
    const blink = new engine.BlinkDetector();
    const deadline = Date.now() + BLINK_TIMEOUT_MS;
    const guide: Record<string, string> = {
      none: "Center your face in the frame",
      many: "Only one person in the frame, please",
      small: "Move a little closer",
    };

    // 1. Liveness: wait for a real blink (fast, light model set).
    for (;;) {
      if (!alive()) return;
      if (Date.now() > deadline) return finish(false, "No blink was seen. Face the camera in good light and blink slowly, closing your eyes for a moment.");
      const f = await engine.lightFrame(human, video).catch(() => ({ kind: "none" as const }));
      if (!alive()) return;
      if (f.kind !== "face") {
        setPrompt(guide[f.kind]);
      } else {
        setPrompt(blink.ready ? "Now blink slowly" : "Hold still…");
        if (blink.push(f.openness)) break;
      }
      await new Promise((r) => requestAnimationFrame(r));
    }

    // 2. Identity: several open-eye frames, averaged; plus anti-spoof checks.
    setPrompt("Keep looking at the camera…");
    const embeddings: number[][] = [];
    let real = 0;
    let live = 0;
    for (let tries = 0; tries < VERIFY_MAX_TRIES && embeddings.length < VERIFY_FRAMES; tries++) {
      if (!alive()) return;
      const f = await engine.fullFrame(human, video).catch(() => ({ kind: "none" as const }));
      if (!alive()) return;
      if (f.kind !== "face") {
        setPrompt(guide[f.kind]);
        continue;
      }
      const e = f.face.embedding;
      if (!e || e.length !== 1024 || !blink.isOpen(f.openness)) continue;
      embeddings.push(Array.from(e));
      real += f.face.real ?? 0;
      live += f.face.live ?? 0;
    }
    if (embeddings.length < VERIFY_FRAMES) {
      return finish(false, "Couldn't get a clear look at your face. Hold the phone steady at eye level and try again.");
    }
    if (real / embeddings.length < MIN_REAL || live / embeddings.length < MIN_REAL) {
      return finish(false, "Couldn't confirm a live face. Use good light and look straight at the camera. Photos and screens aren't accepted.");
    }
    await submit(emp, engine.averageEmbedding(embeddings));
  }

  function retry() {
    setResult(null);
    setPhase("pick");
  }

  const showCamera = phase === "loading" || phase === "scan" || phase === "sending";

  return (
    <div className="pc-backdrop" role="dialog" aria-modal="true" aria-label={mode === "check-in" ? "Check in" : "Check out"}>
      <div className="pc-modal">
        <button type="button" className="pc-close" aria-label="Close" onClick={close}>
          <X size={18} />
        </button>
        <div className="pc-modalcopy">
          <div className="pc-eyebrow">{mode === "check-in" ? "Check in" : "Check out"}</div>
          <h2>{phase === "done" ? (result?.ok ? "All set" : "Not recorded") : "Verify your face"}</h2>
          <p>
            {phase === "pick" && "Pick your name, then look straight at the camera."}
            {showCamera && (phase === "sending" ? "Checking…" : prompt)}
            {phase === "cameraError" && "The camera couldn't start. Allow camera access for this site in your browser settings."}
            {phase === "done" && result?.message}
          </p>
        </div>

        <div className="pc-camera" style={{ display: phase === "pick" ? "none" : undefined }}>
          <video ref={videoRef} playsInline muted style={{ display: showCamera ? undefined : "none" }} />
          {showCamera && <span className="pc-face" />}
          {phase === "scan" && <span className="pc-scanline" />}
          {phase === "done" && <span className={`pc-result ${result?.ok ? "ok" : "no"}`}>{result?.ok ? "✓" : "!"}</span>}
          {phase === "cameraError" && (
            <div className="pc-camempty">
              <span style={{ fontSize: 30 }}>📷</span>
              Camera unavailable
            </div>
          )}
        </div>

        {phase === "pick" && (
          <div className="pc-stack">
            {employees.length === 0 ? (
              <p className="pc-empty">No employees yet. An admin adds them under Admin → Employees.</p>
            ) : (
              <label className="pc-field">
                Your name
                <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
                  <option value="">Choose…</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                      {e.checkedOut ? ` — out ${e.checkedOut}` : e.checkedIn ? ` — in ${e.checkedIn}` : ""}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {employee && !employee.enrolled && mode === "check-in" && (
              <p className="pc-sub">First check-in: this capture becomes your reference photo.</p>
            )}
            <button type="button" className="pc-button pc-primary pc-full" disabled={!employee} onClick={start}>
              Start camera
            </button>
          </div>
        )}

        {(phase === "done" || phase === "cameraError") && (
          <div className="pc-stack" style={{ marginTop: 14 }}>
            {!result?.ok && (
              <button type="button" className="pc-button pc-primary pc-full" onClick={retry}>
                Try again
              </button>
            )}
            <button type="button" className="pc-button pc-secondary pc-full" onClick={close}>
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
