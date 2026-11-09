"use client";
import { useState, useTransition } from "react";
import { addPartner, sendMissedOrders, setPartnerEnabled, skipMissedOrders } from "./actions";

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

/** Adds a partner switched OFF; no e-mail goes out. */
export function AddPartnerForm() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  return (
    <form onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await addPartner(email, name); setMsg(r.ok ? `${email} е добавен (спрян). Включи го с бутона, когато трябва.` : r.error ?? "Грешка"); }); }}
      className="flex flex-col sm:flex-row gap-2">
      <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required placeholder="Имейл на нов партньор" className="flex-1 bg-white/5 border border-white/15 px-3 py-2.5 text-sm" />
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Име (по желание)" className="sm:w-48 bg-white/5 border border-white/15 px-3 py-2.5 text-sm" />
      <button disabled={pending} className="bg-white text-[#0a0e1f] text-xs font-semibold tracking-[0.14em] uppercase px-5 py-2.5 disabled:opacity-40">{pending ? "…" : "Добави"}</button>
      {msg && <p className="text-xs text-white/60 sm:self-center">{msg}</p>}
    </form>
  );
}

/** The order e-mails held back while the partner was switched off: the owner sends them or not. */
export function MissedOrders({ refs, partnerOn }: { refs: string[]; partnerOn: boolean }) {
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  if (!refs.length) return msg ? <p className="text-xs text-white/60">{msg}</p> : null;
  return (
    <div className="border border-amber-500/40 bg-amber-500/10 p-4 flex flex-col gap-3">
      <p className="text-sm">
        <b>{refs.length} {refs.length === 1 ? "поръчка" : "поръчки"} без имейл до партньора</b>, докато беше спрян: {refs.join(", ")}
      </p>
      {partnerOn ? (
        <div className="flex flex-wrap gap-2">
          <button disabled={pending} onClick={() => start(async () => { const r = await sendMissedOrders(); setMsg(r.ok ? `Изпратени: ${r.sent}` : r.error ?? "Грешка"); })}
            className="bg-white text-[#0a0e1f] text-xs font-semibold tracking-[0.14em] uppercase px-4 py-2.5 disabled:opacity-40">Изпрати пропуснатите</button>
          <button disabled={pending} onClick={() => start(async () => { const r = await skipMissedOrders(); setMsg(r.ok ? `Пропуснати: ${r.skipped} (не са изпратени)` : r.error ?? "Грешка"); })}
            className="border border-white/30 text-xs font-semibold tracking-[0.14em] uppercase px-4 py-2.5 disabled:opacity-40">Не изпращай</button>
        </div>
      ) : (
        <p className="text-xs text-white/50">Ще избереш дали да ги изпратиш, когато го включиш.</p>
      )}
      {msg && <p className="text-xs text-white/60">{msg}</p>}
    </div>
  );
}
