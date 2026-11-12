"use client";
import { useState } from "react";
import type { ProductRevenue, StateCells, CategoryKey } from "@/lib/revenue-products";

const eur0 = (n: number) => "€" + Math.round(Number(n ?? 0)).toLocaleString("bg-BG");
const COLORS = { delivered: "#4ade80", inMotion: "#38bdf8", waiting: "#94a3b8" } as const;
const box = { background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "13px 16px" } as const;
const title = { color: "rgba(255,255,255,0.4)", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase" as const, marginBottom: 10 };

function Cells({ sc }: { sc: StateCells }) {
  return (
    <>
      {(["delivered", "inMotion", "waiting"] as const).map((k) => (
        <td key={k} style={{ textAlign: "right", padding: "6px 8px", whiteSpace: "nowrap", color: sc[k].qty ? COLORS[k] : "rgba(255,255,255,0.2)" }}>
          {sc[k].qty ? <>{eur0(sc[k].revenue)} <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>· {sc[k].qty} бр</span></> : "—"}
        </td>
      ))}
      <td style={{ textAlign: "right", padding: "6px 8px", whiteSpace: "nowrap", color: "#FAC775", fontWeight: 500 }}>
        {eur0(sc.delivered.revenue + sc.inMotion.revenue + sc.waiting.revenue)}
      </td>
    </>
  );
}

function Head({ first }: { first: string }) {
  return (
    <thead>
      <tr style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>
        <th style={{ textAlign: "left", padding: "4px 8px", fontWeight: 400 }}>{first}</th>
        <th style={{ textAlign: "right", padding: "4px 8px", fontWeight: 400 }}>Доставени</th>
        <th style={{ textAlign: "right", padding: "4px 8px", fontWeight: 400 }}>В движение</th>
        <th style={{ textAlign: "right", padding: "4px 8px", fontWeight: 400 }}>Изчакват</th>
        <th style={{ textAlign: "right", padding: "4px 8px", fontWeight: 400 }}>Общо</th>
      </tr>
    </thead>
  );
}

export function ProductRevenueBlock({ data }: { data: ProductRevenue }) {
  const [scope, setScope] = useState<"month" | "all">("month");
  const [cat, setCat] = useState<CategoryKey | "all">("all");
  const has = (sc: StateCells) => sc.delivered.qty + sc.inMotion.qty + sc.waiting.qty > 0;
  const cats = data.categories.filter((c) => has(c[scope]));
  const prods = data.products.filter((p) => has(p[scope]) && (cat === "all" || p.category === cat));
  const btn = (on: boolean) => ({
    fontSize: 11, padding: "4px 10px", borderRadius: 6, cursor: "pointer",
    border: `0.5px solid ${on ? "rgba(250,199,117,0.6)" : "rgba(255,255,255,0.15)"}`,
    background: on ? "rgba(250,199,117,0.12)" : "transparent", color: on ? "#FAC775" : "rgba(255,255,255,0.6)",
  });

  return (
    <>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <button style={btn(scope === "month")} onClick={() => setScope("month")}>Текущ месец ({data.monthLabel})</button>
        <button style={btn(scope === "all")} onClick={() => setScope("all")}>От началото</button>
        {data.lastOrderAt && (
          <span style={{ marginLeft: "auto", color: "rgba(255,255,255,0.35)", fontSize: 11 }}>
            последна поръчка: {new Date(data.lastOrderAt).toLocaleString("bg-BG", { timeZone: "Europe/Sofia", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>

      <div style={box}>
        <div style={title}>По категории · {scope === "month" ? `текущ месец (${data.monthLabel})` : "от началото"} · България + Румъния в €</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <Head first="Категория" />
            <tbody>
              {cats.map((c) => (
                <tr key={c.category} style={{ borderTop: "0.5px solid rgba(255,255,255,0.06)", cursor: "pointer" }} onClick={() => setCat(cat === c.category ? "all" : c.category)}>
                  <td style={{ padding: "6px 8px", color: cat === c.category ? "#FAC775" : "#fff" }}>{c.label}</td>
                  <Cells sc={c[scope]} />
                </tr>
              ))}
              <tr style={{ borderTop: "0.5px solid rgba(255,255,255,0.2)" }}>
                <td style={{ padding: "6px 8px", color: "rgba(255,255,255,0.7)" }}>Общо</td>
                <Cells sc={data.totals[scope]} />
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div style={box}>
        <div style={{ ...title, display: "flex", justifyContent: "space-between", gap: 8 }}>
          <span>Всички продукти{cat !== "all" ? ` · ${cats.find((c) => c.category === cat)?.label ?? ""}` : ""}</span>
          {cat !== "all" && <span style={{ cursor: "pointer", color: "#FAC775" }} onClick={() => setCat("all")}>покажи всички ✕</span>}
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <Head first="Продукт" />
            <tbody>
              {prods.map((p) => (
                <tr key={p.slug} style={{ borderTop: "0.5px solid rgba(255,255,255,0.06)" }}>
                  <td style={{ padding: "6px 8px", color: "#fff", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</td>
                  <Cells sc={p[scope]} />
                </tr>
              ))}
              {prods.length === 0 && <tr><td colSpan={5} style={{ padding: 12, color: "rgba(255,255,255,0.4)", textAlign: "center" }}>Няма продажби за периода.</td></tr>}
            </tbody>
          </table>
        </div>
        <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, marginTop: 8, lineHeight: 1.5 }}>
          Сумите са реално платеното за всеки продукт: при 1+1, комплекти и отстъпки сумата на поръчката (без доставката) е разделена между
          продуктите по каталожна цена, затова безплатното бижу не надува оборота. Доставени - по месец на доставяне; в движение и изчакват - по месец на поръчката.
          Подаръци се броят само като бройки. Кликни категория, за да филтрираш продуктите.
        </div>
      </div>
    </>
  );
}
