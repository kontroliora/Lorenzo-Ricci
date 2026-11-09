"use client";
import { useState, useTransition } from "react";
import { invitePartner, setPartnerEnabled } from "./actions";

export function PartnerToggle({ email, enabled }: { email: string; enabled: boolean }) {
  const [on, setOn] = useState(enabled);
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  return (
    <div className="flex items-center gap-3">
      <button role="switch" aria-checked={on} disabled={pending}
        onClick={() => start(async () => { const r = await setPartnerEnabled(email, !on); if (r.ok) setOn(!on); else setErr(r.error ?? "Грешка"); })}
        className={`relative w-14 h-8 rounded-full transition-colors ${on ? "bg-green-600" : "bg-white/20"} disabled:opacity-50`}>
        <span className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-all ${on ? "left-7" : "left-1"}`} />
      </button>
      <span className="text-sm">{on ? "Активен" : "Спрян"}</span>
      {err && <span className="text-red-400 text-xs">{err}</span>}
    </div>
  );
}

export function InviteForm() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  return (
    <form onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await invitePartner(email, name); setMsg(r.ok ? `Поканата е изпратена до ${email}` : r.error ?? "Грешка"); }); }}
      className="flex flex-col sm:flex-row gap-2">
      <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required placeholder="Имейл на партньора" className="flex-1 bg-white/5 border border-white/15 px-3 py-2.5 text-sm" />
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Име (по желание)" className="sm:w-48 bg-white/5 border border-white/15 px-3 py-2.5 text-sm" />
      <button disabled={pending} className="bg-white text-[#0a0e1f] text-xs font-semibold tracking-[0.14em] uppercase px-5 py-2.5 disabled:opacity-40">{pending ? "…" : "Покани"}</button>
      {msg && <p className="text-xs text-white/60 sm:self-center">{msg}</p>}
    </form>
  );
}
