"use client";
import type { RevenueData, RevenuePeriod } from "@/lib/revenue";

const eur2 = (n: number) => "€" + Number(n ?? 0).toLocaleString("bg-BG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const eur0 = (n: number) => "€" + Math.round(Number(n ?? 0)).toLocaleString("bg-BG");

export function RevenueBoard({ data }: { data: RevenueData }) {
  const cur = data.current_month;
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

      {/* Hero — current-month product revenue */}
      <div style={{ background: "rgba(250,199,117,0.1)", border: "1px solid rgba(250,199,117,0.4)", borderRadius: 12, padding: "16px 20px" }}>
        <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em" }}>Оборот от стока · текущ месец</div>
        <div style={{ color: "#FAC775", fontSize: 34, fontWeight: 500, margin: "4px 0 2px" }}>{eur2(cur.revenue)}</div>
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>
          {cur.count} {cur.count === 1 ? "доставена пратка" : "доставени пратки"}
          {cur.count > 0 && <> · средно {eur2(avg)} / поръчка</>}
          {" · "}<span style={{ color: "rgba(255,255,255,0.35)" }}>без доставката (тя отива на Еконт)</span>
        </div>
      </div>

      {/* Periods */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        <PeriodCard label="Текущ месец" p={cur} />
        <PeriodCard label="Минал месец" p={data.last_month} />
        <PeriodCard label="От началото" p={data.all_time} />
      </div>

      {/* Breakdown — current month */}
      <div style={{ background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "13px 16px" }}>
        <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10 }}>Разбивка · текущ месец</div>
        <div style={{ display: "flex", height: 10, borderRadius: 5, overflow: "hidden", marginBottom: 10, background: "rgba(255,255,255,0.06)" }}>
          <div style={{ width: `${goodsPct}%`, background: "#FAC775" }} />
          <div style={{ width: `${shipPct}%`, background: "rgba(133,183,235,0.7)" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", fontSize: 13 }}>
          <span style={{ color: "#FAC775" }}>● Оборот от стока <b>{eur2(cur.revenue)}</b> <span style={{ color: "rgba(255,255,255,0.4)" }}>(твоят приход)</span></span>
          <span style={{ color: "#85B7EB" }}>● Доставка <b>{eur2(cur.shipping)}</b> <span style={{ color: "rgba(255,255,255,0.4)" }}>(към Еконт)</span></span>
          <span style={{ color: "rgba(255,255,255,0.7)" }}>Общо събрано <b style={{ color: "#fff" }}>{eur2(cur.collected)}</b></span>
        </div>
      </div>

      {/* Top products by revenue */}
      {top.length > 0 && (
        <div style={{ background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "13px 16px" }}>
          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10 }}>Топ продукти по оборот · от началото</div>
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

      {/* Footer note */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "rgba(133,183,235,0.08)", border: "0.5px solid rgba(133,183,235,0.25)", borderRadius: 10, padding: "11px 14px" }}>
        <span style={{ color: "#85B7EB", fontSize: 14, flexShrink: 0 }} aria-hidden>ℹ</span>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", lineHeight: 1.55 }}>
          Брои се <b style={{ color: "#fff" }}>само завършени</b> (реално взети, потвърдени от Еконт). Изпратени/върнати/отказани не влизат. Периодите са по датата на доставяне, българско време. „Оборот от стока" е след промо кодове, без доставката.
        </span>
      </div>
    </main>
  );
}

function PeriodCard({ label, p }: { label: string; p: RevenuePeriod }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "12px 14px" }}>
      <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
      <div style={{ color: "#FAC775", fontSize: 20, fontWeight: 500, marginTop: 3 }}>{eur0(p.revenue)}</div>
      <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 11 }}>{p.count} {p.count === 1 ? "пратка" : "пратки"} · {eur0(p.collected)} събрано</div>
    </div>
  );
}
