"use client";
// Econt label of one order on the board (owner, 27.11.2026): status badge, number + "Печат PDF", the error with "Създай отново",
// a manual office pick when a CHRONOBG office text was not recognised, and a loud "АНУЛИРАНА" so nobody packs a cancelled order.
import { useState, useTransition } from "react";
import type { AdminOrder } from "@/lib/orders";
import { createLabel, cancelLabel, labelPdf, setLabelOffice, officeChoices } from "./label-actions";

const BADGE: Record<string, { text: string; bg: string; fg: string }> = {
  none:      { text: "Няма товарителница", bg: "#2C2C2A", fg: "#D3D1C7" },
  pending:   { text: "Създава се…",        bg: "#412402", fg: "#FAC775" },
  created:   { text: "Товарителница създадена", bg: "#173404", fg: "#97C459" },
  error:     { text: "Грешка в товарителницата", bg: "#501313", fg: "#F09595" },
  cancelled: { text: "Товарителницата е анулирана", bg: "#501313", fg: "#F09595" },
};

const btn = (border: string, color: string): React.CSSProperties => ({
  border: `0.5px solid ${border}`, color, background: "transparent", fontSize: 12, padding: "6px 12px", borderRadius: 8, cursor: "pointer",
});

export function LabelBox({ order, mode, onNotice }: { order: AdminOrder; mode: "demo" | "live"; onNotice?: (m: string) => void }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  const [offices, setOffices] = useState<{ c: string; n: string; a: string }[] | null>(null);
  const [filter, setFilter] = useState("");
  const [pick, setPick] = useState("");

  const st = order.econt_label_status ?? "none";
  const badge = BADGE[st] ?? BADGE.none;
  const num = order.econt_shipment_number;
  const canCreate = order.status === "confirmed" && (st === "none" || st === "error" || st === "cancelled");
  const officeUnknown = st === "error" && /^Офисът не е разпознат/.test(order.econt_label_error ?? "");
  // Not worth a box: an order that never was / will be shipped from here and has no label.
  if (st === "none" && order.status !== "confirmed") return null;

  const act = (fn: () => Promise<{ ok: boolean; message?: string; url?: string }>, openPdf = false) =>
    start(async () => {
      setMsg("");
      // A tab must be opened in the click itself (pop-up blockers); it is pointed at the PDF once the link is back.
      const win = openPdf ? window.open("about:blank", "_blank") : null;
      try {
        const r = await fn();
        if (openPdf && r.ok && r.url) { if (win) win.location.href = r.url; else window.open(r.url, "_blank"); }
        else win?.close();
        if (r.message) { setMsg(r.message); if (!r.ok) onNotice?.(`${order.order_ref ?? order.id}: ${r.message}`); }
      } catch (e) {
        win?.close();
        setMsg(e instanceof Error ? e.message : "Грешка. Опитай пак.");
      }
    });

  const shown = offices?.filter((o) => !filter || `${o.n} ${o.a} ${o.c}`.toLowerCase().includes(filter.toLowerCase())).slice(0, 60) ?? [];

  return (
    <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 8, border: `0.5px solid ${st === "cancelled" || st === "error" ? "#A32D2D" : "rgba(255,255,255,0.12)"}`, background: st === "cancelled" ? "rgba(163,45,45,0.15)" : "rgba(255,255,255,0.02)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase" }}>Товарителница</span>
        <span style={{ background: badge.bg, color: badge.fg, fontSize: 11, padding: "3px 9px", borderRadius: 20, fontWeight: st === "cancelled" ? 700 : 400 }}>
          {st === "cancelled" ? "⚠ " : ""}{badge.text}
        </span>
        {mode === "demo" && <span title="demo.econt.com: тестова, не е истинска пратка" style={{ color: "#FAC775", fontSize: 10, letterSpacing: "0.12em" }}>DEMO</span>}
        {num && <span style={{ fontFamily: "monospace", fontSize: 13, color: st === "cancelled" ? "rgba(255,255,255,0.4)" : "#fff", textDecoration: st === "cancelled" ? "line-through" : "none" }}>{num}</span>}
        {st === "created" && num && (
          <button disabled={pending} onClick={() => act(() => labelPdf(order.id), true)} style={btn("#3B6D11", "#97C459")}>🖨 Печат PDF</button>
        )}
        {canCreate && !officeUnknown && (
          <button disabled={pending} onClick={() => act(() => createLabel(order.id, st === "error"))} style={btn("rgba(255,255,255,0.3)", "#fff")}>
            {st === "none" ? "Създай товарителница" : "Създай отново"}
          </button>
        )}
        {st === "pending" && (
          <button disabled={pending} title="Само ако виси повече от 5 минути: първо провери в Еконт дали не е създадена" onClick={() => act(() => createLabel(order.id, true))} style={btn("rgba(255,255,255,0.2)", "rgba(255,255,255,0.6)")}>Създай отново</button>
        )}
        {st === "created" && order.status === "confirmed" && (
          <button disabled={pending} onClick={() => { if (confirm(`Анулирай товарителница ${num} в Еконт?`)) act(() => cancelLabel(order.id)); }} style={btn("rgba(255,255,255,0.15)", "rgba(255,255,255,0.5)")}>Анулирай</button>
        )}
        {pending && <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>…</span>}
      </div>

      {st === "cancelled" && <p style={{ color: "#F09595", fontSize: 12, margin: "8px 0 0", fontWeight: 600 }}>Не пакетирай: поръчката е отказана и товарителницата е анулирана в Еконт.</p>}
      {order.econt_label_error && <p style={{ color: "#F09595", fontSize: 12, margin: "8px 0 0" }}>{order.econt_label_error}</p>}

      {officeUnknown && order.status === "confirmed" && (
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          {!offices ? (
            <button disabled={pending} onClick={() => start(async () => setOffices(await officeChoices(order.city)))} style={{ ...btn("rgba(255,255,255,0.3)", "#fff"), alignSelf: "flex-start" }}>Избери офис ръчно</button>
          ) : (
            <>
              <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Търси офис (име, адрес, код)" style={{ background: "rgba(255,255,255,0.05)", border: "0.5px solid rgba(255,255,255,0.2)", color: "#fff", borderRadius: 8, padding: "7px 10px", fontSize: 12 }} />
              <select value={pick} onChange={(e) => setPick(e.target.value)} style={{ background: "#0a0e1f", border: "0.5px solid rgba(255,255,255,0.2)", color: "#fff", borderRadius: 8, padding: "7px 10px", fontSize: 12 }}>
                <option value="">— избери офис ({shown.length}) —</option>
                {shown.map((o) => <option key={o.c} value={o.c}>{o.n} ({o.c}) · {o.a}</option>)}
              </select>
              <button disabled={pending || !pick} onClick={() => act(() => setLabelOffice(order.id, pick))} style={{ ...btn("#3B6D11", "#97C459"), alignSelf: "flex-start" }}>Запази офиса и Създай отново</button>
            </>
          )}
        </div>
      )}

      {msg && <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, margin: "8px 0 0" }}>{msg}</p>}
    </div>
  );
}
