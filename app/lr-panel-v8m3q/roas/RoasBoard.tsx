"use client";
import { useState, useTransition } from "react";
import { getRoas, addSpend, updateSpend, deleteSpend, type SpendInput } from "./actions";
import type { RoasData } from "@/lib/roas";

type PeriodKey = "today" | "7d" | "30d" | "custom";

const eur = (n: number) => `€${n.toFixed(2)}`;
const roas = (n: number | null) => (n == null ? "—" : `${n.toFixed(2)}×`);
const fmtD = (iso: string) => new Date(iso).toLocaleDateString("bg-BG", { day: "2-digit", month: "short" });
const todayStr = () => new Date().toISOString().slice(0, 10);
const daysAgoStr = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };

function presetRange(key: Exclude<PeriodKey, "custom">) {
  const end = new Date();
  const start = new Date(end);
  if (key === "today") start.setHours(0, 0, 0, 0);
  else if (key === "7d") { start.setDate(start.getDate() - 6); start.setHours(0, 0, 0, 0); }
  else { start.setDate(start.getDate() - 29); start.setHours(0, 0, 0, 0); }
  return { start: start.toISOString(), end: end.toISOString() };
}
const dayToISO = (d: string, endOfDay = false) => new Date(`${d}T${endOfDay ? "23:59:59" : "00:00:00"}`).toISOString();

export function RoasBoard({ initial }: { initial: RoasData }) {
  const [data, setData] = useState<RoasData>(initial);
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [cStart, setCStart] = useState(initial.range.start.slice(0, 10));
  const [cEnd, setCEnd] = useState(initial.range.end.slice(0, 10));
  const [pending, start] = useTransition();

  const load = (startISO: string, endISO: string, key: PeriodKey) =>
    start(async () => { const d = await getRoas(startISO, endISO); if (d) setData(d); setPeriod(key); });
  const preset = (key: Exclude<PeriodKey, "custom">) => { const r = presetRange(key); load(r.start, r.end, key); };
  const applyCustom = () => load(dayToISO(cStart), dayToISO(cEnd, true), "custom");
  const refresh = () => start(async () => { const d = await getRoas(data.range.start, data.range.end); if (d) setData(d); });

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* ── Period selector ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {([["today", "Днес"], ["7d", "7 дни"], ["30d", "30 дни"]] as const).map(([k, lbl]) => (
          <button key={k} onClick={() => preset(k)} disabled={pending}
            className={`px-4 py-2 rounded-lg text-[13px] font-medium tracking-wide transition-colors ${
              period === k ? "bg-white text-[#0a0e1f]" : "bg-white/5 text-white/60 hover:text-white hover:bg-white/10"}`}>
            {lbl}
          </button>
        ))}
        <div className={`flex items-center gap-1.5 rounded-lg px-2 py-1 ${period === "custom" ? "bg-white/10" : "bg-white/5"}`}>
          <input type="date" value={cStart} max={cEnd} onChange={(e) => setCStart(e.target.value)}
            className="bg-transparent text-[12px] text-white/80 outline-none [color-scheme:dark]" />
          <span className="text-white/30 text-xs">–</span>
          <input type="date" value={cEnd} min={cStart} max={todayStr()} onChange={(e) => setCEnd(e.target.value)}
            className="bg-transparent text-[12px] text-white/80 outline-none [color-scheme:dark]" />
          <button onClick={applyCustom} disabled={pending}
            className="ml-1 px-2.5 py-1 rounded-md bg-white/10 hover:bg-white/20 text-[11px] text-white/80 tracking-wide">OK</button>
        </div>
        <span className="ml-auto text-[11px] text-white/30 tabular-nums">
          {fmtD(data.range.start)} – {fmtD(data.range.end)}{pending && " · зареждам…"}
        </span>
      </div>

      {/* ── Hero: Meta vs Real ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-stretch">
        <HeroCard tone="meta" title="Meta вижда" amount={data.gross}
          sub={`брутен · ${data.totalOrders} поръчки`} roasLabel="ROAS по Meta" roasVal={data.metaRoas} />
        <div className="flex md:flex-col items-center justify-center gap-2 px-2">
          <span className="text-[10px] tracking-[0.2em] uppercase text-white/30">преувеличение</span>
          <span className="text-2xl font-semibold text-amber-400 tabular-nums">
            {data.exaggerationPct == null ? "—" : `+${data.exaggerationPct}%`}
          </span>
          <span className="text-[10px] text-white/25 text-center max-w-[90px] leading-tight">над реалния приход</span>
        </div>
        <HeroCard tone="real" title="Реално (доставени)" amount={data.real}
          sub={`${data.byStatus.completed?.count ?? 0} доставени · in-hand`} roasLabel="РЕАЛЕН ROAS" roasVal={data.realRoas} />
      </div>

      {data.spend === 0 && (
        <p className="text-[12px] text-amber-300/70 -mt-4">
          ⓘ Въведи разход за периода по-долу, за да се сметне ROAS. Приходите и % преувеличение се виждат и без него.
        </p>
      )}
      {data.spend > 0 && (
        <div className="flex flex-wrap gap-x-8 gap-y-1 -mt-4 text-[12px] text-white/50">
          <span>Разход за периода: <b className="text-white/80">{eur(data.spend)}</b></span>
          <span>ROAS с в-движение: <b className="text-sky-300/90">{roas(data.potentialRoas)}</b> <span className="text-white/30">(ако изпратените се доставят)</span></span>
        </div>
      )}

      {/* ── Revenue breakdown by status ─────────────────────────────── */}
      <section className="space-y-3">
        <h3 className="text-[11px] tracking-[0.2em] uppercase text-white/40">Разбивка на приходите</h3>
        <div className="space-y-2">
          <Bar label="Доставени" hint="реален приход" bucket={data.byStatus.completed} gross={data.gross} color="#4ade80" />
          <Bar label="В движение" hint="изпратени · в транзит" bucket={data.byStatus.shipped} gross={data.gross} color="#38bdf8" />
          <Bar label="Изчакват" hint="нови + потвърдени" bucket={pendingBucket(data)} gross={data.gross} color="#94a3b8" />
          <Bar label="Отказани" hint="загубени" bucket={data.cancelled} gross={data.gross} color="#f87171" />
          <Bar label="Върнати" hint="след преглед / непотърсени" bucket={data.returned} gross={data.gross} color="#fbbf24" />
        </div>
        <div className="flex justify-between text-[12px] pt-2 border-t border-white/8">
          <span className="text-white/40">Брутно (Meta) = {eur(data.gross)}</span>
          <span className="text-white/40">Реално = <b className="text-emerald-400">{eur(data.real)}</b></span>
        </div>
      </section>

      {/* ── Signals ─────────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className={`rounded-xl border p-5 ${cancelTone(data.cancelRate).border} ${cancelTone(data.cancelRate).bg}`}>
          <p className="text-[11px] tracking-[0.18em] uppercase text-white/40">Процент откази</p>
          <p className={`mt-2 text-3xl font-semibold tabular-nums ${cancelTone(data.cancelRate).text}`}>{data.cancelRate}%</p>
          <p className="mt-1 text-[12px] text-white/45">{data.cancelled.count} от {data.totalOrders} поръчки{data.cancelRate >= 25 ? " · високо, следи го" : data.cancelRate >= 15 ? " · над нормата" : ""}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-[11px] tracking-[0.18em] uppercase text-white/40">Загуба от непотърсени</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-rose-300">−{eur(data.uncollected.loss)}</p>
          <p className="mt-1 text-[12px] text-white/45">
            {data.uncollected.classified
              ? `${data.uncollected.count} непотърсени × €${(data.uncollected.loss / (data.uncollected.count || 1)).toFixed(0)} двойна доставка`
              : "класификацията не е активирана — пусни миграцията + „Провери статуса"}
          </p>
        </div>
      </section>

      {/* ── Spend manager ───────────────────────────────────────────── */}
      <SpendManager entries={data.spendEntries} onChange={refresh} />
    </div>
  );
}

function pendingBucket(d: RoasData) {
  return { count: (d.byStatus.new?.count ?? 0) + (d.byStatus.confirmed?.count ?? 0), total: d.pending };
}
function cancelTone(rate: number) {
  if (rate >= 25) return { border: "border-rose-500/30", bg: "bg-rose-500/[0.06]", text: "text-rose-300" };
  if (rate >= 15) return { border: "border-amber-500/30", bg: "bg-amber-500/[0.06]", text: "text-amber-300" };
  return { border: "border-white/10", bg: "bg-white/[0.03]", text: "text-emerald-300" };
}

function HeroCard({ tone, title, amount, sub, roasLabel, roasVal }: {
  tone: "meta" | "real"; title: string; amount: number; sub: string; roasLabel: string; roasVal: number | null;
}) {
  const accent = tone === "real" ? "text-emerald-400" : "text-white";
  return (
    <div className={`rounded-2xl border p-6 ${tone === "real" ? "border-emerald-500/25 bg-emerald-500/[0.05]" : "border-white/10 bg-white/[0.03]"}`}>
      <p className="text-[11px] tracking-[0.18em] uppercase text-white/40">{title}</p>
      <p className={`mt-2 text-4xl font-semibold tabular-nums ${accent}`} style={{ fontFamily: "Georgia, serif" }}>{eur(amount)}</p>
      <p className="mt-1 text-[12px] text-white/45">{sub}</p>
      <div className="mt-4 pt-3 border-t border-white/8 flex items-baseline justify-between">
        <span className="text-[11px] tracking-[0.14em] uppercase text-white/35">{roasLabel}</span>
        <span className={`text-xl font-semibold tabular-nums ${roasVal == null ? "text-white/30" : accent}`}>{roas(roasVal)}</span>
      </div>
    </div>
  );
}

function Bar({ label, hint, bucket, gross, color }: {
  label: string; hint: string; bucket: { count: number; total: number } | undefined; gross: number; color: string;
}) {
  const total = bucket?.total ?? 0;
  const count = bucket?.count ?? 0;
  const pct = gross > 0 ? (total / gross) * 100 : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between text-[13px]">
        <span className="text-white/80">{label} <span className="text-white/30 text-[11px]">· {hint}</span></span>
        <span className="tabular-nums text-white/60">{eur(total)} <span className="text-white/30">· {count}</span></span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${Math.max(pct, total > 0 ? 1.5 : 0)}%`, background: color }} />
      </div>
    </div>
  );
}

function SpendManager({ entries, onChange }: { entries: RoasData["spendEntries"]; onChange: () => void }) {
  const [start, setStart] = useState(daysAgoStr(6));
  const [end, setEnd] = useState(todayStr());
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [busy, run] = useTransition();

  const submit = () => run(async () => {
    setMsg("");
    const input: SpendInput = { start, end, amount: parseFloat(amount), note };
    const r = editId ? await updateSpend(editId, input) : await addSpend(input);
    if (!r.ok) { setMsg(r.message ?? "Грешка"); return; }
    setAmount(""); setNote(""); setEditId(null);
    onChange();
  });
  const beginEdit = (e: RoasData["spendEntries"][number]) => {
    setEditId(e.id); setStart(e.period_start); setEnd(e.period_end); setAmount(String(e.amount)); setNote(e.note ?? "");
  };
  const remove = (id: string) => run(async () => { await deleteSpend(id); if (editId === id) setEditId(null); onChange(); });

  const field = "bg-white/5 border border-white/12 rounded-lg px-3 py-2 text-[13px] text-white outline-none focus:border-white/30 [color-scheme:dark]";
  return (
    <section className="space-y-3">
      <h3 className="text-[11px] tracking-[0.2em] uppercase text-white/40">Рекламен разход <span className="text-white/25 normal-case tracking-normal">· ръчно, разпределя се пропорционално по дни</span></h3>
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1"><span className="text-[10px] uppercase tracking-wider text-white/35">От</span>
            <input type="date" value={start} max={end} onChange={(e) => setStart(e.target.value)} className={field} /></label>
          <label className="flex flex-col gap-1"><span className="text-[10px] uppercase tracking-wider text-white/35">До</span>
            <input type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} className={field} /></label>
          <label className="flex flex-col gap-1"><span className="text-[10px] uppercase tracking-wider text-white/35">Разход €</span>
            <input inputMode="decimal" placeholder="280" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${field} w-24`} /></label>
          <label className="flex flex-col gap-1 flex-1 min-w-[140px]"><span className="text-[10px] uppercase tracking-wider text-white/35">Бележка</span>
            <input placeholder="напр. кампания колиета" value={note} onChange={(e) => setNote(e.target.value)} className={field} /></label>
          <button onClick={submit} disabled={busy}
            className="px-4 py-2 rounded-lg bg-[#0F6E56] hover:bg-[#12805f] text-white text-[13px] font-medium disabled:opacity-60">
            {editId ? "Запази" : "Добави"}
          </button>
          {editId && <button onClick={() => { setEditId(null); setAmount(""); setNote(""); }} className="px-3 py-2 text-[12px] text-white/40 hover:text-white/70">отказ</button>}
        </div>
        {msg && <p className="text-[12px] text-rose-300">{msg}</p>}

        {entries.length === 0
          ? <p className="text-[12px] text-white/30">Още няма въведен разход.</p>
          : <div className="divide-y divide-white/6">
              {entries.map((e) => (
                <div key={e.id} className="flex items-center gap-3 py-2 text-[13px]">
                  <span className="tabular-nums text-white/70 w-[130px]">{fmtD(e.period_start)} – {fmtD(e.period_end)}</span>
                  <span className="tabular-nums text-white font-medium w-[70px]">{eur(e.amount)}</span>
                  <span className="text-white/40 flex-1 truncate">{e.note ?? ""}</span>
                  <button onClick={() => beginEdit(e)} className="text-[11px] text-white/40 hover:text-white/80">ред.</button>
                  <button onClick={() => remove(e.id)} disabled={busy} className="text-[11px] text-rose-300/60 hover:text-rose-300">изтрий</button>
                </div>
              ))}
            </div>}
      </div>
    </section>
  );
}
