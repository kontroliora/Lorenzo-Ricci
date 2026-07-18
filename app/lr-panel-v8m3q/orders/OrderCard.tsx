"use client";
import { useState, useEffect, useTransition } from "react";
import type { AdminOrder, CustomerHistory, StatusLogRow } from "@/lib/orders";
import { isReturn } from "@/lib/orders";
import {
  confirmOrder,
  cancelOrder,
  markNoAnswer,
  shipOrder,
  markCompleted,
  markReturned,
  markRestocked,
  setFake,
  addOrderNote,
} from "./actions";
import { callTimer, sofiaHHMM, formatAttemptList, formatAttemptAudit } from "@/lib/callSchedule";
import { OrderItemsList } from "./OrderItemsList";

const STATUS_BADGE: Record<string, { label: string; bg: string; fg: string }> = {
  new:       { label: "Нова · за обаждане", bg: "#412402", fg: "#FAC775" },
  confirmed: { label: "За изпълнение",       bg: "#173404", fg: "#97C459" },
  shipped:   { label: "Изпратена",           bg: "#04342C", fg: "#5DCAA5" },
  completed: { label: "Завършена",           bg: "#0C447C", fg: "#85B7EB" },
  cancelled: { label: "Отказана",            bg: "#501313", fg: "#F09595" },
  returned:  { label: "Върната",             bg: "#4A1B0C", fg: "#F0997B" },
  returning: { label: "Връща се",            bg: "#4A1B0C", fg: "#F0997B" },
  restocked: { label: "Върната · в наличност", bg: "#173404", fg: "#97C459" },
};

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("bg-BG", {
      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Sofia",
    });
  } catch { return iso; }
}

// A stored comment line looks like "[8 юли 14:30] текст"; split the stamp off
// for styling. Old plain-text notes (no stamp) render as-is.
function splitNote(line: string): { stamp: string | null; text: string } {
  const m = line.match(/^\[([^\]]+)\]\s*(.*)$/);
  return m ? { stamp: m[1], text: m[2] || "" } : { stamp: null, text: line };
}

const outlineBtn = (border: string, color: string): React.CSSProperties => ({
  display: "inline-flex", alignItems: "center", gap: 6, border: `0.5px solid ${border}`, color,
  background: "transparent", fontSize: 12, padding: "8px 14px", borderRadius: 8, cursor: "pointer",
});
const primaryBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6, background: "#3B6D11", color: "#fff",
  border: "none", fontSize: 12, padding: "8px 16px", borderRadius: 8, fontWeight: 500, cursor: "pointer",
};
const pillBtn: React.CSSProperties = {
  border: "0.5px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.85)", background: "rgba(255,255,255,0.04)",
  fontSize: 12, padding: "7px 12px", borderRadius: 20, cursor: "pointer",
};
const backLink: React.CSSProperties = {
  background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 11, cursor: "pointer", padding: 0, textAlign: "left",
};

export function OrderCard({
  order, history, log, now,
}: {
  order: AdminOrder;
  history?: CustomerHistory;
  log?: StatusLogRow[];
  now: number;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [tracking, setTracking] = useState(order.tracking_number ?? "");
  const [noteDraft, setNoteDraft] = useState("");
  const [hoursOpen, setHoursOpen] = useState<number | null>(null);

  const [cancelStep, setCancelStep] = useState<"closed" | "category" | "refuse" | "other">("closed");
  const [cancelText, setCancelText] = useState("");

  // Age is a visual warning only — it never touches the reservation.
  useEffect(() => {
    setHoursOpen((Date.now() - new Date(order.created_at).getTime()) / 3_600_000);
  }, [order.created_at]);

  // Visual call timer (guidance only, no penalty) — derived from the schedule
  // windows + this order's own attempt data. Recomputes as `now` ticks upstream.
  const attemptTimes = (order.call_attempt_times ?? []).filter(Boolean);
  const lastAttemptMs = order.last_attempt_at
    ? Date.parse(order.last_attempt_at)
    : (attemptTimes.length ? Date.parse(attemptTimes[attemptTimes.length - 1]) : null);
  const timer = order.status === "new" && !order.excluded_from_stock
    ? callTimer(order.call_attempts ?? 0, lastAttemptMs, now)
    : null;
  const isDue = timer?.status === "due";

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

  // Close the picker only if the cancel actually succeeded — on error the run()
  // helper surfaces it inline and we stay put (no silent "looks like it worked").
  const doCancel = (category: string, reason: string) =>
    run(async () => {
      const err = await cancelOrder(order.id, category, reason);
      if (!err) { setCancelStep("closed"); setCancelText(""); }
      return err;
    });

  const badge = STATUS_BADGE[order.status] ?? STATUS_BADGE.new;
  const excluded = order.excluded_from_stock;
  const digits = (order.phone ?? "").replace(/[^\d+]/g, "");

  // Notes shown on every card, every status, to owner AND employee. Two sources:
  // the note from "Създай поръчка" (order.notes) + appended call comments
  // (order.call_notes, newline-separated history). Nothing is ever hidden.
  const creationNote = (order.notes ?? "").trim();
  const commentLines = (order.call_notes ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
  const hasNotes = creationNote.length > 0 || commentLines.length > 0;
  const noteCount = commentLines.length + (creationNote ? 1 : 0);
  const addNote = () => run(async () => {
    const t = noteDraft.trim();
    if (!t) return null;
    const err = await addOrderNote(order.id, t);
    if (!err) setNoteDraft("");
    return err;
  });

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
    <div style={{ background: isDue ? "rgba(151,196,89,0.06)" : "rgba(255,255,255,0.03)", border: `${isDue ? "1px" : "0.5px"} solid ${excluded ? "rgba(255,255,255,0.06)" : isDue ? "#97C459" : "rgba(255,255,255,0.1)"}`, borderRadius: 12, padding: "16px 18px", opacity: excluded ? 0.55 : 1 }}>
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
          {order.is_manual && <span style={{ background: "#3C3489", color: "#CECBF6", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", padding: "4px 9px", borderRadius: 20 }}>Ръчна</span>}
          <span style={{ background: badge.bg, color: badge.fg, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", padding: "4px 9px", borderRadius: 20 }}>{badge.label}</span>
          <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 12 }}>{fmtDate(order.created_at)}</span>
        </div>
      </div>

      {/* Phone */}
      <a href={`tel:${digits}`} style={{ display: "inline-flex", alignItems: "center", gap: 7, color: "#85B7EB", fontSize: 18, fontWeight: 500, textDecoration: "none", margin: "12px 0 12px" }}>☎ {order.phone || "—"}</a>

      {/* Details */}
      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", lineHeight: 1.7 }}>
        <OrderItemsList items={order.items ?? []} />
        <div style={{ color: "#fff" }}>{order.shipping_method || (order.courier === "home" ? "Еконт до адрес" : "Еконт до офис")} — {order.address || "—"}{order.city ? `, ${order.city}` : ""}</div>
        <div style={{ color: "#fff", fontWeight: 500 }}>€{Number(order.total ?? 0).toFixed(2)}<span style={{ color: "rgba(255,255,255,0.4)", fontWeight: 400, fontSize: 12 }}> · наложен платеж</span></div>
        {order.promo_code && (
          <div style={{ marginTop: 4, fontSize: 12, color: "#C0DD97" }}>
            ◈ Промо код: <span style={{ fontFamily: "monospace", color: "#fff", letterSpacing: "0.04em" }}>{order.promo_code}</span>
            {order.promo_discount ? <span style={{ color: "rgba(255,255,255,0.5)" }}> · отстъпка −€{Number(order.promo_discount).toFixed(2)}</span> : null}
          </div>
        )}
        {order.status === "new" && !excluded && hoursOpen !== null && (
          <div style={{ color: hoursOpen > 24 ? "#F09595" : "rgba(255,255,255,0.4)", fontSize: 11, marginTop: 4 }}>
            ⏱ отворена преди {Math.floor(hoursOpen)}ч{hoursOpen > 24 ? " · заседнала" : ""}
          </div>
        )}
        {isReturn(order.status) && (
          <div style={{ fontSize: 12, marginTop: 4 }}>
            {order.return_kind === "uncollected" ? (
              <span style={{ color: "#F0997B" }}>↩ Непотърсена{order.return_dwell_days != null ? ` · върната след ${order.return_dwell_days} дни` : ""}</span>
            ) : order.return_kind === "refused" ? (
              <span style={{ color: "rgba(255,255,255,0.6)" }}>↩ Върната след преглед{order.return_dwell_days != null ? ` · след ${order.return_dwell_days} дни` : ""}</span>
            ) : (
              <span style={{ color: "rgba(255,255,255,0.5)" }}>↩ Върната{order.return_dwell_days != null ? ` · след ${order.return_dwell_days} дни` : " · класифицира се на следващия Econt синх."}</span>
            )}
          </div>
        )}
        {timer && (
          <div style={{ fontSize: 12, marginTop: 5, lineHeight: 1.55 }}>
            {timer.status === "due" ? (
              <div style={{ color: "#C0DD97", fontWeight: 500 }}>
                ✆ Звънни сега · прозорец {timer.activeLabel}
                {(order.call_attempts ?? 0) > 0
                  ? <span style={{ color: "rgba(255,255,255,0.55)", fontWeight: 400 }}> · {formatAttemptList(attemptTimes)}</span>
                  : <span style={{ color: "rgba(192,221,151,0.7)", fontWeight: 400 }}> · още няма опит</span>}
              </div>
            ) : timer.status === "called_this_window" ? (
              <div style={{ color: "#FAC775" }}>
                ✆ Не вдига (опит {order.call_attempts}){lastAttemptMs ? ` · звъннал в ${sofiaHHMM(lastAttemptMs)}` : ""} → следващо обаждане: {timer.next.when} {timer.next.label}
              </div>
            ) : timer.status === "exhausted" ? (
              <div style={{ color: "#F0997B" }}>
                ✆ 3 опита · {formatAttemptList(attemptTimes)} · чака ръчно затваряне
              </div>
            ) : (
              <div style={{ color: "rgba(255,255,255,0.6)" }}>
                ✆ Следващо обаждане: {timer.next.when} {timer.next.label}
                {attemptTimes.length > 0 && <span style={{ color: "rgba(255,255,255,0.5)" }}> · {formatAttemptList(attemptTimes)}</span>}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Notes — always visible, every status; seen by owner AND employee */}
      <div style={{ marginTop: 14 }}>
        {hasNotes && (
          <div style={{ background: "rgba(250,199,117,0.1)", border: "0.5px solid rgba(250,199,117,0.35)", borderRadius: 8, padding: "10px 12px", marginBottom: excluded ? 0 : 8 }}>
            <div style={{ color: "#FAC775", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 6 }}>
              {noteCount > 1 ? "Бележки" : "Бележка"}
            </div>
            {creationNote && (
              <div style={{ color: "#fff", fontSize: 13, lineHeight: 1.55 }}>
                {creationNote}
                <span style={{ color: "rgba(250,199,117,0.7)", fontSize: 10, marginLeft: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>от създаването</span>
              </div>
            )}
            {commentLines.map((ln, i) => {
              const { stamp, text } = splitNote(ln);
              const first = i === 0 && !creationNote;
              return (
                <div key={i} style={{ color: "rgba(255,255,255,0.9)", fontSize: 13, lineHeight: 1.55, marginTop: first ? 0 : 5, paddingTop: first ? 0 : 5, borderTop: first ? "none" : "0.5px solid rgba(255,255,255,0.08)" }}>
                  {stamp && <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginRight: 6 }}>{stamp}</span>}
                  {text}
                </div>
              );
            })}
          </div>
        )}
        {!excluded && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addNote(); } }}
              placeholder="Добави коментар…"
              style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "8px 12px", color: "#fff", fontSize: 12 }}
            />
            {noteDraft.trim() && (
              <button disabled={pending} onClick={addNote} style={{ background: "rgba(250,199,117,0.15)", border: "0.5px solid rgba(250,199,117,0.4)", color: "#FAC775", fontSize: 12, padding: "8px 14px", borderRadius: 8, cursor: "pointer", whiteSpace: "nowrap" }}>Добави</button>
            )}
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
          {cancelStep === "closed" && order.status === "new" && (
            <>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase" }}>Резултат от обаждането</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button disabled={pending} onClick={() => run(() => confirmOrder(order.id))} style={primaryBtn}>✓ Потвърждава</button>
                <button disabled={pending} onClick={() => run(() => markNoAnswer(order.id))} style={outlineBtn("#854F0B", "#FAC775")}>✆ Не вдига{order.call_attempts > 0 ? ` (${order.call_attempts})` : ""}</button>
                <button onClick={() => setCancelStep("category")} style={outlineBtn("#A32D2D", "#F09595")}>✕ Отказва</button>
              </div>
              <div>{fakeLink}</div>
            </>
          )}

          {cancelStep === "closed" && order.status === "confirmed" && (
            <>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase" }}>Пакетиране и изпращане</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="Тракинг номер от Еконт…" style={{ flex: 1, minWidth: 150, background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "8px 12px", color: "#fff", fontSize: 13 }} />
                <button disabled={pending} onClick={() => run(() => shipOrder(order.id, tracking))} style={primaryBtn}>Маркирай изпратена</button>
                <button onClick={() => setCancelStep("category")} style={outlineBtn("#A32D2D", "#F09595")}>Откажи</button>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <span style={{ color: "#FAC775", fontSize: 11 }}>⚠ без тракинг не може да стане изпратена</span>
                {fakeLink}
              </div>
            </>
          )}

          {cancelStep === "closed" && order.status === "shipped" && (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}>Тракинг {order.tracking_number} · чака Еконт да потвърди взимане</span>
                <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button disabled={pending} onClick={() => run(() => markCompleted(order.id))} style={outlineBtn("rgba(255,255,255,0.2)", "rgba(255,255,255,0.6)")}>Ръчно завършена</button>
                  <button disabled={pending} onClick={() => run(() => markReturned(order.id))} style={outlineBtn("#A32D2D", "#F09595")}>Върната / невзета</button>
                </span>
              </div>
            </>
          )}

          {cancelStep === "closed" && order.status === "returning" && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <span style={{ color: "#FAC775", fontSize: 12 }}>⏳ Чака да я получа обратно от Еконт</span>
              <button disabled={pending} onClick={() => run(() => markRestocked(order.id))} style={primaryBtn}>Взех пратката</button>
            </div>
          )}

          {cancelStep === "closed" && order.status === "restocked" && (
            <span style={{ color: "#97C459", fontSize: 12 }}>
              ✓ Взета · стоката е върната в наличност
              {order.restocked_at ? ` · ${fmtDate(order.restocked_at)}` : ""}
              {order.restocked_source ? ` · ${order.restocked_source === "cron" ? "авто от Еконт" : "ръчно"}` : ""}
            </span>
          )}

          {cancelStep !== "closed" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {cancelStep === "category" && (
                <>
                  <span style={{ color: "#F09595", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase" }}>Причина за отказ</span>
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
      )}

      {/* Owner-only audit trail (RLS returns rows only to the owner) */}
      {log && log.length > 0 && (
        <div style={{ border: "0.5px solid #185FA5", background: "rgba(24,95,165,0.1)", borderRadius: 8, marginTop: 14, padding: "12px 14px" }}>
          <div style={{ color: "#85B7EB", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 9 }}>🔒 Одиторски лог · само owner</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7, fontFamily: "monospace", fontSize: 11.5, color: "rgba(255,255,255,0.7)" }}>
            {log.map((l, i) => (<div key={i}><span style={{ color: "#F09595" }}>{l.old_status ?? "—"}</span> → <span style={{ color: "#5DCAA5" }}>{l.new_status}</span> · {l.changed_by_email ?? "—"} · {fmtDate(l.changed_at)} · промяна #{l.change_number}</div>))}
          </div>
          {attemptTimes.length > 0 && (
            <div style={{ marginTop: 10, paddingTop: 9, borderTop: "0.5px solid rgba(133,183,235,0.25)" }}>
              <div style={{ color: "#85B7EB", fontSize: 11, marginBottom: 4 }}>Обаждания „не вдига" · точен час · прозорец</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, fontFamily: "monospace", fontSize: 11.5, color: "rgba(255,255,255,0.7)" }}>
                {formatAttemptAudit(attemptTimes).map((s, i) => (<div key={i}>· {s}</div>))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
