"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, RotateCw } from "lucide-react";

/** One pricing tool, full height, in an iframe (the tools are self-contained pages). */
export function ToolFrame({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const frame = useRef<HTMLIFrameElement>(null);
  const [armed, setArmed] = useState(false);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="prc-tool">
      <div className="prc-toolbar">
        <Link href="/pricing" className="btn btn-ghost btn-sm prc-back" aria-label="All pricing tools">
          <ChevronLeft size={18} strokeWidth={2} /> <span className="prc-long">Pricing</span>
        </Link>
        <div className="prc-title font-display">{title}</div>
        <button
          type="button"
          className={`btn btn-sm ${armed ? "btn-primary" : "btn-ghost"}`}
          onClick={reload}
          title="Reload this tool (clears nothing that's saved)"
        >
          <RotateCw size={15} strokeWidth={2} /> <span className={armed ? "" : "prc-long"}>{armed ? "Tap again" : "Reload"}</span>
        </button>
      </div>
      <div className="prc-frame-wrap">
        {loading && <div className="prc-loading">Loading {title}…</div>}
        <iframe ref={frame} src={`/pricing/tool/${id}`} title={title} className="prc-frame" onLoad={() => setLoading(false)} />
      </div>
    </div>
  );
}
