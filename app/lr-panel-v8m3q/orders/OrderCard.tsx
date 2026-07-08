"use client";
import { useState, useEffect, useTransition } from "react";
import type { AdminOrder, CustomerHistory, StatusLogRow } from "@/lib/orders";
import {
  confirmOrder,
  cancelOrder,
  markNoAnswer,
  shipOrder,
  markCompleted,
  markReturned,
  markReturnReviewed,
  setFake,
  saveCallNotes,
} from "./actions";

const STATUS_BADGE: Record<string, { label: string; bg: string; fg: string }> = {
  new:       { label: "Нова · за обаждане", bg: "#412402", fg: "#FAC775" },
  confirmed: { label: "За изпълнение",       bg: "#173404", fg: "#97C459" },
  shipped:   { label: "Изпратена",           bg: "#04342C", fg: "#5DCAA5" },
  completed: { label: "Завършена",           bg: "#0C447C", fg: "#85B7EB" },
  cancelled: { label: "Отказана",            bg: "#501313", fg: "#F09595" },
  returned:  { label: "Върната",             bg: "#4A1B0C", fg: "#F0997B" },
};

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("bg-BG", {
      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Sofia",
    });
  } catch { return iso; }
}

const outlineBtn = (border: string, color: string): React.CSSProperties => ({
  display: "inline-flex", alignItems: "center", gap: 6, border: `0.5px solid ${border}`, color,
  background: "transparent", fontSize: 12, padding: "8px 14px", borderRadius: 8, cursor: "pointer",
});
const primaryBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6, background: "#3B6D11", color: "#fff",
  border: "none", fontSize: 12, padding: "8px 16px", borderRadius: 8, fontWeight: 500, cursor: "pointer",
};

export function OrderCard({
  order, history, log,
}: {
  order: AdminOrder;
  history?: CustomerHistory;
  log?: StatusLogRow[];
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [tracking, setTracking] = useState(order.tracking_number ?? "");
  const [notes, setNotes] = useState(order.call_notes ?? "");
  const [hoursOpen, setHoursOpen] = useState<number | null>(null);

  const [lastAttemptH, setLastAttemptH] = useState<number | null>(null);

  // Age is a visual warning only — it never touches the reservation.
  useEffect(() => {
    setHoursOpen((Date.now() - new Date(order.created_at).getTime()) / 3_600_000);
  }, [order.created_at]);

  // "Не вдига" — how long since the last no-answer attempt (visual only).
  useEffect(() => {
    if (!order.last_attempt_at) { setLastAttemptH(null); return; }
    setLastAttemptH((Date.now() - new Date(order.last_attempt_at).getTime()) / 3_600_000);
  }, [order.last_attempt_at]);

  // Never let an action error bubble to React's error boundary (which shows the
  // "client-side exception" full-page crash). Always surface it as inline text.
  const run = (fn: () => Promise<string | null>) =>
    start(async () => {
      setError("");
      try {
        const err = await fn();
        if (err) setError(err);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Възникна грешка. Опитай пак.");
      }
    });

  const badge = STATUS_BADGE[order.status] ?? STATUS_BADGE.new;
  const excluded = order.excluded_from_stock;
  const digits = (order.phone ?? "").replace(/[^\d+]/g, "");

  let histBadge: { text: string; bg: string; fg: string };
  if (history && (history.confirmed || history.refused || history.notTaken)) {
    const risky = history.notTaken >= 2 || (history.notTaken > 0 && history.notTaken >= history.confirmed);
    histBadge = {
      text: `Клиент: потвърдил ${history.confirmed} · отказал ${history.refused} · невзел ${history.notTaken}`,
      bg: risky ? "#501313" : "rgba(255,255,255,0.06)",
      fg: risky ? "#F09595" : "rgba(255,255,255,0.6)",
    };
  } else {
    histBadge = { text: "Нов клиент", bg: "#173404", fg: "#97C459" };
  }

  const fakeLink = (
    <button
      disabled={pending}
      onClick={() => run(() => setFake(order.id, true))}
      style={{ background: "none", border: "none", color: "rgba(255,255,255,0.28)", fontSize: 11, borderBottom: "1px dotted rgba(255,255,255,0.25)", cursor: "pointer", padding: 0 }}
    >
      маркирай като фалшива / тестова
    </button>
  );

  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: `0.5px solid ${excluded ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.1)"}`, borderRadius: 12, padding: "16px 18px", opacity: excluded ? 0.55 : 1 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ color: "#fff", fontSize: 15, fontWeight: 500 }}>
            {order.name || "—"}
            {order.order_ref && <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, marginLeft: 8, fontFamily: "monospace" }}>{order.order_ref}</span>}
          </div>
          <span style={{ display: "inline-block", marginTop: 5, background: histBadge.bg, color: histBadge.fg, fontSize: 11, padding: "3px 9px", borderRadius: 20 }}>{histBadge.text}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          {excluded && <span style={{ background: "#2C2C2A", color: "#D3D1C7", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", padding: "4px 9px", borderRadius: 20 }}>Фалшива</span>}
          <span style={{ background: badge.bg, color: badge.fg, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", padding: "4px 9px", borderRadius: 20 }}>{badge.label}</span>
          <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 12 }}>{fmtDate(order.created_at)}</span>
        </div>
      </div>

      {/* Phone */}
      <a href={`tel:${digits}`} style={{ display: "inline-flex", alignItems: "center", gap: 7, color: "#85B7EB", fontSize: 18, fontWeight: 500, textDecoration: "none", margin: "12px 0 12px" }}>☎ {order.phone || "—"}</a>

      {/* Details */}
      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", lineHeight: 1.7 }}>
        <div>{(order.items ?? []).map((it, i) => (<span key={i}>{it.name} <span style={{ color: "rgba(255,255,255,0.4)" }}>× {it.quantity ?? it.qty ?? 1}</span>{i < order.items.length - 1 ? " · " : ""}</span>))}</div>
        <div style={{ color: "#fff" }}>{order.shipping_method || (order.courier === "home" ? "Еконт до адрес" : "Еконт до офис")} — {order.address || "—"}{order.city ? `, ${order.city}` : ""}</div>
        <div style={{ color: "#fff", fontWeight: 500 }}>€{Number(order.total ?? 0).toFixed(2)}<span style={{ color: "rgba(255,255,255,0.4)", fontWeight: 400, fontSize: 12 }}> · наложен платеж</span></div>
        {order.status === "new" && !excluded && hoursOpen !== null && (
          <div style={{ color: hoursOpen > 24 ? "#F09595" : "rgba(255,255,255,0.4)", fontSize: 11, marginTop: 4 }}>
            ⏱ отворена преди {Math.floor(hoursOpen)}ч{hoursOpen > 24 ? " · заседнала" : ""}
          </div>
        )}
        {order.status === "new" && !excluded && order.call_attempts > 0 && (
          <div style={{ color: "#FAC775", fontSize: 11, marginTop: 4 }}>
            ✆ {order.call_attempts} {order.call_attempts === 1 ? "опит" : "опита"} за връзка
            {lastAttemptH !== null ? ` · последен преди ${Math.floor(lastAttemptH)}ч` : ""}
          </div>
        )}
      </div>

      {/* Controls — single flow, one action set per stage */}
      {excluded ? (
        <div style={{ borderTop: "0.5px solid rgba(255,255,255,0.08)", marginTop: 14, paddingTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>Маркирана като фалшива/тестова · не се брои в наличността</span>
          <button disabled={pending} onClick={() => run(() => setFake(order.id, false))} style={outlineBtn("rgba(255,255,255,0.2)", "rgba(255,255,255,0.6)")}>Върни в реални</button>
        </div>
      ) : (
        <div style={{ borderTop: "0.5px solid rgba(255,255,255,0.08)", marginTop: 14, paddingTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
          {order.status === "new" && (
            <>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase" }}>Резултат от обаждането</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button disabled={pending} onClick={() => run(() => confirmOrder(order.id))} style={primaryBtn}>✓ Потвърждава</button>
                <button onClick={() => run(() => markNoAnswer(order.id))} style={outlineBtn("#854F0B", "#FAC775")}>✆ Не вдига{order.call_attempts > 0 ? ` (${order.call_attempts})` : ""}</button>
                <button disabled={pending} onClick={() => run(() => cancelOrder(order.id))} style={outlineBtn("#A32D2D", "#F09595")}>✕ Отказва</button>
              </div>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => { if (notes !== (order.call_notes ?? "")) run(() => saveCallNotes(order.id, notes)); }} placeholder="Коментар — напр. звънна утре след 18ч" style={{ background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "8px 12px", color: "#fff", fontSize: 12 }} />
              <div>{fakeLink}</div>
            </>
          )}

          {order.status === "confirmed" && (
            <>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase" }}>Пакетиране и изпращане</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="Тракинг номер от Еконт…" style={{ flex: 1, minWidth: 150, background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "8px 12px", color: "#fff", fontSize: 13 }} />
                <button disabled={pending} onClick={() => run(() => shipOrder(order.id, tracking))} style={primaryBtn}>Маркирай изпратена</button>
                <button disabled={pending} onClick={() => run(() => cancelOrder(order.id))} style={outlineBtn("#A32D2D", "#F09595")}>Откажи</button>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <span style={{ color: "#FAC775", fontSize: 11 }}>⚠ без тракинг не може да стане изпратена</span>
                {fakeLink}
              </div>
            </>
          )}

          {order.status === "shipped" && (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}>Тракинг {order.tracking_number} · чака Еконт да потвърди взимане</span>
                <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button disabled={pending} onClick={() => run(() => markCompleted(order.id))} style={outlineBtn("rgba(255,255,255,0.2)", "rgba(255,255,255,0.6)")}>Ръчно завършена</button>
                  <button disabled={pending} onClick={() => run(() => markReturned(order.id))} style={outlineBtn("#A32D2D", "#F09595")}>Върната / невзета</button>
                </span>
              </div>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => { if (notes !== (order.call_notes ?? "")) run(() => saveCallNotes(order.id, notes)); }} placeholder="Бележка — напр. клиентът каза да достави след 18ч" style={{ background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "8px 12px", color: "#fff", fontSize: 12 }} />
            </>
          )}

          {order.status === "returned" && order.return_reviewed !== undefined && (
            order.return_reviewed ? (
              <span style={{ color: "#97C459", fontSize: 12 }}>✓ Прегледана · стоката е върната в наличност</span>
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <span style={{ color: "#FAC775", fontSize: 12 }}>⏳ Чака преглед на върнатата стока</span>
                <button disabled={pending} onClick={() => run(() => markReturnReviewed(order.id))} style={primaryBtn}>Маркирай прегледана</button>
              </div>
            )
          )}

          {error && <p style={{ color: "#F09595", fontSize: 12, margin: 0 }}>{error}</p>}
        </div>
      )}

      {/* Owner-only audit trail (RLS returns rows only to the owner) */}
      {log && log.length > 0 && (
        <div style={{ border: "0.5px solid #185FA5", background: "rgba(24,95,165,0.1)", borderRadius: 8, marginTop: 14, padding: "12px 14px" }}>
          <div style={{ color: "#85B7EB", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 9 }}>🔒 Одиторски лог · само owner</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7, fontFamily: "monospace", fontSize: 11.5, color: "rgba(255,255,255,0.7)" }}>
            {log.map((l, i) => (<div key={i}><span style={{ color: "#F09595" }}>{l.old_status ?? "—"}</span> → <span style={{ color: "#5DCAA5" }}>{l.new_status}</span> · {l.changed_by_email ?? "—"} · {fmtDate(l.changed_at)} · промяна #{l.change_number}</div>))}
          </div>
        </div>
      )}
    </div>
  );
}
