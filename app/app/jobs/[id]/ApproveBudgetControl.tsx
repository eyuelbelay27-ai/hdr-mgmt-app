"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { approveBudgetAction } from "./budgetActions";
import type { ApprovalPlan } from "@/lib/workshop/store";

/**
 * The exact same control renders at both entry points (header shortcut and
 * Budget tab button — Section 6.1) so they behave identically. Approving
 * requires scheduling the job: the button opens the Workshop Schedule right
 * here, in its approval mode (deadline → production days → installation
 * days); its last step, "Approve budget", approves with that deadline and
 * puts the days on the shared schedule. A blank budget still can't be
 * approved — re-checked server-side in approveBudgetAction.
 */
export function ApproveBudgetControl({ jobId, hasBudgetItems }: { jobId: string; hasBudgetItems: boolean }) {
  const router = useRouter();
  const frame = useRef<HTMLIFrameElement>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hint, setHint] = useState(false);

  useEffect(() => {
    if (!open) return;
    const reply = (error: string | null) =>
      frame.current?.contentWindow?.postMessage({ ws: "approve-result", error }, window.location.origin);
    const onMessage = async (e: MessageEvent) => {
      if (e.origin !== window.location.origin || !e.data || e.source !== frame.current?.contentWindow) return;
      if (e.data.ws === "cancel") setOpen(false);
      if (e.data.ws === "approve") {
        try {
          const res = await approveBudgetAction(jobId, e.data.plan as ApprovalPlan);
          if (res.error) return reply(res.error);
          setOpen(false);
          router.refresh();
        } catch {
          reply("Could not approve. Check the connection and try again.");
        }
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("message", onMessage);
    window.addEventListener("keydown", onKey);
    document.documentElement.style.overflow = "hidden";
    return () => {
      window.removeEventListener("message", onMessage);
      window.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = "";
    };
  }, [open, jobId, router]);

  return (
    <>
      <button
        className="btn btn-primary btn-sm"
        type="button"
        onClick={() => {
          if (!hasBudgetItems) return setHint(true);
          setLoading(true);
          setOpen(true);
        }}
      >
        Approve Budget & Move to Implementation
      </button>
      {hint && !hasBudgetItems && <span className="label">Add at least one budget item before approving.</span>}
      {open && (
        <div className="ws-approve" role="dialog" aria-modal="true" aria-label="Schedule and approve">
          <div className="ws-approve-box">
            {loading && <div className="prc-loading">Opening the Workshop Schedule…</div>}
            <iframe
              ref={frame}
              src={`/workshop/app?approve=${encodeURIComponent(jobId)}`}
              title="Schedule and approve"
              className="prc-frame"
              onLoad={() => setLoading(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}
