"use client";
import { Fragment, useState, useTransition } from "react";
import { getAdPerformance } from "../marketing-actions";
import type { AdPerformance } from "@/lib/ad-performance";
import { PeriodMarket, type M, type P } from "@/components/admin/PeriodMarket";

// Automatic Meta data (meta_ad_insights, synced every 15 min) x our orders, per campaign and per ad. The manual ledger below stays.
const eur = (n: number | null) => (n == null ? "—" : `€${n.toFixed(2)}`);
const x = (n: number | null) => (n == null ? "—" : `${n.toFixed(2)}×`);
const n0 = (n: number) => n.toLocaleString("bg-BG");
const STATUS: Record<string, string> = { ACTIVE: "активна", PAUSED: "пауза", CAMPAIGN_PAUSED: "кампания на пауза", ADSET_PAUSED: "ad set на пауза", DELETED: "изтрита", ARCHIVED: "архив", WITH_ISSUES: "проблем", DISAPPROVED: "отхвърлена", PENDING_REVIEW: "преглед" };

export function MetaAdsBlock({ initial, initialPeriod }: { initial: AdPerformance | null; initialPeriod: P }) {
  const [d, setD] = useState(initial);
  const [period, setPeriod] = useState<P>(initialPeriod);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [busy, start] = useTransition();
  const change = (p: P, m: M) => start(async () => { const r = await getAdPerformance(p, m); if (r) { setD(r); setPeriod(p); } });

  if (!d) return null;
  const t = d.totals;
  const synced = d.lastSync ? new Date(d.lastSync).toLocaleString("bg-BG", { timeZone: "Europe/Sofia", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : null;
  const reds = d.ads.filter((a) => a.red.length).length;

  return (
    <section className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-[11px] tracking-[0.2em] uppercase text-white/50">Meta реклами · автоматично</h3>
        <span className="text-[11px] text-white/30">{synced ? `обновено ${synced}` : "още няма синхронизация"}{reds ? <b className="text-rose-300 font-medium"> · {reds} в червено</b> : null}</span>
      </div>
      <PeriodMarket period={period} market={d.market} onChange={change} busy={busy} right={`${d.since.slice(5)} – ${d.until.slice(5)}`} />

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Tile label="Разход (Meta)" value={eur(t.spend)} sub={`${n0(t.impressions)} показв. · ${n0(t.clicks)} клика`} />
        <Tile label="Поръчки от Meta" value={String(t.metaOrders)} sub={`наши, ${eur(t.metaRevenue)}`} />
        <Tile label="Цена на поръчка" value={eur(t.costPerOrder)} tone={t.costPerOrder != null && t.costPerOrder > 25 ? "text-rose-300" : "text-white"} sub="разход / наши поръчки" />
        <Tile label="ROAS (наш)" value={x(t.roas)} tone={t.roas != null && t.roas >= 2 ? "text-emerald-400" : t.roas != null && t.roas < 1 ? "text-rose-300" : "text-white"} sub="оборот / разход" />
        <Tile label="Покупки по Meta" value={String(t.metaPurchases)} sub={`Meta отчита ${eur(t.metaValue)}`} />
      </div>

      {d.tagging === "off" && (
        <p className="rounded-lg border border-amber-500/25 bg-amber-500/[0.05] px-3 py-2 text-[12px] text-amber-200/90 leading-relaxed">
          Рекламите нямат UTM параметри, затова поръчките по реклама са <b>по данни на Meta</b> (покупки от пиксела). Нашите поръчки от Meta ({t.metaOrders}, по fbclid) се виждат
          общо горе. За точни поръчки по реклама: Ads Manager → всяка реклама → URL parameters:{" "}
          <code className="bg-black/30 px-1 rounded text-amber-100">utm_source=facebook&amp;utm_medium=paid&amp;utm_campaign={"{{ad.id}}"}</code>
        </p>
      )}
      {d.tagging === "on" && d.unmatched.orders > 0 && (
        <p className="text-[12px] text-white/40">ⓘ {d.unmatched.orders} поръчки от Meta ({eur(d.unmatched.revenue)}) без UTM на реклама: в общото, не по реклама.</p>
      )}

      <div className="rounded-xl border border-white/10 overflow-x-auto">
        <table className="w-full text-[12.5px] min-w-[760px]">
          <thead className="text-[10px] uppercase tracking-wider text-white/35">
            <tr className="border-b border-white/8">
              <th className="text-left px-3 py-2 font-normal">Кампания / реклама</th>
              <th className="text-right px-2 py-2 font-normal">Разход</th>
              <th className="text-right px-2 py-2 font-normal">CTR</th>
              <th className="text-right px-2 py-2 font-normal">CPM</th>
              <th className="text-right px-2 py-2 font-normal">Поръчки</th>
              <th className="text-right px-2 py-2 font-normal">Цена / поръчка</th>
              <th className="text-right px-2 py-2 font-normal">ROAS</th>
              <th className="text-right px-3 py-2 font-normal">Днес</th>
            </tr>
          </thead>
          <tbody>
            {d.campaigns.length === 0 && <tr><td colSpan={8} className="px-3 py-5 text-center text-white/30">Няма разход за периода{d.lastSync ? "" : " (първата синхронизация още не е минала)"}.</td></tr>}
            {d.campaigns.map((c) => {
              const isOpen = open[c.campaign_id] ?? true;
              const cRed = c.costPerOrder != null && c.costPerOrder > 25;
              return (
                <Fragment key={c.campaign_id}>
                  <tr className="border-b border-white/8 bg-white/[0.03] cursor-pointer" onClick={() => setOpen((o) => ({ ...o, [c.campaign_id]: !isOpen }))}>
                    <td className="px-3 py-2 font-medium text-white">{isOpen ? "▾" : "▸"} {c.campaign_name} <span className="text-[10px] text-white/35 ml-1">{c.market.toUpperCase()}</span></td>
                    <td className="px-2 py-2 text-right tabular-nums">{eur(c.spend)}</td>
                    <td /><td />
                    <td className="px-2 py-2 text-right tabular-nums">{c.orders}</td>
                    <td className={`px-2 py-2 text-right tabular-nums ${cRed ? "text-rose-300" : ""}`}>{eur(c.costPerOrder)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{x(c.roas)}</td>
                    <td />
                  </tr>
                  {isOpen && c.ads.map((a) => {
                    const red = a.red.length > 0;
                    return (
                      <tr key={a.ad_id} className={`border-b border-white/5 ${red ? "bg-rose-500/[0.12]" : ""}`} title={red ? a.red.join(" · ") : undefined}>
                        <td className="pl-7 pr-3 py-2">
                          <span className={red ? "text-rose-200" : "text-white/85"}>{red && "● "}{a.ad_name}</span>
                          <span className="block text-[10.5px] text-white/35">{a.adset_name} · {STATUS[a.status] ?? a.status}{a.product_slug ? ` · ${a.product_slug}` : ""}{a.visitors ? ` · ${a.visitors} посещ.` : ""}</span>
                          {red && <span className="block text-[10.5px] text-rose-300">{a.red.join(" · ")}</span>}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">{eur(a.spend)}</td>
                        <td className="px-2 py-2 text-right tabular-nums text-white/60">{a.ctr == null ? "—" : `${a.ctr.toFixed(2)}%`}</td>
                        <td className="px-2 py-2 text-right tabular-nums text-white/60">{eur(a.cpm)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{a.orders}{a.basis === "meta" && <span className="text-[9px] text-white/35 ml-0.5" title="по данни на Meta (рекламата няма UTM)">M</span>}</td>
                        <td className={`px-2 py-2 text-right tabular-nums ${a.costPerOrder != null && a.costPerOrder > 25 ? "text-rose-300 font-medium" : ""}`}>{eur(a.costPerOrder)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{x(a.roas)}</td>
                        <td className={`px-3 py-2 text-right tabular-nums ${a.todaySpend > 15 && a.todayOrders === 0 ? "text-rose-300 font-medium" : "text-white/60"}`}>{eur(a.todaySpend)} · {a.todayOrders}</td>
                      </tr>
                    );
                  })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-white/30 leading-relaxed">
        Червено: цена на поръчка над €25, или над €15 разход днес и 0 поръчки. „M“ = поръчки по Meta (пиксел), иначе нашите поръчки по utm_campaign. Ръчният разход долу остава
        за общия ROAS горе; тези данни са отделно (таблица meta_ad_insights).
      </p>
    </section>
  );
}

function Tile({ label, value, sub, tone = "text-white" }: { label: string; value: string; sub: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
      <p className="text-[10px] tracking-[0.16em] uppercase text-white/40">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${tone}`}>{value}</p>
      <p className="text-[10.5px] text-white/35">{sub}</p>
    </div>
  );
}
