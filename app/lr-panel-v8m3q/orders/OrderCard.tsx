"use client";
import { useState, useEffect, useTransition } from "react";
import { RiskBadge, RiskPanel, riskCardStyle } from "./RiskUi";
import { riskLevel, type CustomerRisk } from "@/lib/customer-risk-shared";
import { isRoOfficeMethod } from "@/lib/ro/config";
import type { AdminOrder, CustomerHistory, StatusLogRow } from "@/lib/orders";
import { isReturn, isPendingPayment, isDeadCardAttempt, hasComplaint, complaintAmountOf, complaintStateLabel, goodsOf, COMPLAINT_STATES } from "@/lib/order-status";
import { isPaidCard, hasCardMoney, cardMoneyMissing } from "@/lib/payments";
import {
  confirmOrder,
  cancelOrder,
  markNoAnswer,
  shipOrder,
  shipRoOrder,
  markCompleted,
  markReturned,
  markRestocked,
  setFake,
  restoreFake,
  addOrderNote,
  openComplaint,
  setComplaintState,
  clearComplaint,
  type ComplaintOutcome,
} from "./actions";
import { callTimer, sofiaHHMM, formatAttemptList, formatAttemptAudit } from "@/lib/callSchedule";
import { OrderItemsList } from "./OrderItemsList";
import { PartnerMarkBadge } from "./PartnerMarkBadge";
import { isRoOrder, fmtLei, fmtLeiWithEuro } from "@/lib/market";
import { PaymentBadge, PaidCardCollectLine, CardMoneyMissingLine, RoPaymentLine } from "./PaymentUi";
import { refundPlan } from "@/lib/stripe-mode";
import { onePlusOneOfOrder } from "@/lib/one-plus-one";
import type { DupGroup } from "@/lib/duplicate-orders";
import { DuplicateStrip, DUP_BG, DUP_BORDER } from "./DuplicateStrip";
import { hasJewelleryLines } from "@/lib/fulfillment-filter";
import { actionText, actionLine, whoName, shortWhen } from "@/lib/admin-names";
import { LabelBox } from "./LabelBox";

const STATUS_BADGE: Record<string, { label: string; bg: string; fg: string }> = {
  new:       { label: "Нова · за обаждане", bg: "#412402", fg: "#FAC775" },
  confirmed: { label: "За изпълнение",       bg: "#173404", fg: "#97C459" },
  shipped:   { label: "Изпратена",           bg: "#04342C", fg: "#5DCAA5" },
  completed: { label: "Завършена",           bg: "#0C447C", fg: "#85B7EB" },
  cancelled: { label: "Отказана",            bg: "#501313", fg: "#F09595" },
  returned:  { label: "Върната",             bg: "#4A1B0C", fg: "#F0997B" },
  returning: { label: "Връща се",            bg: "#4A1B0C", fg: "#F0997B" },
  restocked: { label: "Върната · в наличност", bg: "#173404", fg: "#97C459" },
  pending_payment: { label: "Чака плащане",    bg: "#412402", fg: "#FAC775" },
};
const DEAD_ATTEMPT_BADGE = { label: "Неплатена · изтекла", bg: "#2C2C2A", fg: "#D3D1C7" };

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

const sofiaDateTime = (iso: string) =>
  new Date(iso).toLocaleString("bg-BG", { timeZone: "Europe/Sofia", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function OrderCard({
  order, history, log, now, onNotice, stripeKey = "none", dup, onFocusOrder, labelsMode = "off", risk, role, extConfigured = false,
}: {
  order: AdminOrder;
  history?: CustomerHistory;
  log?: StatusLogRow[];
  now: number;
  onNotice?: (msg: string) => void; // board-level banner: the card may leave the tab (and unmount) right after the action
  stripeKey?: "live" | "test" | "none"; // mode of the site's Stripe key: decides whether cancelling a card order refunds it
  dup?: DupGroup;                        // repeat orders of the same customer within 72 h (lib/duplicate-orders.ts): yellow card + badge
  onFocusOrder?: (ref: string) => void;  // jump to another order of that group
  labelsMode?: "off" | "demo" | "live";  // Econt labels from the panel (lib/econt-shipping.ts)
  risk?: CustomerRisk | null;            // некоректен клиент (lib/customer-risk.ts): red card + badge + band
  role?: string;
  extConfigured?: boolean;               // NEKOREKTEN_API_KEY is set (the value never reaches the browser)
}) {
  const seen = order.updated_at ?? null;   // optimistic lock: the action is refused if someone else changed the order since
  const lastAction = [...(log ?? [])].reverse().find((r) => r.old_status !== "печат");
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const ro = isRoOrder(order); // Romanian order: lei, AWB of a Romanian courier, every action also e-mails the customer in Romanian
  const [tracking, setTracking] = useState(order.tracking_number ?? "");
  const [trackUrl, setTrackUrl] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [hoursOpen, setHoursOpen] = useState<number | null>(null);

  const [cancelStep, setCancelStep] = useState<"closed" | "category" | "refuse" | "other">("closed");
  const [cancelText, setCancelText] = useState("");

  // Рекламация — a delivered parcel that came back. Its own little form, so a
  // click can never register one by accident.
  const [complaintStep, setComplaintStep] = useState<"closed" | "form">("closed");
  const [complaintAmt, setComplaintAmt] = useState("");
  const [complaintReason, setComplaintReason] = useState("");
  const [complaintRestock, setComplaintRestock] = useState(true);
  // Какво става с парите. „Замяна" и „не приемам" не махат нищо от оборота.
  const [complaintOutcome, setComplaintOutcome] = useState<ComplaintOutcome>("open");

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
        if (err) { setError(err); onNotice?.(`${order.order_ref ?? order.id}: ${err}`); }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Възникна грешка. Опитай пак.");
      }
    });

  // Close the picker only if the cancel actually succeeded — on error the run()
  // helper surfaces it inline and we stay put (no silent "looks like it worked").
  const doCancel = (category: string, reason: string) =>
    run(async () => {
      const err = await cancelOrder(order.id, category, reason, seen);
      if (!err) { setCancelStep("closed"); setCancelText(""); }
      return err;
    });

  // Card payments: an open card payment (pending_payment) is NOT an order yet - read-only card, no actions.
  const pendingPay = isPendingPayment(order);
  const deadAttempt = isDeadCardAttempt(order);   // card checkout that expired / failed unpaid
  const readOnly = pendingPay || deadAttempt;
  const paidCard = isPaidCard(order);           // refund / cancel logic (server side uses the same predicate)
  const cardMoney = hasCardMoney(order);        // display: Stripe has the money, the courier collects 0
  const cardMissing = cardMoneyMissing(order);
  // A test card payment (Stripe test mode / no Stripe key here) is cancelled without a refund and without an e-mail to the customer.
  const testPay = paidCard && refundPlan(order.stripe_session_id, stripeKey === "live" ? "sk_live_x" : stripeKey === "test" ? "sk_test_x" : "").action === "skip";
  const badge = deadAttempt ? DEAD_ATTEMPT_BADGE : (STATUS_BADGE[order.status] ?? STATUS_BADGE.new);
  const excluded = order.excluded_from_stock;
  // Who marked it fake and when (order_status_log, owner only): the newest "маркиране → фалшива/тестова" row.
  const fakeMark = excluded ? [...(log ?? [])].reverse().find((r) => r.old_status === "маркиране" && r.new_status === "фалшива/тестова") : undefined;
  const digits = (order.phone ?? "").replace(/[^\d+]/g, "");

  // COD breakdown (стока / доставка / общо). Legacy rows have no subtotal → show
  // only the total, exactly as before, so a mixed list (old + new) stays clean.
  // Guard on reconciliation (sub + shipping === total) so a half-filled row never
  // renders a breakdown that doesn't add up.
  const cod = Number(order.total ?? 0);
  const codSub = order.subtotal != null ? Number(order.subtotal) : null;
  const codShip = Number(order.shipping_cost ?? 0);
  const cardOff = ro ? 0 : Number(order.card_discount ?? 0);   // Romania has no card discount (25.10.2026)   // 5% for paying by card (max €25 / 130 lei): subtotal - card discount + delivery = total
  // 1+1 groups (lib/one-plus-one.ts): read back from the order's own lines (lines - goods - promo code).
  const paidLines = ((order.items ?? []) as { slug?: unknown; price?: unknown; quantity?: unknown; qty?: unknown; gift?: unknown }[]).filter((i) => !i.gift);
  const linesGross = paidLines.reduce((s, i) => s + Number(i.price ?? 0) * Number(i.quantity ?? i.qty ?? 1), 0);
  const opoOff = codSub != null ? onePlusOneOfOrder(paidLines, linesGross - codSub - Number(order.promo_discount ?? 0)) : 0;
  const showBreakdown = codSub != null && codSub > 0 && Math.abs(codSub - cardOff + codShip - cod) < 0.01;
  // Money: euro for Bulgaria, lei for Romania (with the euro equivalent next to the total).
  const money = (n: number) => (ro ? fmtLei(n) : `€${n.toFixed(2)}`);
  const totalLabel = ro ? fmtLeiWithEuro(cod) : `€${cod.toFixed(2)}`;

  // Рекламация (supabase/orders_complaints.sql): a DELIVERED parcel the customer
  // sent back. The order stays "Завършена" — this rides on top of it, and its
  // amount is what the Оборот tab takes out of the turnover.
  const complaint = hasComplaint(order);
  const complaintMoney = complaintAmountOf(order);
  const complaintGoods = goodsOf(order);

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
      onClick={() => {
        // A slip of the finger must not hide a real order from the turnover: ask first (owner, 16.11.2026).
        if (!window.confirm("Сигурни ли сте? Поръчката ще бъде скрита от оборота.")) return;
        run(() => setFake(order.id, true));
      }}
      style={{ background: "none", border: "none", color: "rgba(255,255,255,0.28)", fontSize: 11, borderBottom: "1px dotted rgba(255,255,255,0.25)", cursor: "pointer", padding: 0 }}
    >
      маркирай като фалшива / тестова
    </button>
  );

  const dupHere = !!dup && !excluded && !readOnly;
  return (
    <div data-dup={dupHere ? "1" : undefined} style={{ background: dupHere ? DUP_BG : isDue ? "rgba(151,196,89,0.06)" : "rgba(255,255,255,0.03)", border: `${isDue || dupHere ? "1px" : "0.5px"} solid ${excluded ? "rgba(255,255,255,0.06)" : dupHere ? DUP_BORDER : isDue ? "#97C459" : "rgba(255,255,255,0.1)"}`, borderRadius: 12, padding: "16px 18px", opacity: excluded ? 0.55 : 1, ...riskCardStyle(excluded ? null : riskLevel(risk)) }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ color: "#fff", fontSize: 15, fontWeight: 500 }}>
            {order.name || "—"}
            {order.order_ref && <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, marginLeft: 8, fontFamily: "monospace" }}>{order.order_ref}</span>}
            {ro && <span title="Поръчка от Румъния" style={{ marginLeft: 8, background: "rgba(0,43,127,0.35)", border: "0.5px solid rgba(255,206,0,0.55)", color: "#FFCE00", fontSize: 10, letterSpacing: "0.12em", padding: "2px 8px", borderRadius: 20, verticalAlign: "middle", whiteSpace: "nowrap" }}>🇷🇴 RO</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 5 }}>
            <span style={{ display: "inline-block", background: histBadge.bg, color: histBadge.fg, fontSize: 11, padding: "3px 9px", borderRadius: 20 }}>{histBadge.text}</span>
            <PaymentBadge order={order} />
          </div>
          <RiskBadge risk={excluded ? null : risk} />
          {lastAction && (
            <div title="Последно действие по поръчката" style={{ color: "rgba(255,255,255,0.5)", fontSize: 11.5, marginTop: 6 }}>
              ↻ {actionLine(lastAction)}
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {excluded && <span style={{ background: "#2C2C2A", color: "#D3D1C7", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", padding: "4px 9px", borderRadius: 20 }}>Фалшива</span>}
          {order.is_manual && <span style={{ background: "#3C3489", color: "#CECBF6", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", padding: "4px 9px", borderRadius: 20 }}>Ръчна</span>}
          {(order.source_site === "chronobg") && <span style={{ background: "#4C1D95", color: "#C4B5FD", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", padding: "4px 9px", borderRadius: 20 }}>CHRONOBG</span>}
          {(order.needs_review) && <span title="Артикулите не са разпознати автоматично — провери" style={{ background: "#78350F", color: "#FCD34D", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", padding: "4px 9px", borderRadius: 20 }}>⚠ Провери</span>}
          {hasJewelleryLines(order) && <span title="Поръчката съдържа бижута от дамската колекция" style={{ background: "#3B0764", color: "#E9D5FF", fontSize: 10, letterSpacing: "0.12em", padding: "4px 9px", borderRadius: 20 }}>съдържа бижута</span>}
          <span style={{ background: badge.bg, color: badge.fg, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", padding: "4px 9px", borderRadius: 20 }}>{badge.label}</span>
          <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 12 }}>{fmtDate(order.created_at)}</span>
        </div>
      </div>

      {/* Некоректен клиент: the red band with the full history + external reports, manual mark, re-check, report */}
      {!excluded && !readOnly && <RiskPanel order={order} risk={risk} role={role} extConfigured={extConfigured} onFocusOrder={onFocusOrder} onNotice={onNotice} />}

      {/* Econt label: number, print, status, error + retry (every role that sees the order) */}
      {labelsMode !== "off" && !ro && !order.is_international && <LabelBox order={order} mode={labelsMode} onNotice={onNotice} />}

      {/* Repeat orders of this customer (badge + banner + group) */}
      {dupHere && dup && <DuplicateStrip group={dup} currentIds={[order.id]} onFocusOrder={onFocusOrder ?? (() => {})} onNotice={onNotice} />}


      {/* Phone */}
      <a href={`tel:${digits}`} style={{ display: "inline-flex", alignItems: "center", gap: 7, color: "#85B7EB", fontSize: 18, fontWeight: 500, textDecoration: "none", margin: "12px 0 4px" }}>☎ {order.phone || "—"}</a>
      {/* E-mail (owner + employee only; the partner view never gets it, lib/partner/orders.ts) */}
      <div style={{ margin: "0 0 12px", fontSize: 14 }}>
        {order.email
          ? <a href={`mailto:${order.email}`} style={{ color: "#85B7EB", textDecoration: "none", wordBreak: "break-all" }}>✉ {order.email}</a>
          : <span style={{ color: "rgba(255,255,255,0.35)" }}>✉ няма имейл</span>}
      </div>

      {/* Details */}
      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", lineHeight: 1.7 }}>
        <OrderItemsList items={order.items ?? []} />
        <div style={{ color: "#fff" }}>{ro ? (isRoOfficeMethod(order.shipping_method) ? "Locker / офис на Speedy (Румъния)" : "Куриер до адрес (Румъния)") : (order.shipping_method || (order.courier === "home" ? "Еконт до адрес" : "Еконт до офис"))} — {order.address || "—"}{order.city ? `, ${order.city}` : ""}{ro && order.post_code ? `, ${order.post_code}` : ""}</div>
        {showBreakdown && (
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 2, display: "flex", gap: 14, flexWrap: "wrap" }}>
            <span>Стока: <span style={{ color: "rgba(255,255,255,0.8)" }}>{money(codSub!)}</span></span>
            {opoOff > 0 && <span>1+1: <span style={{ color: "#97C459" }}>−{money(opoOff)}</span></span>}
            {cardOff > 0 && <span>Отстъпка карта −5%: <span style={{ color: "#97C459" }}>−{money(cardOff)}</span></span>}
            <span>Доставка: <span style={{ color: "rgba(255,255,255,0.8)" }}>{codShip > 0 ? money(codShip) : "безплатна"}</span></span>
          </div>
        )}
        {ro ? (
          <RoPaymentLine paid={cardMoney} total={totalLabel} paidAt={order.paid_at ? fmtDate(order.paid_at) : null} />
        ) : cardMoney ? (
          <PaidCardCollectLine zero="0" paidAmount={totalLabel} paidAt={order.paid_at ? fmtDate(order.paid_at) : null} />
        ) : cardMissing ? (
          <CardMoneyMissingLine total={totalLabel} />
        ) : (
          <div style={{ color: "#fff", fontWeight: 500 }}>{totalLabel}<span style={{ color: "rgba(255,255,255,0.4)", fontWeight: 400, fontSize: 12 }}> · {order.payment_method === "card" ? "карта, още не е платено" : "наложен платеж"}</span></div>
        )}
        {(order.utm_source || order.utm_campaign || order.fbclid) && (
          <div data-testid="order-attribution" style={{ marginTop: 4, fontSize: 12, color: "rgba(255,255,255,0.55)" }}>
            ◎ Източник: <span style={{ color: "#fff" }}>{[order.utm_source, order.utm_medium].filter(Boolean).join(" / ") || (order.fbclid ? "Meta (fbclid)" : "—")}</span>
            {order.utm_campaign ? <> · кампания <span style={{ color: "#fff" }}>{order.utm_campaign}</span></> : null}
            {order.fbclid ? <span title={order.fbclid}> · fbclid ✓</span> : null}
          </div>
        )}
        {order.promo_code && (
          <div style={{ marginTop: 4, fontSize: 12, color: "#C0DD97" }}>
            ◈ Промо код: <span style={{ fontFamily: "monospace", color: "#fff", letterSpacing: "0.04em" }}>{order.promo_code}</span>
            {order.promo_discount ? <span style={{ color: "rgba(255,255,255,0.5)" }}> · отстъпка −{money(Number(order.promo_discount))}</span> : null}
          </div>
        )}
        {order.email_confirmed_at ? (
          <div data-testid="email-confirmed" style={{ marginTop: 6, padding: "6px 10px", borderRadius: 6, background: "#173404", color: "#C0DD97", fontSize: 13, fontWeight: 600 }}>
            ✓ Потвърдена по имейл на {sofiaDateTime(order.email_confirmed_at)} – не звънете
          </div>
        ) : order.confirm_email_sent_at ? (
          <div data-testid="email-sent" style={{ marginTop: 4, fontSize: 12, color: "#85B7EB" }}>
            ✉ Имейл за потвърждение изпратен на {sofiaDateTime(order.confirm_email_sent_at)}{order.status === "new" ? " · още не е потвърдил" : ""}
          </div>
        ) : null}
        {order.partner_mark && <PartnerMarkBadge id={order.id} status={order.status} mark={order.partner_mark} onNotice={onNotice} />}
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
        {complaint && (
          <div style={{ fontSize: 12, marginTop: 5, background: "rgba(240,153,123,0.1)", border: "0.5px solid rgba(240,153,123,0.4)", borderRadius: 8, padding: "7px 10px", lineHeight: 1.6 }}>
            <span style={{ color: "#F0997B" }}>
              ⚠ Рекламация · {complaintStateLabel(order.complaint_state)}
              {order.complaint_at ? ` · ${fmtDate(order.complaint_at)}` : ""}
            </span>
            <br />
            <span style={{ color: "rgba(255,255,255,0.6)" }}>
              {complaintMoney > 0
                ? <>върнати пари <b style={{ color: "#fff" }}>{money(complaintMoney)}</b> · извадени от оборота</>
                : <>парите остават при нас · оборотът не се променя</>}
              {order.complaint_restocked_at ? " · стоката е в наличност" : " · стоката още не е върната в склад"}
            </span>
            {order.complaint_reason && (
              <>
                <br />
                <span style={{ color: "rgba(255,255,255,0.75)" }}>„{order.complaint_reason}“</span>
              </>
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
        {!excluded && !readOnly && (
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
      {readOnly ? (
        <div style={{ borderTop: "0.5px solid rgba(255,255,255,0.08)", marginTop: 14, paddingTop: 12 }}>
          <span style={{ color: pendingPay ? "#FAC775" : "rgba(255,255,255,0.45)", fontSize: 12 }}>
            {pendingPay
              ? "Клиентът още не е платил - резервирана наличност, изтича автоматично"
              : "Плащането с карта не е завършено - не е поръчка, наличността е върната"}
          </span>
        </div>
      ) : excluded ? (
        <div style={{ borderTop: "0.5px solid rgba(255,255,255,0.08)", marginTop: 14, paddingTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, lineHeight: 1.6 }}>
            Маркирана като фалшива/тестова{fakeMark ? ` · ${fakeMark.changed_by_email ?? "—"} · ${fmtDate(fakeMark.changed_at)}` : ""}
            <br />
            <span style={{ color: "rgba(255,255,255,0.35)" }}>не се брои в оборота и наличността · с „Върни“ става пак „{badge.label}“</span>
          </span>
          <button disabled={pending} onClick={() => run(() => restoreFake(order.id))} style={outlineBtn("#97C459", "#97C459")}>↩ Върни</button>
        </div>
      ) : (
        <div style={{ borderTop: "0.5px solid rgba(255,255,255,0.08)", marginTop: 14, paddingTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
          {ro && <div style={{ color: "rgba(255,213,0,0.65)", fontSize: 11 }}>🇷🇴 Всяко действие тук праща имейл на румънски на клиента ({order.email || "няма имейл"}).</div>}
          {cancelStep === "closed" && order.status === "new" && (
            <>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase" }}>Резултат от обаждането</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button disabled={pending} onClick={() => run(() => confirmOrder(order.id, seen))} style={primaryBtn}>✓ Потвърждава</button>
                <button disabled={pending} onClick={() => run(() => markNoAnswer(order.id, seen))} style={outlineBtn("#854F0B", "#FAC775")}>✆ Не вдига{order.call_attempts > 0 ? ` (${order.call_attempts})` : ""}</button>
                <button onClick={() => setCancelStep("category")} style={outlineBtn("#A32D2D", "#F09595")}>✕ Отказва</button>
              </div>
              <div>{fakeLink}</div>
            </>
          )}

          {cancelStep === "closed" && order.status === "confirmed" && (
            <>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase" }}>Пакетиране и изпращане</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder={ro ? "AWB номер на румънския куриер…" : "Тракинг номер от Еконт…"} style={{ flex: 1, minWidth: 150, background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "8px 12px", color: "#fff", fontSize: 13 }} />
                {ro && <input value={trackUrl} onChange={(e) => setTrackUrl(e.target.value)} placeholder="Линк за проследяване (празно = Speedy с AWB)" style={{ flex: 1, minWidth: 150, background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "8px 12px", color: "#fff", fontSize: 13 }} />}
                <button disabled={pending} onClick={() => run(() => (ro ? shipRoOrder(order.id, tracking, trackUrl) : shipOrder(order.id, tracking, seen)))} style={primaryBtn}>Маркирай изпратена</button>
                <button onClick={() => setCancelStep("category")} style={outlineBtn("#A32D2D", "#F09595")}>Откажи</button>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <span style={{ color: "#FAC775", fontSize: 11 }}>{ro ? "⚠ без AWB не може да стане изпратена · AWB се въвежда ръчно" : "⚠ без тракинг не може да стане изпратена"}</span>
                {fakeLink}
              </div>
            </>
          )}

          {cancelStep === "closed" && order.status === "shipped" && (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}>{ro ? `AWB ${order.tracking_number} · следи се ръчно (няма автоматична проверка при румънския куриер)` : `Тракинг ${order.tracking_number} · чака Еконт да потвърди взимане`}</span>
                <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button disabled={pending} onClick={() => run(() => markCompleted(order.id, seen))} style={ro ? primaryBtn : outlineBtn("rgba(255,255,255,0.2)", "rgba(255,255,255,0.6)")}>{ro ? "Доставена" : "Ръчно завършена"}</button>
                  <button disabled={pending} onClick={() => run(() => markReturned(order.id, seen))} style={outlineBtn("#A32D2D", "#F09595")}>Върната / невзета</button>
                </span>
              </div>
            </>
          )}

          {cancelStep === "closed" && order.status === "returning" && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <span style={{ color: "#FAC775", fontSize: 12 }}>⏳ Чака да я получа обратно от {ro ? "куриера" : "Еконт"}</span>
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

          {/* Рекламация — доставена поръчка, която клиентът връща. Статусът остава
              „Завършена“ (пратката наистина е доставена); сумата излиза от оборота. */}
          {cancelStep === "closed" && (order.status === "completed" || complaint) && (
            complaintStep === "form" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 9, background: "rgba(240,153,123,0.07)", border: "0.5px solid rgba(240,153,123,0.35)", borderRadius: 10, padding: "12px 14px" }}>
                <span style={{ color: "#F0997B", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase" }}>{complaint ? "Поправи рекламацията" : "Нова рекламация · върната пратка"}</span>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 11 }}>Какво правим</span>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {([
                      ["open",     "Още не е ясно"],
                      ["resolved", "Връщам парите"],
                      ["replaced", "Замяна · нова стока"],
                      ["rejected", "Не приемам"],
                    ] as [ComplaintOutcome, string][]).map(([k, lbl]) => (
                      <button
                        key={k}
                        onClick={() => {
                          setComplaintOutcome(k);
                          // Замяна / отказ = нищо не излиза от оборота; при замяна счупената
                          // стока не се връща в наличност.
                          if (k === "replaced" || k === "rejected") { setComplaintAmt("0"); setComplaintRestock(false); }
                          if (k === "resolved") setComplaintAmt("");
                        }}
                        style={{
                          padding: "6px 11px", borderRadius: 7, fontSize: 12, cursor: "pointer",
                          border: `1px solid ${complaintOutcome === k ? "#F0997B" : "rgba(255,255,255,0.14)"}`,
                          background: complaintOutcome === k ? "rgba(240,153,123,0.15)" : "rgba(255,255,255,0.04)",
                          color: complaintOutcome === k ? "#F0997B" : "rgba(255,255,255,0.6)",
                        }}
                      >{lbl}</button>
                    ))}
                  </div>
                </div>
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 11 }}>Върната сума {ro ? "(лей)" : "(евро)"} · празно = стоката без доставката ({money(complaintGoods)})</span>
                  <input
                    value={complaintAmt}
                    onChange={(e) => setComplaintAmt(e.target.value)}
                    inputMode="decimal"
                    placeholder={complaintGoods.toFixed(2)}
                    style={{ background: "rgba(0,0,0,0.3)", border: "0.5px solid rgba(255,255,255,0.18)", borderRadius: 8, color: "#fff", fontSize: 13, padding: "8px 10px", maxWidth: 180 }}
                  />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 11 }}>Причина (по желание)</span>
                  <textarea
                    value={complaintReason}
                    onChange={(e) => setComplaintReason(e.target.value)}
                    rows={2}
                    placeholder="дефект, не му стана, отказ в 14 дни…"
                    style={{ background: "rgba(0,0,0,0.3)", border: "0.5px solid rgba(255,255,255,0.18)", borderRadius: 8, color: "#fff", fontSize: 13, padding: "8px 10px", resize: "vertical" }}
                  />
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 8, color: "rgba(255,255,255,0.7)", fontSize: 12, cursor: "pointer" }}>
                  <input type="checkbox" checked={complaintRestock} onChange={(e) => setComplaintRestock(e.target.checked)} />
                  Стоката е при мен — върни я в наличност (+1){order.complaint_restocked_at ? " · вече е върната, не се вдига втори път" : ""}
                </label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <button
                    disabled={pending}
                    onClick={() => run(async () => {
                      const raw = complaintAmt.trim().replace(",", ".");
                      const amt = raw === "" ? null : Number(raw);
                      if (amt != null && (!Number.isFinite(amt) || amt < 0)) return "Сумата не е валидна.";
                      const err = await openComplaint(order.id, amt, complaintReason, complaintRestock, complaintOutcome);
                      if (!err) { setComplaintStep("closed"); setComplaintAmt(""); setComplaintReason(""); }
                      return err;
                    })}
                    style={primaryBtn}
                  >Запази рекламацията</button>
                  <button onClick={() => setComplaintStep("closed")} style={backLink}>← назад</button>
                </div>
                <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, lineHeight: 1.5 }}>
                  Поръчката остава „Завършена“ (пратката е доставена) · {complaintOutcome === "replaced" || complaintOutcome === "rejected"
                    ? "нищо не излиза от оборота — парите остават у нас"
                    : "сумата се изважда от оборота по датата на рекламацията"}
                  {cardMoney && complaintOutcome !== "replaced" && complaintOutcome !== "rejected" ? " · парите по карта се връщат ръчно в Stripe" : ""}
                  {complaintOutcome === "replaced" ? " · новата стока се праща като отделна поръчка със сума 0" : ""}
                </span>
              </div>
            ) : complaint ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {COMPLAINT_STATES.filter((st) => st.key !== (order.complaint_state ?? "open")).map((st) => (
                    <button key={st.key} disabled={pending} onClick={() => run(() => setComplaintState(order.id, st.key as ComplaintOutcome))} style={pillBtn}>{st.label}</button>
                  ))}
                </span>
                <span style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <button onClick={() => { setComplaintAmt(order.complaint_amount != null ? String(order.complaint_amount) : ""); setComplaintReason(order.complaint_reason ?? ""); setComplaintRestock(!!order.complaint_restocked_at); setComplaintOutcome((order.complaint_state as ComplaintOutcome) ?? "open"); setComplaintStep("form"); }} style={backLink}>поправи</button>
                  <button
                    disabled={pending}
                    onClick={() => {
                      if (!window.confirm("Да махна рекламацията? Сумата се връща в оборота.")) return;
                      run(() => clearComplaint(order.id));
                    }}
                    style={backLink}
                  >махни рекламацията</button>
                </span>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 12 }}>Доставена · ако клиентът я върне, заведи рекламация</span>
                <button onClick={() => { setComplaintAmt(""); setComplaintReason(""); setComplaintRestock(true); setComplaintStep("form"); }} style={outlineBtn("#A32D2D", "#F09595")}>⚠ Рекламация</button>
              </div>
            )
          )}

          {cancelStep !== "closed" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {cancelStep === "category" && (
                <>
                  <span style={{ color: "#F09595", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase" }}>Причина за отказ</span>
                  {paidCard && (testPay
                    ? <span style={{ color: "#FAC775", fontSize: 12 }}>⚠ Тестово плащане с карта (Stripe test mode) - отказът НЕ връща пари през Stripe и НЕ праща имейл на клиента.</span>
                    : <span style={{ color: "#FAC775", fontSize: 12 }}>⚠ Платена с карта - отказът връща сумата автоматично през Stripe{ro ? " и праща на клиента имейл на румънски" : ""}.</span>)}
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

      {/* History of the order (every role that sees the order; the page already cut the orders to the role's scope) */}
      {log && log.length > 0 && (
        <details style={{ border: "0.5px solid #185FA5", background: "rgba(24,95,165,0.1)", borderRadius: 8, marginTop: 14, padding: "10px 14px" }}>
          <summary style={{ color: "#85B7EB", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", cursor: "pointer" }}>История · {log.length} {log.length === 1 ? "промяна" : "промени"}</summary>
          <div style={{ display: "flex", flexDirection: "column", gap: 7, fontFamily: "monospace", fontSize: 11.5, color: "rgba(255,255,255,0.7)", marginTop: 9 }}>
            {log.map((l, i) => (<div key={i}><span style={{ color: "rgba(255,255,255,0.4)" }}>{shortWhen(l.changed_at)}</span> · <span style={{ color: "#5DCAA5" }}>{actionText(l)}</span> · <span style={{ color: "#FAC775" }}>{whoName(l.changed_by_email)}</span></div>))}
          </div>
          {attemptTimes.length > 0 && (
            <div style={{ marginTop: 10, paddingTop: 9, borderTop: "0.5px solid rgba(133,183,235,0.25)" }}>
              <div style={{ color: "#85B7EB", fontSize: 11, marginBottom: 4 }}>Обаждания „не вдига" · точен час · прозорец</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, fontFamily: "monospace", fontSize: 11.5, color: "rgba(255,255,255,0.7)" }}>
                {formatAttemptAudit(attemptTimes).map((s, i) => (<div key={i}>· {s}</div>))}
              </div>
            </div>
          )}
        </details>
      )}
    </div>
  );
}
