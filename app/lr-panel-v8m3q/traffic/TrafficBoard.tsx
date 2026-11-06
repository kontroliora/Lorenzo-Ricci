"use client";
import { useState, useTransition } from "react";
import { getTraffic } from "../marketing-actions";
import type { TrafficData } from "@/lib/traffic";
import { PeriodMarket, type M, type P } from "@/components/admin/PeriodMarket";

const n0 = (n: number) => n.toLocaleString("bg-BG");
const eur = (n: number) => `€${n.toLocaleString("bg-BG", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtD = (iso: string) => new Date(iso).toLocaleDateString("bg-BG", { day: "2-digit", month: "short", timeZone: "Europe/Sofia" });

export function TrafficBoard({ initial }: { initial: TrafficData }) {
  const [d, setD] = useState(initial);
  const [busy, start] = useTransition();
  const change = (p: P, m: M) => start(async () => { const r = await getTraffic(p, m); if (r) setD(r); });

  const maxDay = Math.max(1, ...d.daily.map((x) => x.visitors));
  const flagged = d.products.filter((p) => p.flag).length;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <PeriodMarket period={d.period} market={d.market} onChange={change} busy={busy} right={`${fmtD(d.range.start)} – ${fmtD(d.range.end)}`} />

      {!d.ready && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/[0.06] px-4 py-3 text-[13px] text-amber-200">
          Таблицата page_views още не е създадена: пусни supabase/traffic_ads_health.sql в Supabase.
        </p>
      )}
      {d.ready && d.firstView && Date.parse(d.firstView) > Date.parse(d.range.start) && (
        <p className="text-[12px] text-white/40">ⓘ Броенето тече от {new Date(d.firstView).toLocaleString("bg-BG", { timeZone: "Europe/Sofia", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}: преди това няма данни.</p>
      )}

      {/* KPIs */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Посетители" value={n0(d.visitors)} sub={`${n0(d.sessions)} посещения`} />
        <Kpi label="Прегледи на страници" value={n0(d.pageviews)} sub={d.sessions ? `${(d.pageviews / d.sessions).toFixed(1)} стр. / посещение` : "—"} />
        <Kpi label="Поръчки" value={n0(d.orders)} sub={`${eur(d.revenue)} · ${d.metaOrders} от Meta`} />
        <Kpi label="Конверсия" value={d.conversion == null ? "—" : `${d.conversion.toFixed(1)}%`} sub="поръчки / посетители" tone={d.conversion == null ? "" : d.conversion >= 1.5 ? "text-emerald-400" : d.conversion >= 0.7 ? "text-amber-300" : "text-rose-300"} />
      </section>

      {/* Daily */}
      {d.daily.length > 1 && (
        <section className="space-y-2">
          <h3 className="text-[11px] tracking-[0.2em] uppercase text-white/40">Посетители по дни</h3>
          <div className="flex items-end gap-1 h-28 rounded-xl border border-white/10 bg-white/[0.02] p-3">
            {d.daily.map((x) => (
              <div key={x.day} className="flex-1 flex flex-col items-center justify-end h-full group" title={`${x.day}: ${x.visitors} посетители, ${x.views} прегледа`}>
                <span className="text-[9px] text-white/40 opacity-0 group-hover:opacity-100 tabular-nums">{x.visitors}</span>
                <div className="w-full rounded-t bg-sky-400/70 group-hover:bg-sky-300" style={{ height: `${Math.max(2, (x.visitors / maxDay) * 100)}%` }} />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-white/30 tabular-nums"><span>{d.daily[0].day.slice(5)}</span><span>{d.daily[d.daily.length - 1].day.slice(5)}</span></div>
        </section>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Table title="Топ страници" head={["Страница", "Прегл.", "Посет."]}
          rows={d.pages.map((p) => [<span key="p" className="font-mono text-[12px] text-white/80 break-all">{p.path}</span>, n0(p.views), n0(p.visitors)])} />
        <Table title="Откъде идват" head={["Източник", "Посещ.", "Посет."]}
          rows={d.sources.map((s) => [<span key="s" className="text-white/80">{s.source}</span>, n0(s.sessions), n0(s.visitors)])} />
      </div>

      {/* Products: views vs sales */}
      <section className="space-y-3">
        <h3 className="text-[11px] tracking-[0.2em] uppercase text-white/40">
          Продукти: прегледи срещу продажби
          {flagged > 0 && <span className="ml-2 normal-case tracking-normal text-rose-300">· {flagged} с ≥{d.flagAt} посетители и 0 продажби</span>}
        </h3>
        <div className="rounded-xl border border-white/10 overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="text-[10px] uppercase tracking-wider text-white/35">
              <tr className="border-b border-white/8"><th className="text-left px-3 py-2 font-normal">Продукт</th><th className="text-right px-3 py-2 font-normal">Посетители</th><th className="text-right px-3 py-2 font-normal">Прегледи</th><th className="text-right px-3 py-2 font-normal">Продадени</th><th className="text-right px-3 py-2 font-normal">Конв.</th></tr>
            </thead>
            <tbody>
              {d.products.length === 0 && <tr><td colSpan={5} className="px-3 py-4 text-white/30 text-center">Още няма данни.</td></tr>}
              {d.products.slice(0, 40).map((p) => (
                <tr key={p.slug} className={`border-b border-white/5 ${p.flag ? "bg-rose-500/[0.08]" : ""}`}>
                  <td className="px-3 py-2">{p.flag && <span className="text-rose-300 mr-1.5" title="много прегледи, 0 продажби">●</span>}<span className="text-white/85">{p.name}</span></td>
                  <td className="px-3 py-2 text-right tabular-nums">{n0(p.visitors)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-white/50">{n0(p.views)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${p.sold ? "text-emerald-400" : "text-white/35"}`}>{p.sold}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-white/60">{p.conv == null ? "—" : `${p.conv.toFixed(1)}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Table title="Устройства" head={["Устройство", "Посет."]}
          rows={d.devices.map((x) => [{ mobile: "📱 телефон", tablet: "таблет", desktop: "💻 компютър" }[x.device] ?? x.device, n0(x.visitors)])} />
        <Table title="Държави" head={["Държава", "Посет."]} rows={d.countries.map((x) => [x.country, n0(x.visitors)])} />
      </div>

      <p className="text-[11px] text-white/30 leading-relaxed">
        Броят се само хора: прегледът се записва след първото действие на страницата (скрол, докосване, клик) или 6 сек, както Meta пикселът, затова роботите на
        Meta и кликовете-ботове не влизат. Посетител = един браузър. BG/RO по страницата (/ro = RO). Поръчките са реалните (без тестови и неплатени карти).
      </p>
    </div>
  );
}

function Kpi({ label, value, sub, tone = "" }: { label: string; value: string; sub: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-[10px] tracking-[0.18em] uppercase text-white/40">{label}</p>
      <p className={`mt-1.5 text-2xl font-semibold tabular-nums ${tone || "text-white"}`} style={{ fontFamily: "Georgia, serif" }}>{value}</p>
      <p className="mt-0.5 text-[11px] text-white/40">{sub}</p>
    </div>
  );
}

function Table({ title, head, rows }: { title: string; head: string[]; rows: React.ReactNode[][] }) {
  return (
    <section className="space-y-2">
      <h3 className="text-[11px] tracking-[0.2em] uppercase text-white/40">{title}</h3>
      <div className="rounded-xl border border-white/10 overflow-hidden">
        <table className="w-full text-[13px]">
          <thead className="text-[10px] uppercase tracking-wider text-white/35">
            <tr className="border-b border-white/8">{head.map((h, i) => <th key={h} className={`px-3 py-2 font-normal ${i ? "text-right" : "text-left"}`}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={head.length} className="px-3 py-4 text-white/30 text-center">Още няма данни.</td></tr>}
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-white/5 last:border-0">{r.map((c, j) => <td key={j} className={`px-3 py-2 ${j ? "text-right tabular-nums text-white/60" : ""}`}>{c}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
