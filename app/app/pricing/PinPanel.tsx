"use client";

import { useState } from "react";

async function savePin(body: Record<string, string>): Promise<{ ok: boolean; error?: string }> {
  try {
    const r = await fetch("/api/pricing/pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return await r.json();
  } catch {
    return { ok: false, error: "Could not reach the server." };
  }
}

/**
 * The shared Pricing PIN that protects every tool's Settings. The first PIN
 * is set by an app admin; after that it changes only with the current PIN.
 */
export function PinPanel({ pinSet, isAppAdmin }: { pinSet: boolean; isAppAdmin: boolean }) {
  const [hasPin, setHasPin] = useState(pinSet);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setBusy(true);
    const res = await savePin({
      current: String(fd.get("current") ?? ""),
      pin: String(fd.get("pin") ?? ""),
      confirm: String(fd.get("confirm") ?? ""),
    });
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: res.error ?? "Could not save the PIN." });
    form.reset();
    setMsg({ ok: true, text: hasPin ? "PIN changed for all pricing tools." : "PIN created. Settings in every tool now ask for it." });
    setHasPin(true);
    setOpen(false);
  }

  const fields = (withCurrent: boolean) => (
    <form className="prc-pinform" onSubmit={submit} autoComplete="off">
      {withCurrent && (
        <label>
          Current PIN
          <input name="current" type="password" inputMode="numeric" required />
        </label>
      )}
      <label>
        New PIN (4–8 digits)
        <input name="pin" type="password" inputMode="numeric" pattern="\d{4,8}" required />
      </label>
      <label>
        Repeat new PIN
        <input name="confirm" type="password" inputMode="numeric" pattern="\d{4,8}" required />
      </label>
      <button type="submit" className="prc-btn" disabled={busy}>
        {busy ? "Saving…" : withCurrent ? "Change PIN" : "Create PIN"}
      </button>
    </form>
  );

  return (
    <section className="prc-pin">
      <div className="prc-pinhead">
        <div>
          <h2>🔒 Pricing PIN</h2>
          <p>
            {hasPin
              ? "Protects the Settings tab of every pricing tool. It's asked every time Settings is opened."
              : isAppAdmin
                ? "No PIN yet — until one is set, nobody can change prices or catalogs. Create it below."
                : "No PIN has been set yet. Ask an app admin to open Pricing and create one."}
          </p>
        </div>
        {hasPin && !open && (
          <button type="button" className="prc-btn prc-btn-ghost" onClick={() => { setOpen(true); setMsg(null); }}>
            Change PIN
          </button>
        )}
      </div>
      {!hasPin && isAppAdmin && fields(false)}
      {hasPin && open && fields(true)}
      {msg && <p className={msg.ok ? "prc-ok" : "prc-err"}>{msg.text}</p>}
    </section>
  );
}
