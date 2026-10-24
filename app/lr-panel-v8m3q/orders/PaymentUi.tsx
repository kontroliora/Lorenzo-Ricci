import type { CSSProperties } from "react";
import type { AdminOrder } from "@/lib/orders";
import { isCard, hasCardMoney, cardMoneyMissing } from "@/lib/payments";
import type { PayMethodFilter, PayStateFilter } from "@/lib/order-status";

// Shared payment UI of the Bulgarian and Romanian boards (card payments next to cash on delivery).

type PayOrder = Pick<AdminOrder, "status" | "payment_method" | "payment_status" | "stripe_payment_intent">;

const CARD_STATE_LABEL: Record<string, string> = {
  pending: "чака плащане",
  expired: "изтекло",
  failed: "неуспешно",
  refunded: "върната сума",
  unpaid: "неплатено",
};

const pill: CSSProperties = {
  fontSize: 10, letterSpacing: "0.12em", padding: "3px 9px", borderRadius: 20, whiteSpace: "nowrap", display: "inline-block",
};

/** Payment pill + a small paid/unpaid marker for a card header. */
export function PaymentBadge({ order }: { order: PayOrder }) {
  const paid = hasCardMoney(order);
  const card = isCard(order);
  const missing = cardMoneyMissing(order);
  return (
    <>
      {paid ? (
        <span data-testid="card-paid-badge" style={{ ...pill, fontSize: 11, letterSpacing: "0.06em", padding: "4px 11px", background: "#1E5C0B", color: "#E4F5CF", border: "1px solid #97C459", fontWeight: 700 }}>ПЛАТЕНО С КАРТА · не събирай наложен платеж</span>
      ) : missing ? (
        <span data-testid="card-missing-badge" style={{ ...pill, fontSize: 11, letterSpacing: "0.06em", padding: "4px 11px", background: "#5C0B0B", color: "#FFD9D9", border: "1px solid #F09595", fontWeight: 700 }}>⚠ КАРТА, НО НЯМА ПЛАЩАНЕ · не изпращай, провери в Stripe</span>
      ) : card ? (
        <span style={{ ...pill, textTransform: "uppercase", background: "rgba(250,199,117,0.12)", color: "#FAC775", border: "0.5px solid rgba(250,199,117,0.4)" }}>
          Карта · {CARD_STATE_LABEL[order.payment_status ?? ""] ?? "неплатено"}
        </span>
      ) : (
        <span style={{ ...pill, background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)", border: "0.5px solid rgba(255,255,255,0.12)" }}>Наложен платеж</span>
      )}
      {!paid && !missing && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", whiteSpace: "nowrap" }}>○ неплатено</span>}
    </>
  );
}

/** Prominent "the courier collects nothing" line for a PAID card order. `zero` is the already-formatted zero amount. */
export function PaidCardCollectLine({ zero, paidAmount, paidAt }: { zero: string; paidAmount: string; paidAt?: string | null }) {
  return (
    <div style={{ marginTop: 6, background: "rgba(151,196,89,0.12)", border: "1px solid #97C459", borderRadius: 8, padding: "8px 12px" }}>
      <div style={{ color: "#C0DD97", fontSize: 14, fontWeight: 600 }}>Наложен платеж в Еконт: {zero} - не събирай пари (платено с карта)</div>
      <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 11, marginTop: 2 }}>
        Платено {paidAmount} с карта{paidAt ? ` · ${paidAt}` : ""}
      </div>
    </div>
  );
}

/** Red warning instead of a cash-on-delivery total: the order says card but no card payment is on it. */
export function CardMoneyMissingLine({ total }: { total: string }) {
  return (
    <div data-testid="card-missing-line" style={{ marginTop: 6, background: "rgba(240,149,149,0.12)", border: "1px solid #F09595", borderRadius: 8, padding: "8px 12px" }}>
      <div style={{ color: "#FFD9D9", fontSize: 14, fontWeight: 600 }}>⚠ Избрано плащане с карта, но плащане няма ({total})</div>
      <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, marginTop: 2 }}>Не изпращай и не пускай с наложен платеж, преди да провериш в Stripe.</div>
    </div>
  );
}

const segBtn = (active: boolean): CSSProperties => ({
  background: active ? "rgba(255,255,255,0.14)" : "transparent",
  border: `0.5px solid ${active ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.15)"}`,
  color: active ? "#fff" : "rgba(255,255,255,0.55)",
  borderRadius: 20, padding: "5px 12px", fontSize: 11, cursor: "pointer", fontWeight: active ? 500 : 400,
});

/** Filter row: payment method (all / cash on delivery / card) and paid state (paid / unpaid - click again to clear). */
export function PaymentFilters({
  method, state, onMethod, onState,
}: {
  method: PayMethodFilter; state: PayStateFilter; onMethod: (m: PayMethodFilter) => void; onState: (s: PayStateFilter) => void;
}) {
  const methods: [PayMethodFilter, string][] = [["all", "Всички плащания"], ["cod", "Наложен платеж"], ["card", "Карта"]];
  const states: [Exclude<PayStateFilter, "all">, string][] = [["paid", "Платени"], ["unpaid", "Неплатени"]];
  return (
    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }} aria-label="Филтър по плащане">
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {methods.map(([id, label]) => (
          <button key={id} onClick={() => onMethod(id)} aria-pressed={method === id} style={segBtn(method === id)}>{label}</button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {states.map(([id, label]) => (
          <button key={id} onClick={() => onState(state === id ? "all" : id)} aria-pressed={state === id} style={segBtn(state === id)}>{label}</button>
        ))}
      </div>
    </div>
  );
}
