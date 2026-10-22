"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, RotateCw } from "lucide-react";

/** One pricing tool, full height, in an iframe (the tools are self-contained pages). */
export function ToolFrame({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const frame = useRef<HTMLIFrameElement>(null);
  const [armed, setArmed] = useState(false);

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
    frame.current?.contentWindow?.location.reload();
  }

  return (
    <div className="prc-tool">
      <div className="prc-toolbar">
        <Link href="/pricing" className="prc-tb-btn">
          <ArrowLeft size={15} /> <span className="prc-long">All tools</span>
        </Link>
        <div className="prc-title">{title}</div>
        <button type="button" className={`prc-tb-btn${armed ? " armed" : ""}`} onClick={reload} title="Reload this tool">
          <RotateCw size={14} /> <span className="prc-long">{armed ? "Click again to reload" : "Reload"}</span>
        </button>
      </div>
      <iframe ref={frame} src={`/pricing/tool/${id}`} title={title} className="prc-frame" />
    </div>
  );
}
