"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { UserRound, Camera, CheckCircle2, XCircle, ArrowLeft } from "lucide-react";
import { submitKioskCaptureAction, type KioskEmployee } from "../actions";
import { loadFaceModels, analyzeFrame, BlinkDetector } from "./faceEngine";

type Screen = "loading" | "cameraError" | "select" | "capture" | "submitting" | "result";

const DETECT_INTERVAL_MS = 150;
const BLINK_TIMEOUT_MS = 20000;

function formatClock(d: Date): string {
  const hh = d.getHours();
  const mm = String(d.getMinutes()).padStart(2, "0");
  const period = hh >= 12 ? "PM" : "AM";
  const hour12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${hour12}:${mm} ${period}`;
}

export function KioskScreen({ initialEmployees }: { initialEmployees: KioskEmployee[] }) {
  const [screen, setScreen] = useState<Screen>("loading");
  const [employees, setEmployees] = useState(initialEmployees);
  const [selected, setSelected] = useState<KioskEmployee | null>(null);
  const [prompt, setPrompt] = useState("Center your face in the frame");
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const loopRef = useRef<number | null>(null);
  const blinkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blinkDetectorRef = useRef(new BlinkDetector());
  const busyRef = useRef(false);

  // Camera + models start once, on mount, and the stream is kept alive for
  // the lifetime of this always-on kiosk screen — see the plan's "full-
  // screen, always-on view" requirement.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [, stream] = await Promise.all([
          loadFaceModels(),
          navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false }),
        ]);
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setScreen("select");
      } catch {
        if (!cancelled) setScreen("cameraError");
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopLoop = useCallback(() => {
    if (loopRef.current) window.clearTimeout(loopRef.current);
    if (blinkTimeoutRef.current) clearTimeout(blinkTimeoutRef.current);
    loopRef.current = null;
    blinkTimeoutRef.current = null;
  }, []);

  const captureFramePhoto = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return resolve(null);
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(null);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.85);
    });
  }, []);

  const submit = useCallback(
    async (employee: KioskEmployee, descriptor: Float32Array) => {
      busyRef.current = true;
      stopLoop();
      setScreen("submitting");

      const photoBlob = await captureFramePhoto();
      if (!photoBlob) {
        setResult({ ok: false, message: "Capture failed. Try again." });
        setScreen("result");
        busyRef.current = false;
        return;
      }

      const formData = new FormData();
      formData.set("userId", employee.id);
      formData.set("descriptor", JSON.stringify(Array.from(descriptor)));
      formData.set("livenessPassed", "true");
      formData.set("photo", new File([photoBlob], "capture.jpg", { type: "image/jpeg" }));

      const res = await submitKioskCaptureAction(formData);
      busyRef.current = false;

      if (res.error) {
        setResult({ ok: false, message: res.error });
        setScreen("result");
        return;
      }

      const when = res.at ? formatClock(new Date(res.at)) : "";
      const message =
        res.action === "registered"
          ? `Welcome, ${employee.name}! You're registered and checked in at ${when}.`
          : res.action === "checkedOut"
            ? `See you later, ${employee.name}! Checked out at ${when}.`
            : `Checked in, ${employee.name}! ${when}.`;
      setResult({ ok: true, message });
      setScreen("result");

      // Reflect the fresh state on that employee's tile right away — no
      // page reload needed to see "Checked in" / "Done for today".
      const at = res.at ? new Date(res.at) : new Date();
      setEmployees((prev) =>
        prev.map((e) =>
          e.id !== employee.id
            ? e
            : res.action === "checkedOut"
              ? { ...e, checkedOutAt: at }
              : { ...e, checkedInAt: at }
        )
      );
    },
    [captureFramePhoto, stopLoop]
  );

  const runDetectLoop = useCallback(
    (employee: KioskEmployee) => {
      blinkDetectorRef.current = new BlinkDetector();
      setPrompt("Center your face in the frame");

      blinkTimeoutRef.current = setTimeout(() => {
        stopLoop();
        setResult({ ok: false, message: "Didn't detect a blink in time. Tap Try Again." });
        setScreen("result");
      }, BLINK_TIMEOUT_MS);

      const tick = async () => {
        if (busyRef.current || !videoRef.current) return;
        const frame = await analyzeFrame(videoRef.current);
        if (!frame) {
          setPrompt("Center your face in the frame");
        } else {
          setPrompt("Now blink for the camera");
          const blinked = blinkDetectorRef.current.push(frame.ear);
          if (blinked) {
            await submit(employee, frame.descriptor);
            return;
          }
        }
        loopRef.current = window.setTimeout(tick, DETECT_INTERVAL_MS);
      };
      loopRef.current = window.setTimeout(tick, DETECT_INTERVAL_MS);
    },
    [stopLoop, submit]
  );

  const handleSelect = (employee: KioskEmployee) => {
    setSelected(employee);
    setResult(null);
    setScreen("capture");
    runDetectLoop(employee);
  };

  const handleCancel = () => {
    stopLoop();
    setSelected(null);
    setScreen("select");
  };

  const handleTryAgain = () => {
    if (!selected) {
      setScreen("select");
      return;
    }
    setResult(null);
    setScreen("capture");
    runDetectLoop(selected);
  };

  const handleDone = () => {
    stopLoop();
    setSelected(null);
    setResult(null);
    setScreen("select");
  };

  if (screen === "loading") {
    return (
      <div className="kiosk-root kiosk-center">
        <Camera size={40} strokeWidth={1.5} />
        <p>Starting camera…</p>
      </div>
    );
  }

  if (screen === "cameraError") {
    return (
      <div className="kiosk-root kiosk-center">
        <XCircle size={48} strokeWidth={1.5} color="var(--danger)" />
        <p>Couldn&apos;t access the camera. Check the browser&apos;s camera permission for this page and reload.</p>
      </div>
    );
  }

  return (
    <div className="kiosk-root">
      {/* Video always mounted (camera stream stays open) — hidden off-screen
          outside capture so the ref/stream never has to be torn down and
          re-created between employees. */}
      <div className={screen === "capture" || screen === "submitting" ? "kiosk-video-wrap" : "kiosk-video-hidden"}>
        <video ref={videoRef} muted playsInline className="kiosk-video" />
        <canvas ref={canvasRef} style={{ display: "none" }} />
      </div>

      {screen === "select" && (
        <div className="kiosk-select">
          <h1>Hadar Attendance</h1>
          <p className="label">Tap your name to check in or out.</p>
          <div className="kiosk-grid">
            {employees.map((e) => (
              <button key={e.id} type="button" className="kiosk-employee-btn" onClick={() => handleSelect(e)}>
                <UserRound size={28} strokeWidth={1.5} />
                <span>{e.name}</span>
                {e.checkedInAt && !e.checkedOutAt && <span className="kiosk-status-pill">Checked in</span>}
                {e.checkedInAt && e.checkedOutAt && <span className="kiosk-status-pill kiosk-status-done">Done for today</span>}
              </button>
            ))}
            {employees.length === 0 && <p className="label">No active employees on file.</p>}
          </div>
        </div>
      )}

      {(screen === "capture" || screen === "submitting") && (
        <div className="kiosk-capture-overlay">
          <h2>{selected?.name}</h2>
          <p>{screen === "submitting" ? "Checking…" : prompt}</p>
          <button type="button" className="btn btn-ghost" onClick={handleCancel} disabled={screen === "submitting"}>
            <ArrowLeft size={15} strokeWidth={1.75} /> Cancel
          </button>
        </div>
      )}

      {screen === "result" && result && (
        <div className="kiosk-root kiosk-center">
          {result.ok ? (
            <CheckCircle2 size={56} strokeWidth={1.5} color="var(--success)" />
          ) : (
            <XCircle size={56} strokeWidth={1.5} color="var(--danger)" />
          )}
          <p style={{ fontSize: 20, maxWidth: 480 }}>{result.message}</p>
          {result.ok ? (
            <button type="button" className="btn btn-primary" onClick={handleDone}>
              Done
            </button>
          ) : (
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" className="btn btn-primary" onClick={handleTryAgain}>
                Try Again
              </button>
              <button type="button" className="btn btn-ghost" onClick={handleDone}>
                Back to Names
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
