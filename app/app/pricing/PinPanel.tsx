"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";

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
          <span className="label">Current PIN</span>
          <input className="input" name="current" type="password" inputMode="numeric" required />
        </label>
      )}
      <label>
        <span className="label">New PIN (4–8 digits)</span>
        <input className="input" name="pin" type="password" inputMode="numeric" pattern="\d{4,8}" required />
      </label>
      <label>
        <span className="label">Repeat new PIN</span>
        <input className="input" name="confirm" type="password" inputMode="numeric" pattern="\d{4,8}" required />
      </label>
      <div className="prc-pinbtns">
        {withCurrent && (
          <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
        )}
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Saving…" : withCurrent ? "Change PIN" : "Create PIN"}
        </button>
      </div>
    </form>
  );

  return (
    <section className="card prc-pin">
      <div className="prc-pinhead">
        <span className="prc-pin-icon"><KeyRound size={17} strokeWidth={2} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="font-display prc-pin-title">Settings PIN</div>
          <p>
            {hasPin
              ? "Protects every tool's Settings tab. Asked each time Settings is opened."
              : isAppAdmin
                ? "No PIN yet — until one is set, nobody can change prices or catalogs."
                : "No PIN yet. Ask an app admin to open Pricing and create one."}
          </p>
        </div>
        {hasPin && !open && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setOpen(true); setMsg(null); }}>
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
