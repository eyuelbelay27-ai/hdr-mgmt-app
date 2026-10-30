"use client";

import { useEffect, useState } from "react";

/** The Workshop Schedule page, full height, in an iframe (it is a self-contained page). */
export function WorkshopFrame() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // The schedule's own menu button (phones) opens the app's side menu.
    const onMessage = (e: MessageEvent) => {
      if (e.origin === window.location.origin && e.data && e.data.ws === "menu") {
        document.querySelector<HTMLButtonElement>(".hamburger-btn")?.click();
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <div className="prc-tool">
      <div className="prc-frame-wrap">
        {loading && <div className="prc-loading">Loading the Workshop Schedule…</div>}
        <iframe src="/workshop/app" title="Workshop Schedule" className="prc-frame" onLoad={() => setLoading(false)} />
      </div>
    </div>
  );
}
