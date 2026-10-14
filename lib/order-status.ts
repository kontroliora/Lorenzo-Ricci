// Pure order-status constants/helpers — NO server-only deps, so this is safe to
// import from client components too (unlike lib/orders.ts, which pulls in
// next/headers via lib/supabase/server and can only be imported server-side).
import { PENDING_PAYMENT, isCard, isPaidCard } from "./payments";

// Statuses that hold stock. A reservation is held INDEFINITELY until the order is
// processed manually. Neither `returning` nor `restocked` reserve — a return frees
// KV stock the same as the legacy `returned` did (KV model unchanged, by decision).
// `pending_payment` (an open card payment) holds stock too: the units were taken from
// wallet_inventory when the Stripe session was opened, so cancelling such an order must put
// them back. Audited uses of this list: actions.ts HOLDS_STOCK (the restock-on-cancel decision)
// and getReservedMap (information-only "Резерв." column) — neither feeds a count, a revenue
// figure or the available-stock arithmetic.
export const RESERVING_STATUSES = ["new", "confirmed", "shipped", "completed", PENDING_PAYMENT] as const;

// The same list WITHOUT pending_payment, for DB queries (`.in("status", ...)`) while the
// stripe_payments.sql migration has not added that enum value yet: Postgres rejects an unknown
// enum literal inside IN (...) and the whole query would fail.
export const RESERVING_STATUSES_LEGACY = ["new", "confirmed", "shipped", "completed"] as const;

// Every status that represents a return (the two sub-statuses + the legacy value
// during the migration window). Use isReturn() instead of === "returned".
export const RETURN_STATUSES = ["returning", "restocked", "returned"] as const;
export const isReturn = (status: string): boolean => (RETURN_STATUSES as readonly string[]).includes(status);

// ── Card payments (Stripe) ───────────────────────────────────────────────────
type PayFields = { status: string; payment_method?: string | null; payment_status?: string | null };

/** An open card payment: stock reserved, the customer has NOT paid yet - not a real order. */
export const isPendingPayment = (o: { status: string }): boolean => o.status === PENDING_PAYMENT;

/** A card checkout that ended unpaid (session expired / payment failed): cancelled by the system, never a sale. */
export const isDeadCardAttempt = (o: PayFields): boolean =>
  o.status === "cancelled" && (o.payment_status === "expired" || o.payment_status === "failed");

/**
 * An unpaid card attempt (open or dead). These are NOT orders: they never count as sales, revenue, customers or
 * "new orders", and they stay out of the fulfilment tabs and counters.
 */
export const isUnpaidCardAttempt = (o: PayFields): boolean => isPendingPayment(o) || isDeadCardAttempt(o);

/** Payment filters of the panel boards. */
export type PayMethodFilter = "all" | "cod" | "card";
export type PayStateFilter = "all" | "paid" | "unpaid";

/** Paid = a card order whose payment went through. Unpaid = everything else (cash on delivery, or a card order not paid). */
export function matchesPayment(o: PayFields, method: PayMethodFilter, state: PayStateFilter): boolean {
  if (method === "card" && !isCard(o)) return false;
  if (method === "cod" && isCard(o)) return false;
  if (state === "paid" && !isPaidCard(o)) return false;
  if (state === "unpaid" && isPaidCard(o)) return false;
  return true;
}
