"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { lockAdminAction } from "./actions";

/**
 * "Ask the PIN every time Admin is opened." The flag below lives in this
 * module, so it survives in-app tab switches (client navigation) but is
 * reset by any full page load — a reload, a fresh visit, coming back from
 * another page. On such a load the admin side locks itself before showing
 * anything; closing, reloading or leaving the page also sends a lock.
 */
let unlockedThisPage = false;

export function markUnlocked() {
  unlockedThisPage = true;
}

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ok] = useState(() => unlockedThisPage);

  useEffect(() => {
    if (!ok) {
      void lockAdminAction().then(() => router.refresh());
      return;
    }
    const lock = () => navigator.sendBeacon("/api/pulseclock/lock");
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) window.location.reload(); // restored from back/forward cache
    };
    window.addEventListener("pagehide", lock);
    window.addEventListener("pageshow", onShow);
    return () => {
      window.removeEventListener("pagehide", lock);
      window.removeEventListener("pageshow", onShow);
    };
  }, [ok, router]);

  if (!ok) return <div className="pc-loginwrap"><p className="pc-sub">Locking…</p></div>;
  return <>{children}</>;
}
