"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PartnerFilter, PartnerOrderView, PartnerStatus, RealStatusKey } from "@/lib/partner/orders";

const FILTERS: { key: PartnerFilter; label: string }[] = [
  { key: "new", label: "Нови" }, { key: "confirmed", label: "Потвърдени" }, { key: "shipped", label: "Изпратени" }, { key: "uncollected", label: "Непотърсени" }, { key: "cancelled", label: "Отказани" }, { key: "all", label: "Всички" },
];
const ACTIONS: { key: PartnerStatus; label: string; cls: string }[] = [
  { key: "called", label: "Обадено", cls: "bg-sky-600" },
  { key: "confirmed", label: "Потвърдено", cls: "bg-green-700" },
  { key: "no_answer", label: "Не вдига", cls: "bg-amber-600" },
  { key: "cancelled", label: "Отказано", cls: "bg-red-700" },
];
// the REAL status chip (the shop's status from the admin panel)
const REAL_CLS: Record<RealStatusKey, string> = {
  new: "bg-[#0a0e1f] text-white", called: "bg-sky-100 text-sky-900", confirmed: "bg-green-100 text-green-900", no_answer: "bg-amber-100 text-amber-900",
  cancelled: "bg-red-100 text-red-900", to_fulfil: "bg-green-100 text-green-900", shipped: "bg-teal-100 text-teal-900",
  completed: "bg-blue-100 text-blue-900", returned: "bg-orange-100 text-orange-900",
};
const MARK_CLS: Record<PartnerStatus, string> = {
  new: "", called: "text-sky-800", confirmed: "text-green-800", no_answer: "text-amber-800", cancelled: "text-red-800",
};
const REFRESH_MS = 20_000;
const money = (n: number, cur: string) => (cur === "lei" ? `${Math.round(n)} lei` : `€${n.toFixed(2)}`);
const when = (iso: string) => new Date(iso).toLocaleString("bg-BG", { timeZone: "Europe/Sofia", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export function PartnerOrders({ preview }: { preview?: { orders: PartnerOrderView[]; counts: Record<PartnerFilter, number> } }) {
  const [filter, setFilter] = useState<PartnerFilter>(preview ? "all" : "new");
  const [data, setData] = useState(preview ?? null);
  const [error, setError] = useState("");
  const [focus, setFocus] = useState<string | null>(null);
  const busy = useRef(false);

  const load = useCallback(async (f: PartnerFilter) => {
    if (preview || busy.current) return;
    busy.current = true;
    try {
      const r = await fetch(`/api/partner/orders?filter=${f}`, { cache: "no-store" });
      if (r.status === 403) { window.location.href = "/partner/login"; return; }
      if (!r.ok) throw new Error();
      setData(await r.json()); setError("");
    } catch { setError("Няма връзка - опитвам пак след малко"); } finally { busy.current = false; }
  }, [preview]);

  // a link from the e-mail (/partner?order=LR-...) opens "Всички" and jumps to that order
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("order");
    if (ref) { setFocus(ref); setFilter("all"); }
  }, []);
  useEffect(() => {
    load(filter);
    const t = setInterval(() => { if (document.visibilityState === "visible") load(filter); }, REFRESH_MS);
    const onVis = () => { if (document.visibilityState === "visible") load(filter); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
  }, [filter, load]);
  useEffect(() => {
    if (focus && data) document.getElementById(`o-${focus}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [focus, data]);

  // a mark comes back without the Econt part (pickup): keep the one already on the card
  const onSaved = (o: PartnerOrderView) => setData((d) => d && ({ ...d, orders: d.orders.map((x) => (x.ref === o.ref ? { ...o, pickup: o.pickup ?? x.pickup } : x)) }));
  const [toast, setToast] = useState("");
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 2600); return () => clearTimeout(t); }, [toast]);

  return (
    <main className="max-w-2xl mx-auto px-3 pb-16">
      <div className="sticky top-[88px] z-10 bg-[#f5f0e8] pt-3 pb-2 flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
        {FILTERS.map((f) => (
          <button key={f.key} onClick={() => { setFilter(f.key); setFocus(null); }}
            className={`shrink-0 px-3.5 py-2 rounded-full text-[13px] font-semibold border ${filter === f.key ? "bg-[#0a0e1f] text-white border-[#0a0e1f]" : "bg-white text-[#0a0e1f] border-[#e3d9c4]"}`}>
            {f.label}{data ? ` · ${data.counts[f.key]}` : ""}
          </button>
        ))}
      </div>
      {error && <p className="text-[13px] text-red-700 py-2">{error}</p>}
      {!data && !error && <p className="text-center text-[#6b6456] py-12">Зареждане…</p>}
      {data && data.orders.length === 0 && <p className="text-center text-[#6b6456] py-12">Няма поръчки тук.</p>}
      <div className="flex flex-col gap-3 mt-1">
        {data?.orders.map((o) => <OrderCard key={o.ref} o={o} highlight={o.ref === focus} onSaved={onSaved} onToast={setToast} preview={!!preview} />)}
      </div>
      {!preview && <p className="text-center text-[11px] text-[#6b6456] mt-6">Обновява се автоматично на всеки 20 секунди. Статусът горе вдясно е на магазина; твоите бутони са само отметка за нас.</p>}
      {toast && <div role="status" className="fixed left-1/2 -translate-x-1/2 bottom-6 z-50 whitespace-nowrap bg-[#0a0e1f] text-white text-[14px] font-semibold px-5 py-3 rounded-full shadow-lg">{toast}</div>}
    </main>
  );
}

function OrderCard({ o, highlight, onSaved, onToast, preview }: { o: PartnerOrderView; highlight: boolean; onSaved: (o: PartnerOrderView) => void; onToast: (t: string) => void; preview: boolean }) {
  const [note, setNote] = useState(o.state.note);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => setNote(o.state.note), [o.state.note]);
  const card = o.payment.kind === "card";

  const save = async (patch: { status?: PartnerStatus; note?: string }) => {
    if (patch.status === "cancelled" && !window.confirm(`Отбележи поръчка #${o.ref} като „Отказано“?\n\nТова е само твоя отметка за нас: статусът на поръчката не се променя.`)) return;
    if (preview) { if (patch.status) onToast(`Отбелязано: ${ACTIONS.find((a) => a.key === patch.status)?.label}`); return; }
    setSaving(true); setMsg("");
    try {
      const r = await fetch(`/api/partner/orders/${encodeURIComponent(o.ref)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
      if (r.status === 403) { window.location.href = "/partner/login"; return; }
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      onSaved(j.order); setMsg("");
      onToast(patch.status ? `Отбелязано: ${ACTIONS.find((a) => a.key === patch.status)?.label}` : "Бележката е записана");
    } catch (e) { setMsg(e instanceof Error && e.message ? e.message : "Грешка"); } finally { setSaving(false); }
  };

  return (
    <article id={`o-${o.ref}`} className={`bg-white rounded-xl overflow-hidden shadow-sm scroll-mt-36 ${highlight ? "ring-2 ring-[#0a0e1f]" : ""}`}>
      <div className={`px-4 py-3 font-bold text-[15px] ${card ? "bg-green-50 text-green-900 border-b-2 border-green-600" : "bg-orange-50 text-orange-900 border-b-2 border-orange-500"}`}>
        {card ? "✅ ПЛАТЕНО С КАРТА" : `💵 НАЛОЖЕН ПЛАТЕЖ — ${money(o.payment.collect, o.currency)}`}
      </div>
      <div className="px-4 pt-3 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[12px] text-[#6b6456]">#{o.ref} · {when(o.createdAt)}{o.market === "ro" ? " · 🇷🇴" : ""}</p>
            <p className="text-[17px] font-semibold mt-0.5">{o.name || "-"}</p>
          </div>
          <span title="Статус на поръчката (магазин)" className={`shrink-0 text-[11px] font-bold uppercase tracking-wide px-2 py-1 rounded ${REAL_CLS[o.real.key]}`}>{o.real.label}</span>
        </div>
        {o.pickup && (
          <div className="mt-2 rounded-lg border-2 border-orange-400 bg-orange-50 px-3 py-2 text-[13px] text-orange-900">
            <b>📦 НЕПОТЪРСЕНА · ден {o.pickup.day} в офиса</b>
            <br />{o.pickup.office} · от {when(o.pickup.since)}
            <br />{o.pickup.returnsInDays > 0 ? `Връща се след ~${o.pickup.returnsInDays} ${o.pickup.returnsInDays === 1 ? "ден" : "дни"}.` : "Всеки момент се връща."} Звънни да я вземе.
          </div>
        )}
        {o.state.status !== "new" && (
          <p className="mt-2 text-[13px]">
            <span className="text-[#6b6456]">Твоята отметка: </span><b className={MARK_CLS[o.state.status]}>{o.state.label}</b>
            {o.state.updatedAt ? <span className="text-[#6b6456]"> · {when(o.state.updatedAt)}</span> : null}
            <span className="text-[#6b6456]"> · статус на поръчката: {o.real.label}</span>
          </p>
        )}
        {o.phone && (
          <a href={`tel:${o.phone.replace(/\s+/g, "")}`} className="mt-3 flex items-center justify-center gap-2 bg-[#0a0e1f] text-white rounded-lg py-3 text-[16px] font-semibold">
            📞 {o.phone}
          </a>
        )}
        <p className="mt-3 text-[14px]"><span className="text-[#6b6456]">{o.delivery.courier} · {o.delivery.office ? "офис / автомат" : "до адрес"}:</span> {o.delivery.place || "-"}</p>
        <ul className="mt-3 divide-y divide-[#efe7d6] border-y border-[#efe7d6]">
          {o.items.map((i, k) => (
            <li key={k} className={`py-2 flex justify-between gap-3 text-[14px] ${i.collection ? "bg-[#fbf3e2] -mx-4 px-4" : ""}`}>
              <span>
                {i.collection && <span className="inline-block mb-0.5 mr-1 align-middle text-[10px] font-bold uppercase tracking-wide bg-[#b08a3e] text-white rounded px-1.5 py-0.5">Дамска колекция</span>}
                <b>{i.model}</b>{i.qty > 1 ? ` × ${i.qty}` : ""}{i.gift ? <span className="text-green-800 text-[12px]"> · подарък</span> : null}
                {(i.color || i.stone) && <><br /><span className="text-[#6b6456] text-[13px]">{[i.color, i.stone].filter(Boolean).join(" · ")}</span></>}
              </span>
              <span className="whitespace-nowrap">{i.gift ? "0" : money(i.price * i.qty, o.currency)}</span>
            </li>
          ))}
          {o.discount > 0 && <li className="py-2 flex justify-between text-[13px] text-green-800"><span>Отстъпки (1+1, код ...)</span><span>-{money(o.discount, o.currency)}</span></li>}
          {o.shipping > 0 && <li className="py-2 flex justify-between text-[13px]"><span>Доставка</span><span>{money(o.shipping, o.currency)}</span></li>}
          <li className="py-2 flex justify-between text-[14px]"><span>Общо поръчка</span><span>{money(o.total, o.currency)}</span></li>
          <li className="py-2 flex justify-between text-[15px] font-bold"><span>{card ? "Платено с карта - за събиране" : "За събиране"}</span><span>{money(o.payment.collect, o.currency)}</span></li>
        </ul>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {ACTIONS.map((a) => (
            <button key={a.key} disabled={saving} onClick={() => save({ status: a.key })}
              className={`py-3 rounded-lg text-white text-[14px] font-semibold disabled:opacity-50 ${a.cls} ${o.state.status === a.key ? "ring-2 ring-offset-2 ring-[#0a0e1f]" : "opacity-90"}`}>
              {a.label}
            </button>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={1000} placeholder="Бележка…"
            className="flex-1 border border-[#e3d9c4] rounded-lg px-3 py-2 text-[15px] resize-none focus:outline-none focus:border-[#0a0e1f]" />
          <button disabled={saving || note === o.state.note} onClick={() => save({ note })}
            className="px-4 rounded-lg bg-white border border-[#0a0e1f] text-[13px] font-semibold disabled:opacity-40">Запази</button>
        </div>
        {msg && <p className="mt-2 text-[12px] text-[#6b6456]">{msg}</p>}
      </div>
    </article>
  );
}
