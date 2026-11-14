"use client";
import type { RevenueData, RevenuePeriod } from "@/lib/revenue";
import { EUR_RON } from "@/lib/ro/config";
import type { ProductRevenue } from "@/lib/revenue-products";
import { ProductRevenueBlock } from "./ProductRevenueBlock";
import type { SpendPeriods, SpendSource } from "@/lib/roas";

const eur2 = (n: number) => "€" + Number(n ?? 0).toLocaleString("bg-BG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const eur0 = (n: number) => "€" + Math.round(Number(n ?? 0)).toLocaleString("bg-BG");
const lei0 = (n: number) => Math.round(Number(n ?? 0)).toLocaleString("ro-RO") + " lei";

// One euro total for both markets: the Bulgarian figures are euro, the Romanian ones are lei and are converted at the owner's rate
// (1 EUR = 5.25 RON). Romania also keeps its own row below. `ro` is absent until supabase/owner_revenue_ro.sql has been run.
const sumPeriods = (bg: RevenuePeriod, ro?: RevenuePeriod): RevenuePeriod => ({
  revenue: bg.revenue + (ro?.revenue ?? 0) / EUR_RON,
  collected: bg.collected + (ro?.collected ?? 0) / EUR_RON,
  shipping: bg.shipping + (ro?.shipping ?? 0) / EUR_RON,
  count: bg.count + (ro?.count ?? 0),
});

export function RevenueBoard({ data, products, spend }: { data: RevenueData; products?: ProductRevenue | null; spend?: SpendPeriods | null }) {
  const cur = sumPeriods(data.current_month, data.ro?.current_month);
  const last = sumPeriods(data.last_month, data.ro?.last_month);
  const all = sumPeriods(data.all_time, data.ro?.all_time);
  const avg = cur.count > 0 ? cur.revenue / cur.count : 0;
  const goodsPct = cur.collected > 0 ? (cur.revenue / cur.collected) * 100 : 0;
  const shipPct = 100 - goodsPct;
  const top = data.top_products ?? [];
  const maxTop = Math.max(1, ...top.map((p) => p.revenue));

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-4">
      {/* Owner-only lock note */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(250,199,117,0.08)", border: "0.5px solid rgba(250,199,117,0.3)", borderRadius: 10, padding: "9px 14px" }}>
        <span style={{ color: "#FAC775", fontSize: 14 }} aria-hidden>🔒</span>
        <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 12 }}>Оборот · вижда се <b style={{ color: "#fff" }}>само от теб</b> (owner) — служителят няма достъп, нито до страницата, нито до числата.</span>
      </div>

      <a href="/lr-panel-v8m3q/revenue/audit" style={{ alignSelf: "flex-end", color: "#85B7EB", fontSize: 12 }}>Проверка срещу Еконт, Stripe и Meta →</a>

      {/* Hero — current-month product revenue */}
      <div style={{ background: "rgba(250,199,117,0.1)", border: "1px solid rgba(250,199,117,0.4)", borderRadius: 12, padding: "16px 20px" }}>
        <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em" }}>Оборот от стока · текущ месец</div>
        <div style={{ color: "#FAC775", fontSize: 34, fontWeight: 500, margin: "4px 0 2px" }}>{eur2(cur.revenue)}</div>
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>
          {cur.count} {cur.count === 1 ? "доставена пратка" : "доставени пратки"}
          {cur.count > 0 && <> · средно {eur2(avg)} / поръчка</>}
          {" · "}<span style={{ color: "rgba(255,255,255,0.35)" }}>без доставката (тя отива към куриера)</span>
        </div>
        {data.ro && (
          <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 4 }}>
            🇧🇬 България <b style={{ color: "#fff" }}>{eur2(data.current_month.revenue)}</b> · 🇷🇴 Румъния <b style={{ color: "#fff" }}>{lei0(data.ro.current_month.revenue)}</b> ≈ {eur2(data.ro.current_month.revenue / EUR_RON)}
          </div>
        )}
      </div>

      {/* Periods */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        <PeriodCard label="Текущ месец" p={cur} roEur={data.ro ? data.ro.current_month.revenue / EUR_RON : undefined} />
        <PeriodCard label="Минал месец" p={last} roEur={data.ro ? data.ro.last_month.revenue / EUR_RON : undefined} />
        <PeriodCard label="От началото" p={all} roEur={data.ro ? data.ro.all_time.revenue / EUR_RON : undefined} />
      </div>

      {/* Profit after ads (owner, 12.11.2026): goods revenue of delivered parcels minus the ad spend of the same period (Meta's daily
          spend, manual entries only for days without Meta data - same source as the ROAS tab). No cost of goods in the data. */}
      {spend && (
        <div style={{ background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "13px 16px" }}>
          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10 }}>Печалба след реклама · оборот от стока − разход за реклама</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
            <ProfitCard label="Текущ месец" revenue={cur.revenue} spend={spend.current_month.spend} source={spend.current_month.source}
              ifShipped={products ? products.totals.month.delivered.revenue + products.totals.month.inMotion.revenue : undefined} />
            <ProfitCard label="Минал месец" revenue={last.revenue} spend={spend.last_month.spend} source={spend.last_month.source} />
            <ProfitCard label="От началото" revenue={all.revenue} spend={spend.all_time.spend} source={spend.all_time.source}
              since={spend.all_time.since} />
          </div>
          <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, marginTop: 8, lineHeight: 1.5 }}>
            Оборотът е само от доставени пратки (по датата на доставяне), рекламата е по дните, в които е похарчена (Meta, синхронизира се всяка сутрин;
            ръчните записи от ROAS се ползват само за дни без данни от Meta). <b style={{ color: "rgba(255,255,255,0.55)" }}>Цената на стоката не е извадена</b> — в системата няма доставни цени.
          </div>
        </div>
      )}

      {/* Breakdown — current month */}
      <div style={{ background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "13px 16px" }}>
        <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10 }}>Разбивка · текущ месец</div>
        <div style={{ display: "flex", height: 10, borderRadius: 5, overflow: "hidden", marginBottom: 10, background: "rgba(255,255,255,0.06)" }}>
          <div style={{ width: `${goodsPct}%`, background: "#FAC775" }} />
          <div style={{ width: `${shipPct}%`, background: "rgba(133,183,235,0.7)" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", fontSize: 13 }}>
          <span style={{ color: "#FAC775" }}>● Оборот от стока <b>{eur2(cur.revenue)}</b> <span style={{ color: "rgba(255,255,255,0.4)" }}>(твоят приход)</span></span>
          <span style={{ color: "#85B7EB" }}>● Доставка <b>{eur2(cur.shipping)}</b> <span style={{ color: "rgba(255,255,255,0.4)" }}>(към Еконт и румънския куриер)</span></span>
          <span style={{ color: "rgba(255,255,255,0.7)" }}>Общо събрано <b style={{ color: "#fff" }}>{eur2(cur.collected)}</b></span>
        </div>
      </div>

      {/* Per category / every product - delivered, in motion, waiting; 1+1 and discounts taken off (lib/revenue-products.ts).
          Falls back to the old top-8 list only if that read fails. */}
      {products ? <ProductRevenueBlock data={products} /> : top.length > 0 && (

        <div style={{ background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "13px 16px" }}>
          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10 }}>Топ продукти по оборот · от началото · само България (евро)</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {top.map((p) => (
              <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ flex: 1, color: "#fff", fontSize: 13, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {p.name} <span style={{ color: "rgba(255,255,255,0.4)" }}>· {Math.round(p.qty)} бр</span>
                </span>
                <span style={{ width: 120, height: 6, background: "rgba(250,199,117,0.15)", borderRadius: 3, overflow: "hidden", flexShrink: 0 }}>
                  <span style={{ display: "block", width: `${Math.max(4, (p.revenue / maxTop) * 100)}%`, height: "100%", background: "#FAC775" }} />
                </span>
                <span style={{ color: "#FAC775", fontSize: 13, width: 66, textAlign: "right", flexShrink: 0 }}>{eur0(p.revenue)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Romania - its own row, in lei (already included in the euro totals above at the owner's rate) */}
      {data.ro && data.ro.all_time.count > 0 && (
        <div style={{ background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "13px 16px" }}>
          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10 }}>🇷🇴 Румъния · отделен ред в леи (влиза в общите суми в € по курс {EUR_RON})</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {([["Текущ месец", data.ro.current_month], ["Минал месец", data.ro.last_month], ["От началото", data.ro.all_time]] as const).map(([label, p]) => (
              <div key={label} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
                <div style={{ color: "#FAC775", fontSize: 20, fontWeight: 500, marginTop: 3 }}>{lei0(p.revenue)}</div>
                <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 11 }}>{p.count} {p.count === 1 ? "пратка" : "пратки"} · ≈ €{Math.round(p.revenue / EUR_RON).toLocaleString("bg-BG")} · {lei0(p.collected)} събрано</div>
              </div>
            ))}
          </div>
          <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, marginTop: 8 }}>Оборот от стока без доставката. В € по курс {EUR_RON} лея за €1.</div>
        </div>
      )}

      {/* Footer note */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "rgba(133,183,235,0.08)", border: "0.5px solid rgba(133,183,235,0.25)", borderRadius: 10, padding: "11px 14px" }}>
        <span style={{ color: "#85B7EB", fontSize: 14, flexShrink: 0 }} aria-hidden>ℹ</span>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", lineHeight: 1.55 }}>
          Брои се <b style={{ color: "#fff" }}>само завършени</b> (реално взети: за България потвърдени от Еконт, за Румъния отбелязани ръчно като „Доставена"). Изпратени/върнати/отказани не влизат. Общото в € е България + Румъния (лей ÷ {EUR_RON}). Периодите са по датата на доставяне, българско време. „Оборот от стока" е след промо кодове, без доставката.
        </span>
      </div>
    </main>
  );
}

function PeriodCard({ label, p, roEur }: { label: string; p: RevenuePeriod; roEur?: number }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "12px 14px" }}>
      <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
      <div style={{ color: "#FAC775", fontSize: 20, fontWeight: 500, marginTop: 3 }}>{eur0(p.revenue)}</div>
      <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 11 }}>{p.count} {p.count === 1 ? "пратка" : "пратки"} · {eur0(p.collected)} събрано</div>
      {roEur !== undefined && roEur > 0 && <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>в т.ч. 🇷🇴 Румъния ≈ {eur0(roEur)}</div>}
    </div>
  );
}

function ProfitCard({ label, revenue, spend, source, ifShipped, since }: { label: string; revenue: number; spend: number; source: SpendSource; ifShipped?: number; since?: string | null }) {
  const profit = revenue - spend;
  const roas = spend > 0 ? revenue / spend : null;
  const dm = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;
  return (
    <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "12px 14px" }}>
      <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
      <div style={{ color: profit >= 0 ? "#7DD3A8" : "#F09595", fontSize: 22, fontWeight: 500, marginTop: 3 }}>{profit < 0 ? "−" : ""}{eur0(Math.abs(profit))}</div>
      <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 12, lineHeight: 1.6 }}>
        <span style={{ color: "#FAC775" }}>{eur0(revenue)}</span> оборот − <span style={{ color: "#F0B37E" }}>{eur0(spend)}</span> реклама
        {roas !== null && <> · ROAS <b style={{ color: "#fff" }}>{roas.toFixed(2)}</b></>}
      </div>
      {ifShipped !== undefined && ifShipped > revenue && (
        <div style={{ color: "rgba(133,183,235,0.9)", fontSize: 11 }}>ако се доставят и изпратените: {eur0(ifShipped - spend)}</div>
      )}
      <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 11 }}>
        {since && <>от {dm(since)} · </>}Meta {source.metaDays} дни{source.manualDays > 0 && <> · ръчно {source.manualDays} дни</>}
        {source.noDataDays > 0 && <span style={{ color: "rgba(252,211,77,0.8)" }}> · {source.noDataDays} дни без данни</span>}
      </div>
    </div>
  );
}
