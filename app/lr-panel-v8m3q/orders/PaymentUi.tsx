import type { CSSProperties } from "react";
import type { AdminOrder } from "@/lib/orders";
import { isCard, isPaidCard } from "@/lib/payments";
import type { PayMethodFilter, PayStateFilter } from "@/lib/order-status";

// Shared payment UI of the Bulgarian and Romanian boards (card payments next to cash on delivery).

type PayOrder = Pick<AdminOrder, "status" | "payment_method" | "payment_status">;

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
  const paid = isPaidCard(order);
  const card = isCard(order);
  return (
    <>
      {paid ? (
        <span style={{ ...pill, background: "#173404", color: "#97C459", border: "0.5px solid #97C459", fontWeight: 500 }}>ПЛАТЕНО С КАРТА</span>
      ) : card ? (
        <span style={{ ...pill, textTransform: "uppercase", background: "rgba(250,199,117,0.12)", color: "#FAC775", border: "0.5px solid rgba(250,199,117,0.4)" }}>
          Карта · {CARD_STATE_LABEL[order.payment_status ?? ""] ?? "неплатено"}
        </span>
      ) : (
        <span style={{ ...pill, background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)", border: "0.5px solid rgba(255,255,255,0.12)" }}>Наложен платеж</span>
      )}
      <span style={{ fontSize: 11, color: paid ? "#97C459" : "rgba(255,255,255,0.4)", whiteSpace: "nowrap" }}>{paid ? "● платено" : "○ неплатено"}</span>
    </>
  );
}

/** Prominent "the courier collects nothing" line for a PAID card order. `zero` is the already-formatted zero amount. */
export function PaidCardCollectLine({ zero, paidAmount, paidAt }: { zero: string; paidAmount: string; paidAt?: string | null }) {
  return (
    <div style={{ marginTop: 6, background: "rgba(151,196,89,0.12)", border: "1px solid #97C459", borderRadius: 8, padding: "8px 12px" }}>
      <div style={{ color: "#C0DD97", fontSize: 14, fontWeight: 600 }}>Куриерът събира: {zero} (платено с карта)</div>
      <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 11, marginTop: 2 }}>
        Платено {paidAmount} с карта{paidAt ? ` · ${paidAt}` : ""}
      </div>
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
