// The partner's MARK on an order, as the owner's admin panel shows it (owner, 09.11.2026). Client-safe (no server imports).
// His buttons on /partner (Обадено / Потвърдено / Не вдига / Отказано) never change the order; the panel shows his latest mark as a
// badge and the owner may "Приложи" it: that runs the panel's own action (confirm / не вдига / cancel as refused), logged as the
// owner in order_status_log.

export type PartnerMark = { status: string; note: string; at: string };

export const PARTNER_MARK_LABEL: Record<string, string> = {
  new: "Бележка", called: "Обадено", confirmed: "Потвърдено", no_answer: "Не вдига", cancelled: "Отказано",
};

/** What "Приложи" would do for this order status, or null when there is nothing to apply (already there / no panel equivalent). */
export function applyOfMark(orderStatus: string, mark: string): "confirm" | "no_answer" | "cancel" | null {
  if (mark === "confirmed" && orderStatus === "new") return "confirm";
  if (mark === "no_answer" && orderStatus === "new") return "no_answer";
  if (mark === "cancelled" && (orderStatus === "new" || orderStatus === "confirmed")) return "cancel";
  return null;   // "called": the panel has no such status; anything shipped / done / cancelled already: nothing to apply
}

export const sofiaHM = (iso: string) =>
  new Date(iso).toLocaleString("bg-BG", { timeZone: "Europe/Sofia", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
