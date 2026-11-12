"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PartnerCartView } from "@/lib/partner/carts";
import type { CartCallState } from "@/lib/abandoned-carts";

// /partner -> Колички: abandoned carts with a women's-collection piece. Call, then mark the result and / or write a note (what the
// customer said, what is missing: often only the phone was typed). Shared with the shop's panel: they see it at once.
const REFRESH_MS = 30_000;
const money = (n: number) => `€${n.toFixed(2)}`;
const when = (iso: string) => new Date(iso).toLocaleString("bg-BG", { timeZone: "Europe/Sofia", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const ago = (iso: string) => {
  const h = (Date.now() - Date.parse(iso)) / 3_600_000;
  return h < 24 ? `преди ${Math.max(1, Math.round(h))} ч` : `преди ${Math.round(h / 24)} дни`;
};
const OUTCOMES: { key: CartCallState; label: string; cls: string }[] = [
  { key: "will_order", label: "Ще поръча", cls: "bg-green-700" },
  { key: "no_answer", label: "Не вдига", cls: "bg-amber-600" },
  { key: "declined", label: "Не иска", cls: "bg-red-700" },
];

export function PartnerCarts() {
  const [carts, setCarts] = useState<PartnerCartView[] | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const busy = useRef(false);

  const load = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const r = await fetch("/api/partner/carts", { cache: "no-store" });
      if (r.status === 403) { window.location.href = "/partner/login"; return; }
      if (!r.ok) throw new Error();
      setCarts(((await r.json()) as { carts: PartnerCartView[] }).carts); setError("");
    } catch { setError("Няма връзка - опитвам пак след малко"); } finally { busy.current = false; }
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(() => { if (document.visibilityState === "visible") load(); }, REFRESH_MS);
    const onVis = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
  }, [load]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 2600); return () => clearTimeout(t); }, [toast]);

  const onSaved = (id: string, c: PartnerCartView | null) => setCarts((cs) => cs && (c ? cs.map((x) => (x.id === id ? c : x)) : cs.filter((x) => x.id !== id)));
  const recent = (carts ?? []).filter((c) => c.section === "recent");
  const missed = (carts ?? []).filter((c) => c.section === "missed");

  return (
    <main className="max-w-2xl mx-auto px-3 pb-16 pt-3">
      <p className="text-[12px] text-[#6b6456] px-1 pb-2">Клиенти, които са написали телефон, но не са поръчали (с бижу от дамската колекция). Звънни, отбележи и пиши бележка: магазинът я вижда веднага.</p>
      {error && <p className="text-[13px] text-red-700 py-2">{error}</p>}
      {!carts && !error && <p className="text-center text-[#6b6456] py-12">Зареждане…</p>}
      {carts && carts.length === 0 && <p className="text-center text-[#6b6456] py-12">Няма колички за обаждане.</p>}
      {recent.length > 0 && <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b6456] mt-2 mb-2 px-1">Последните 24 часа · {recent.length}</h2>}
      <div className="flex flex-col gap-3">{recent.map((c) => <CartCard key={c.id} c={c} onSaved={onSaved} onToast={setToast} />)}</div>
      {missed.length > 0 && <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b6456] mt-6 mb-2 px-1">По-стари (до 14 дни) · {missed.length}</h2>}
      <div className="flex flex-col gap-3">{missed.map((c) => <CartCard key={c.id} c={c} onSaved={onSaved} onToast={setToast} />)}</div>
      <p className="text-center text-[11px] text-[#6b6456] mt-6">Обновява се автоматично. „Не иска“ и втори „Не вдига“ махат количката от списъка (и при магазина).</p>
      {toast && <div role="status" className="fixed left-1/2 -translate-x-1/2 bottom-6 z-50 whitespace-nowrap bg-[#0a0e1f] text-white text-[14px] font-semibold px-5 py-3 rounded-full shadow-lg">{toast}</div>}
    </main>
  );
}

function CartCard({ c, onSaved, onToast }: { c: PartnerCartView; onSaved: (id: string, c: PartnerCartView | null) => void; onToast: (t: string) => void }) {
  const [note, setNote] = useState(c.note.text);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => setNote(c.note.text), [c.note.text]);

  const save = async (patch: { outcome?: CartCallState; note?: string }) => {
    if (patch.outcome === "declined" && !window.confirm(`${c.name || c.phone}: „Не иска“?\n\nКоличката изчезва от списъка (и при магазина).`)) return;
    setSaving(true); setMsg("");
    try {
      const r = await fetch(`/api/partner/carts/${encodeURIComponent(c.id)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
      if (r.status === 403) { setMsg("Количката вече не е в списъка."); onSaved(c.id, null); return; }
      const j = (await r.json().catch(() => ({}))) as { cart?: PartnerCartView | null; error?: string };
      if (!r.ok) throw new Error(j.error);
      onSaved(c.id, j.cart ?? null);
      onToast(patch.outcome ? `Отбелязано: ${OUTCOMES.find((o) => o.key === patch.outcome)?.label}` : "Бележката е записана");
    } catch (e) { setMsg(e instanceof Error && e.message ? e.message : "Грешка"); } finally { setSaving(false); }
  };

  const state = c.call.state === "will_order" ? { t: "Ще поръча", cls: "bg-green-100 text-green-900" }
    : c.call.state === "no_answer" ? { t: `Не вдига · ${c.call.attempts} от 2`, cls: "bg-amber-100 text-amber-900" } : null;

  return (
    <article className="bg-white rounded-xl overflow-hidden shadow-sm">
      <div className="px-4 pt-3 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[12px] text-[#6b6456]">Напуснал {ago(c.leftAt)} · {when(c.leftAt)}</p>
            <p className="text-[17px] font-semibold mt-0.5">{c.name || "Без име"}</p>
          </div>
          <p className="text-[17px] font-bold whitespace-nowrap">{money(c.subtotal)}</p>
        </div>
        {state && (
          <p className="mt-2 text-[12px]"><span className={`font-bold px-2 py-0.5 rounded ${state.cls}`}>{state.t}</span>
            <span className="text-[#6b6456]"> · {c.call.byPartner ? "ти" : "магазинът"}{c.call.at ? `, ${when(c.call.at)}` : ""}</span></p>
        )}
        <a href={`tel:${c.phone.replace(/[^\d+]/g, "")}`} className="mt-3 flex items-center justify-center gap-2 bg-[#0a0e1f] text-white rounded-lg py-3 text-[16px] font-semibold">📞 {c.phone}</a>
        <ul className="mt-3 divide-y divide-[#efe7d6] border-y border-[#efe7d6]">
          {c.items.map((i, k) => (
            <li key={k} className={`py-2 flex justify-between gap-3 text-[14px] ${i.collection ? "bg-[#fbf3e2] -mx-4 px-4" : ""}`}>
              <span>
                {i.collection && <span className="inline-block mb-0.5 mr-1 align-middle text-[10px] font-bold uppercase tracking-wide bg-[#b08a3e] text-white rounded px-1.5 py-0.5">Дамска колекция</span>}
                <b>{i.name}</b>{i.qty > 1 ? ` × ${i.qty}` : ""}
              </span>
              <span className="whitespace-nowrap">{money(i.price * i.qty)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {OUTCOMES.map((o) => (
            <button key={o.key} disabled={saving} onClick={() => save({ outcome: o.key })}
              className={`py-3 rounded-lg text-white text-[14px] font-semibold disabled:opacity-50 ${o.cls} ${c.call.state === o.key ? "ring-2 ring-offset-2 ring-[#0a0e1f]" : "opacity-90"}`}>{o.label}</button>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={1000} placeholder="Бележка: какво каза, какво липсва (адрес, офис, име)…"
            className="flex-1 border border-[#e3d9c4] rounded-lg px-3 py-2 text-[15px] resize-none focus:outline-none focus:border-[#0a0e1f]" />
          <button disabled={saving || note === c.note.text} onClick={() => save({ note })}
            className="px-4 rounded-lg bg-white border border-[#0a0e1f] text-[13px] font-semibold disabled:opacity-40">Запази</button>
        </div>
        {c.note.text && c.note.at && <p className="mt-1 text-[11px] text-[#6b6456]">Бележка от {c.note.byPartner ? "теб" : "магазина"} · {when(c.note.at)}</p>}
        {msg && <p className="mt-2 text-[12px] text-red-700">{msg}</p>}
      </div>
    </article>
  );
}
