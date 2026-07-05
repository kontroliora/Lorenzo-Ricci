"use client";
import { useState, useTransition } from "react";
import type { AdminOrder, CustomerHistory, StatusLogRow } from "@/lib/orders";
import {
  confirmOrder,
  cancelOrder,
  markNoAnswer,
  shipOrder,
  saveCallNotes,
  setInventoryCategory,
} from "./actions";

const STATUS_BADGE: Record<string, { label: string; bg: string; fg: string }> = {
  new:       { label: "Нова · за обаждане", bg: "#412402", fg: "#FAC775" },
  confirmed: { label: "Потвърдена",          bg: "#173404", fg: "#97C459" },
  shipped:   { label: "Изпратена",           bg: "#04342C", fg: "#5DCAA5" },
  completed: { label: "Завършена",           bg: "#0C447C", fg: "#85B7EB" },
  cancelled: { label: "Отказана",            bg: "#501313", fg: "#F09595" },
};

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("bg-BG", {
      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
      timeZone: "Europe/Sofia",
    });
  } catch { return iso; }
}

export function OrderCard({
  order,
  history,
  log,
}: {
  order: AdminOrder;
  history?: CustomerHistory;
  log?: StatusLogRow[];
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [tracking, setTracking] = useState(order.tracking_number ?? "");
  const [notes, setNotes] = useState(order.call_notes ?? "");

  const run = (fn: () => Promise<string | null>) =>
    start(async () => {
      setError("");
      const err = await fn();
      if (err) setError(err);
    });

  const badge = STATUS_BADGE[order.status] ?? STATUS_BADGE.new;
  const isActive = order.status === "new" || order.status === "confirmed";
  const digits = (order.phone ?? "").replace(/[^\d+]/g, "");
  const cod = /наложен|cod/i.test(order.notes ?? "") || true; // COD is the only method

  // Repeat-customer indicator (our data only). Red when refusals dominate.
  let histBadge: { text: string; bg: string; fg: string } | null = null;
  if (history) {
    if (history.total <= 1) {
      histBadge = { text: "Нов клиент", bg: "#173404", fg: "#97C459" };
    } else {
      const risky = history.refused >= 2 && history.refused >= history.taken;
      histBadge = {
        text: `Клиент: ${history.total} поръчки · ${history.taken} взети · ${history.refused} отказани`,
        bg: risky ? "#501313" : "rgba(255,255,255,0.06)",
        fg: risky ? "#F09595" : "rgba(255,255,255,0.6)",
      };
    }
  }

  const excluded = order.excluded_from_stock;
  const category: "fulfilled" | "active" | "excluded" =
    excluded ? "excluded" : order.status === "completed" ? "fulfilled" : "active";

  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: `0.5px solid ${excluded ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.1)"}`, borderRadius: 12, padding: "16px 18px", opacity: excluded ? 0.55 : 1 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ color: "#fff", fontSize: 15, fontWeight: 500 }}>
            {order.name || "—"}
            {order.order_ref && <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, marginLeft: 8, fontFamily: "monospace" }}>{order.order_ref}</span>}
          </div>
          {histBadge && (
            <span style={{ display: "inline-block", marginTop: 5, background: histBadge.bg, color: histBadge.fg, fontSize: 11, padding: "3px 8px", borderRadius: 20 }}>
              {histBadge.text}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <span style={{ background: badge.bg, color: badge.fg, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", padding: "4px 9px", borderRadius: 20 }}>{badge.label}</span>
          <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 12 }}>{fmtDate(order.created_at)}</span>
        </div>
      </div>

      {/* Phone */}
      <a href={`tel:${digits}`} style={{ display: "inline-flex", alignItems: "center", gap: 7, color: "#85B7EB", fontSize: 18, fontWeight: 500, textDecoration: "none", margin: "12px 0 12px" }}>
        ☎ {order.phone || "—"}
      </a>

      {/* Details */}
      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", lineHeight: 1.7 }}>
        <div>
          {(order.items ?? []).map((it, i) => (
            <span key={i}>{it.name} <span style={{ color: "rgba(255,255,255,0.4)" }}>× {it.quantity ?? it.qty ?? 1}</span>{i < order.items.length - 1 ? " · " : ""}</span>
          ))}
        </div>
        <div style={{ color: "#fff" }}>
          {order.shipping_method || (order.courier === "home" ? "Еконт до адрес" : "Еконт до офис")} — {order.address || "—"}{order.city ? `, ${order.city}` : ""}
        </div>
        <div style={{ color: "#fff", fontWeight: 500 }}>
          €{Number(order.total ?? 0).toFixed(2)}{cod && <span style={{ color: "rgba(255,255,255,0.4)", fontWeight: 400, fontSize: 12 }}> · наложен платеж</span>}
        </div>
      </div>

      {/* Inventory category — one-time reclassification + ongoing test/fake marking */}
      <div style={{ borderTop: "0.5px solid rgba(255,255,255,0.08)", marginTop: 14, paddingTop: 12 }}>
        <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 8 }}>Наличност</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {([
            { key: "fulfilled", label: "Изпълнена", on: "#3B6D11", fg: "#C0DD97" },
            { key: "active",    label: "Активна",   on: "#854F0B", fg: "#FAC775" },
            { key: "excluded",  label: "Изключена", on: "#5F5E5A", fg: "#D3D1C7" },
          ] as const).map((c) => {
            const sel = category === c.key;
            return (
              <button
                key={c.key}
                disabled={pending}
                onClick={() => run(() => setInventoryCategory(order.id, c.key))}
                style={{ border: `0.5px solid ${sel ? c.on : "rgba(255,255,255,0.15)"}`, color: sel ? c.fg : "rgba(255,255,255,0.45)", background: sel ? "rgba(255,255,255,0.05)" : "transparent", fontSize: 12, padding: "7px 13px", borderRadius: 8, cursor: "pointer" }}
              >
                {sel ? "● " : ""}{c.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Controls */}
      {(isActive || order.status === "shipped") && (
        <div style={{ borderTop: "0.5px solid rgba(255,255,255,0.08)", marginTop: 14, paddingTop: 14, display: "flex", flexDirection: "column", gap: 12 }}>
          {order.status === "new" && (
            <>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button disabled={pending} onClick={() => run(() => confirmOrder(order.id))} style={btn("#3B6D11", "#C0DD97", "rgba(59,109,17,0.12)")}>✓ Потвърждава</button>
                <button disabled={pending} onClick={() => run(() => markNoAnswer(order.id, order.call_attempts))} style={btn("#854F0B", "#FAC775", "rgba(133,79,11,0.12)")}>✆ Не вдига{order.call_attempts > 0 ? ` (${order.call_attempts})` : ""}</button>
                <button disabled={pending} onClick={() => run(() => cancelOrder(order.id))} style={btn("#A32D2D", "#F09595", "rgba(163,45,45,0.12)")}>✕ Отказва</button>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button disabled={pending} onClick={() => run(() => confirmOrder(order.id))} style={bigBtn(true)}>ПОТВЪРДИ</button>
                <button disabled={pending} onClick={() => run(() => cancelOrder(order.id))} style={bigBtn(false)}>ОТКАЖИ</button>
              </div>
            </>
          )}

          {(order.status === "confirmed" || order.status === "shipped") && (
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <input
                value={tracking}
                onChange={(e) => setTracking(e.target.value)}
                placeholder="Тракинг номер от Еконт…"
                disabled={order.status === "shipped"}
                style={{ flex: 1, minWidth: 160, background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "8px 12px", color: "#fff", fontSize: 13 }}
              />
              {order.status === "confirmed" ? (
                <button disabled={pending} onClick={() => run(() => shipOrder(order.id, tracking))} style={bigBtn(true)}>Маркирай изпратена</button>
              ) : (
                <span style={{ color: "#5DCAA5", fontSize: 12 }}>✓ Изпратена · тракинг {order.tracking_number}</span>
              )}
              {order.status === "confirmed" && (
                <button disabled={pending} onClick={() => run(() => cancelOrder(order.id))} style={bigBtn(false)}>ОТКАЖИ</button>
              )}
            </div>
          )}

          {/* Call notes */}
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => { if (notes !== (order.call_notes ?? "")) run(() => saveCallNotes(order.id, notes)); }}
              placeholder="Коментар — напр. звънна утре след 18ч"
              style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "8px 12px", color: "#fff", fontSize: 12 }}
            />
          </div>

          {error && <p style={{ color: "#F09595", fontSize: 12, margin: 0 }}>{error}</p>}
        </div>
      )}

      {/* Owner-only audit trail (RLS returns rows only to the owner) */}
      {log && log.length > 0 && (
        <div style={{ border: "0.5px solid #185FA5", background: "rgba(24,95,165,0.1)", borderRadius: 8, marginTop: 14, padding: "12px 14px" }}>
          <div style={{ color: "#85B7EB", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 9 }}>🔒 Одиторски лог · само owner</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7, fontFamily: "monospace", fontSize: 11.5, color: "rgba(255,255,255,0.7)" }}>
            {log.map((l, i) => (
              <div key={i}>
                <span style={{ color: "#F09595" }}>{l.old_status ?? "—"}</span> → <span style={{ color: "#5DCAA5" }}>{l.new_status}</span> · {l.changed_by_email ?? "—"} · {fmtDate(l.changed_at)} · промяна #{l.change_number}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function btn(border: string, color: string, bg: string): React.CSSProperties {
  return { display: "inline-flex", alignItems: "center", gap: 6, border: `0.5px solid ${border}`, color, background: bg, fontSize: 12, padding: "7px 13px", borderRadius: 8, cursor: "pointer" };
}
function bigBtn(primary: boolean): React.CSSProperties {
  return primary
    ? { flex: 1, textAlign: "center", background: "#3B6D11", color: "#fff", fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", padding: 11, borderRadius: 8, fontWeight: 500, border: "none", cursor: "pointer" }
    : { flex: 1, textAlign: "center", border: "0.5px solid #A32D2D", color: "#F09595", background: "transparent", fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", padding: 11, borderRadius: 8, cursor: "pointer" };
}
