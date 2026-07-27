"use client";
import { useState, useTransition } from "react";
import type { AdminOrder, CustomerHistory } from "@/lib/orders";
import { confirmOrders, cancelOrders, markNoAnswerOrders } from "./actions";
import { OrderItemsList } from "./OrderItemsList";

function fmtDT(iso: string): string {
  try {
    return new Date(iso).toLocaleString("bg-BG", {
      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Sofia",
    });
  } catch { return iso; }
}

const primaryBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6, background: "#3B6D11", color: "#fff",
  border: "none", fontSize: 12, padding: "8px 16px", borderRadius: 8, fontWeight: 500, cursor: "pointer",
};
const outlineBtn = (border: string, color: string): React.CSSProperties => ({
  display: "inline-flex", alignItems: "center", gap: 6, border: `0.5px solid ${border}`, color,
  background: "transparent", fontSize: 12, padding: "8px 14px", borderRadius: 8, cursor: "pointer",
});
const pillBtn: React.CSSProperties = {
  border: "0.5px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.85)", background: "rgba(255,255,255,0.04)",
  fontSize: 12, padding: "7px 12px", borderRadius: 20, cursor: "pointer",
};
const backLink: React.CSSProperties = {
  background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 11, cursor: "pointer", padding: 0, textAlign: "left",
};

// Merged view of 2+ NEW orders from the same customer with an IDENTICAL address.
// Actions apply to every order in the group at once. Nothing is merged in the DB.
export function GroupedOrderCard({
  orders, history, onSplit,
}: {
  orders: AdminOrder[];
  history?: CustomerHistory;
  onSplit: () => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [cancelStep, setCancelStep] = useState<"closed" | "category" | "refuse" | "other">("closed");
  const [cancelText, setCancelText] = useState("");

  const sorted = [...orders].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const last = sorted[sorted.length - 1]; // name + address come from the most recent order
  const ids = sorted.map((o) => o.id);
  const n = sorted.length;
  const total = sorted.reduce((s, o) => s + Number(o.total ?? 0), 0);
  const allItems = sorted.flatMap((o) => o.items ?? []);
  const promoCodes = Array.from(new Set(sorted.map((o) => o.promo_code).filter(Boolean))) as string[];
  const digits = (last.phone ?? "").replace(/[^\d+]/g, "");

  // Summed стока/доставка — only when EVERY order in the group has a reconciling
  // split, else a mix of legacy + new rows would under-count. Falls back to the
  // total-only line (same guard idea as OrderCard).
  const allHaveBreakdown = sorted.every((o) => {
    const s = o.subtotal != null ? Number(o.subtotal) : null;
    return s != null && s > 0 && Math.abs(s + Number(o.shipping_cost ?? 0) - Number(o.total ?? 0)) < 0.01;
  });
  const groupSub  = allHaveBreakdown ? sorted.reduce((s, o) => s + Number(o.subtotal ?? 0), 0) : null;
  const groupShip = allHaveBreakdown ? sorted.reduce((s, o) => s + Number(o.shipping_cost ?? 0), 0) : 0;

  const run = (fn: () => Promise<string | null>) =>
    start(async () => {
      setError("");
      try { const e = await fn(); if (e) setError(e); }
      catch (e) { setError(e instanceof Error ? e.message : "Възникна грешка. Опитай пак."); }
    });
  const doCancel = (category: string, reason: string) =>
    run(async () => {
      const err = await cancelOrders(ids, category, reason);
      if (!err) { setCancelStep("closed"); setCancelText(""); }
      return err;
    });

  let histBadge: { text: string; bg: string; fg: string };
  if (history && (history.confirmed || history.refused || history.notTaken)) {
    const risky = history.notTaken >= 2 || (history.notTaken > 0 && history.notTaken >= history.confirmed);
    histBadge = {
      text: `Клиент: потвърдил ${history.confirmed} · отказал ${history.refused} · невзел ${history.notTaken}`,
      bg: risky ? "#501313" : "rgba(255,255,255,0.06)", fg: risky ? "#F09595" : "rgba(255,255,255,0.6)",
    };
  } else {
    histBadge = { text: "Нов клиент", bg: "#173404", fg: "#97C459" };
  }

  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(93,202,165,0.4)", borderRadius: 12, padding: "16px 18px", boxShadow: "5px 5px 0 -2px rgba(255,255,255,0.03), 3px 3px 0 -1px rgba(93,202,165,0.15)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ color: "#fff", fontSize: 15, fontWeight: 500, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {last.name || "—"}
            <span style={{ background: "rgba(93,202,165,0.15)", color: "#5DCAA5", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", padding: "3px 9px", borderRadius: 20, border: "0.5px solid rgba(93,202,165,0.4)" }}>◈ {n} поръчки</span>
          </div>
          <span style={{ display: "inline-block", marginTop: 6, background: histBadge.bg, color: histBadge.fg, fontSize: 11, padding: "3px 9px", borderRadius: 20 }}>{histBadge.text}</span>
        </div>
        <span style={{ background: "#412402", color: "#FAC775", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", padding: "4px 9px", borderRadius: 20 }}>Нова · за обаждане</span>
      </div>

      {/* Phone */}
      <a href={`tel:${digits}`} style={{ display: "inline-flex", alignItems: "center", gap: 7, color: "#85B7EB", fontSize: 18, fontWeight: 500, textDecoration: "none", margin: "12px 0" }}>☎ {last.phone || "—"}</a>

      {/* Details */}
      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", lineHeight: 1.7 }}>
        <OrderItemsList items={allItems} />
        <div style={{ color: "#fff" }}>{last.shipping_method || (last.courier === "home" ? "Еконт до адрес" : "Еконт до офис")} — {last.address || "—"}{last.city ? `, ${last.city}` : ""}</div>
        {groupSub != null && (
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 2, display: "flex", gap: 14, flexWrap: "wrap" }}>
            <span>Стока: <span style={{ color: "rgba(255,255,255,0.8)" }}>€{groupSub.toFixed(2)}</span></span>
            <span>Доставка: <span style={{ color: "rgba(255,255,255,0.8)" }}>{groupShip > 0 ? `€${groupShip.toFixed(2)}` : "безплатна"}</span></span>
          </div>
        )}
        <div style={{ color: "#fff", fontWeight: 500 }}>€{total.toFixed(2)}<span style={{ color: "rgba(255,255,255,0.4)", fontWeight: 400, fontSize: 12 }}> · обща сума от {n}-те</span></div>
        {promoCodes.length > 0 && (
          <div style={{ marginTop: 4, fontSize: 12, color: "#C0DD97" }}>
            ◈ Промо {promoCodes.length > 1 ? "кодове" : "код"}: <span style={{ fontFamily: "monospace", color: "#fff", letterSpacing: "0.04em" }}>{promoCodes.join(" · ")}</span>
          </div>
        )}
        <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginTop: 4, fontFamily: "monospace" }}>
          Поръчано на {n} пъти: {sorted.map((o) => fmtDT(o.created_at)).join(" · ")} · {sorted.map((o) => o.order_ref).filter(Boolean).join(" · ")}
        </div>
      </div>

      {/* Controls — apply to all orders in the group */}
      <div style={{ borderTop: "0.5px solid rgba(255,255,255,0.08)", marginTop: 14, paddingTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
        {cancelStep === "closed" ? (
          <>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase" }}>Резултат от обаждането · за {n}-те наведнъж</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <button disabled={pending} onClick={() => run(() => confirmOrders(ids))} style={primaryBtn}>✓ Потвърждава {n}-те</button>
              <button disabled={pending} onClick={() => run(() => markNoAnswerOrders(ids))} style={outlineBtn("#854F0B", "#FAC775")}>✆ Не вдига</button>
              <button onClick={() => setCancelStep("category")} style={outlineBtn("#A32D2D", "#F09595")}>✕ Отказва</button>
              <button onClick={onSplit} style={{ ...backLink, marginLeft: "auto", borderBottom: "1px dotted rgba(255,255,255,0.3)" }}>раздели</button>
            </div>
          </>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {cancelStep === "category" && (
              <>
                <span style={{ color: "#F09595", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase" }}>Причина за отказ · за {n}-те</span>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button onClick={() => setCancelStep("refuse")} style={pillBtn}>Отказа по телефон</button>
                  <button onClick={() => doCancel("unreachable", "не вдига 3+ опита")} style={pillBtn}>Не вдига 3+ опита</button>
                  <button onClick={() => doCancel("wrong_number", "")} style={pillBtn}>Грешен / невалиден номер</button>
                  <button onClick={() => setCancelStep("other")} style={pillBtn}>Друго</button>
                </div>
                <button onClick={() => setCancelStep("closed")} style={backLink}>← назад</button>
              </>
            )}
            {cancelStep === "refuse" && (
              <>
                <span style={{ color: "#F09595", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase" }}>Защо отказа клиентът?</span>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {["размисли", "цена висока", "намерил по-евтино", "не помни да е поръчвал", "друго"].map((r) => (
                    <button key={r} onClick={() => doCancel("refused", r)} style={pillBtn}>{r}</button>
                  ))}
                </div>
                <button onClick={() => setCancelStep("category")} style={backLink}>← назад</button>
              </>
            )}
            {cancelStep === "other" && (
              <>
                <span style={{ color: "#F09595", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase" }}>Причина (свободен текст)</span>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <input value={cancelText} onChange={(e) => setCancelText(e.target.value)} placeholder="Опиши причината…" style={{ flex: 1, minWidth: 160, background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "8px 12px", color: "#fff", fontSize: 12 }} />
                  <button onClick={() => doCancel("other", cancelText.trim() || "друго")} style={primaryBtn}>Запази отказа</button>
                </div>
                <button onClick={() => setCancelStep("category")} style={backLink}>← назад</button>
              </>
            )}
          </div>
        )}
        {error && <p style={{ color: "#F09595", fontSize: 12, margin: 0 }}>{error}</p>}
      </div>
    </div>
  );
}
