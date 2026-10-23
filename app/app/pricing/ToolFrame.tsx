"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Lightbulb, Menu, RotateCw } from "lucide-react";

const TIPS_KEY = "pricing:tips";

/** One pricing tool, full height, in an iframe (the tools are self-contained pages). */
export function ToolFrame({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const frame = useRef<HTMLIFrameElement>(null);
  const [armed, setArmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tips, setTips] = useState(true);

  useEffect(() => {
    try {
      setTips(window.localStorage.getItem(TIPS_KEY) !== "0");
    } catch {}
  }, []);

  const sendTips = useCallback((on: boolean) => {
    frame.current?.contentWindow?.postMessage({ pt: "tips", on }, window.location.origin);
  }, []);

  useEffect(() => {
    // The tools' own "Back to Menu" button posts this.
    const onMessage = (e: MessageEvent) => {
      if (e.origin === window.location.origin && e.data && e.data.hadar === "home") router.push("/pricing");
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [router]);

  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), 4000);
    return () => window.clearTimeout(t);
  }, [armed]);

  function reload() {
    if (!armed) return setArmed(true);
    setArmed(false);
    setLoading(true);
    frame.current?.contentWindow?.location.reload();
  }

  function toggleTips() {
    const on = !tips;
    setTips(on);
    try {
      window.localStorage.setItem(TIPS_KEY, on ? "1" : "0");
    } catch {}
    sendTips(on);
  }

  // The app's own mobile top bar is hidden on this page; this opens its menu.
  function openMenu() {
    document.querySelector<HTMLButtonElement>(".hamburger-btn")?.click();
  }

  return (
    <div className="prc-tool">
      <div className="prc-toolbar">
        <button type="button" className="prc-hb prc-menu" aria-label="Open menu" onClick={openMenu}>
          <Menu size={20} strokeWidth={2} />
        </button>
        <Link href="/pricing" className="prc-hb" aria-label="All pricing tools">
          <ArrowLeft size={20} strokeWidth={2} />
        </Link>
        <div className="prc-titles">
          <span className="prc-eyebrow">Pricing</span>
          <span className="prc-title">{armed ? "Tap reload again to confirm" : title}</span>
        </div>
        <button
          type="button"
          className={`prc-hb prc-tips${tips ? " on" : ""}`}
          aria-pressed={tips}
          aria-label={tips ? "Hide help text" : "Show help text"}
          title={tips ? "Hide help text" : "Show help text"}
          onClick={toggleTips}
        >
          <Lightbulb size={18} strokeWidth={2} />
        </button>
        <button
          type="button"
          className={`prc-hb prc-reload${armed ? " armed" : ""}`}
          onClick={reload}
          aria-label="Reload this tool"
          title="Reload this tool (nothing saved is lost)"
        >
          <RotateCw size={18} strokeWidth={2} />
        </button>
      </div>
      <div className="prc-frame-wrap">
        {loading && <div className="prc-loading">Loading {title}…</div>}
        <iframe
          ref={frame}
          src={`/pricing/tool/${id}`}
          title={title}
          className="prc-frame"
          onLoad={() => {
            setLoading(false);
            sendTips(tips);
          }}
        />
      </div>
    </div>
  );
}
