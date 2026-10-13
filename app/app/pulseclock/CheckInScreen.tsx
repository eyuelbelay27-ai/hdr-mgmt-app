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
        <p>Choose your name, look at the camera and blink once.</p>
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

const DETECT_INTERVAL_MS = 150;
const BLINK_TIMEOUT_MS = 25000;

function CaptureModal({ mode, employees, onClose }: { mode: Mode; employees: CheckInEmployee[]; onClose: () => void }) {
  const router = useRouter();
  const [employeeId, setEmployeeId] = useState("");
  const [phase, setPhase] = useState<Phase>("pick");
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const loopRef = useRef<number | null>(null);
  const deadlineRef = useRef(0);
  const activeRef = useRef(true);

  const employee = employees.find((e) => e.id === employeeId) ?? null;

  const stop = useCallback(() => {
    if (loopRef.current) window.clearTimeout(loopRef.current);
    loopRef.current = null;
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

  async function submit(emp: CheckInEmployee, descriptor: Float32Array) {
    setPhase("sending");
    const fd = new FormData();
    fd.set("employeeId", emp.id);
    fd.set("action", mode);
    fd.set("descriptor", JSON.stringify(Array.from(descriptor)));
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
    setPhase("loading");
    setPrompt("Starting camera…");
    let engine: typeof import("./faceEngine");
    try {
      // face-api needs browser globals, so it's loaded only when the camera starts.
      engine = await import("./faceEngine");
      const [, stream] = await Promise.all([
        engine.loadFaceModels(),
        navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false }),
      ]);
      if (!activeRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch {
      stop();
      setPhase("cameraError");
      return;
    }
    setPhase("scan");
    setPrompt("Center your face in the frame");
    const blink = new engine.BlinkDetector();
    deadlineRef.current = Date.now() + BLINK_TIMEOUT_MS;
    const emp = employee;

    const tick = async () => {
      if (!activeRef.current || !videoRef.current) return;
      if (Date.now() > deadlineRef.current) return finish(false, "No blink detected. Try again in good light.");
      const frame = await engine.analyzeFrame(videoRef.current).catch(() => null);
      if (!frame) {
        setPrompt("Center your face in the frame");
      } else {
        setPrompt("Now blink once");
        if (blink.push(frame.ear)) return submit(emp, frame.descriptor);
      }
      loopRef.current = window.setTimeout(tick, DETECT_INTERVAL_MS);
    };
    loopRef.current = window.setTimeout(tick, DETECT_INTERVAL_MS);
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
