import { createClient } from "@/lib/supabase/server";
import { RESERVING_STATUSES, RESERVING_STATUSES_LEGACY, RETURN_STATUSES, isReturn, isUnpaidCardAttempt } from "./order-status";

export type OrderItem = {
  name?: string;
  sku?: string;
  slug?: string;
  quantity?: number;
  qty?: number;
  price?: number;
  currency?: string;
  gift?: boolean;    // free gift line added by /api/order (lib/gifts.ts), stored at price 0
  giftFor?: string;  // slug of the clutch it came with
};

export type AdminOrder = {
  id: number;
  order_ref: string | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  post_code: string | null;
  address: string | null;
  shipping_method: string | null;
  courier: string | null;
  items: OrderItem[];
  total: number | null;
  subtotal: number | null;      // goods portion (after discounts) — null on legacy rows
  shipping_cost: number | null; // delivery portion of the COD total — null on legacy rows
  is_international?: boolean;    // Dubai test "soft decline" order — kept out of the normal queue
  ship_country?: string | null; // foreign destination country (international orders only)
  notes: string | null;
  status: string;
  call_state: string;
  call_notes: string | null;
  call_attempts: number;
  tracking_number: string | null;
  excluded_from_stock: boolean;
  last_attempt_at: string | null;
  call_attempt_times?: string[]; // ISO timestamps, one per "не вдига" press
  return_reviewed?: boolean; // undefined until the migration runs (resilient fallback)
  is_manual?: boolean;
  cancel_category?: string | null;
  cancel_reason?: string | null;
  promo_code?: string | null;      // undefined until the orders_promo migration runs
  promo_discount?: number | null;
  return_kind?: string | null;         // 'uncollected' | 'refused' | null — until orders_return_kind migration
  return_dwell_days?: number | null;   // calendar days at the final office before returning
  returning_at?: string | null;        // when the parcel started coming back (set by cron/manual, going forward)
  restocked_at?: string | null;        // when we received it back — leather +1 done; idempotency key
  restocked_source?: string | null;    // 'cron' | 'button'
  // Card payments (supabase/stripe_payments.sql) — undefined until that migration runs (= cash on delivery).
  payment_method?: string | null;      // 'cod' | 'card'
  payment_status?: string | null;      // 'unpaid' | 'pending' | 'paid' | 'expired' | 'failed' | 'refunded'
  paid_at?: string | null;
  stripe_payment_intent?: string | null;
  stripe_session_id?: string | null;   // cs_test_... / cs_live_...: tells a test payment from a live one (lib/stripe-mode.ts)
  created_at: string;
};

// Three-metric customer profile (our data only).
export type CustomerHistory = { confirmed: number; refused: number; notTaken: number };

export type StatusLogRow = {
  order_id: number;
  old_status: string | null;
  new_status: string | null;
  changed_by_email: string | null;
  changed_at: string;
  change_number: number;
};

// Re-exported from the client-safe module so existing server-side importers keep
// working (`import { RESERVING_STATUSES, isReturn } from "@/lib/orders"`). Client
// components must import them from "@/lib/order-status" directly (this file pulls
// in next/headers and can't be bundled client-side).
export { RESERVING_STATUSES, RETURN_STATUSES, isReturn };

const BASE_COLUMNS =
  "id, order_ref, name, phone, email, city, post_code, address, shipping_method, courier, items, total, subtotal, shipping_cost, notes, status, call_state, call_notes, call_attempts, tracking_number, excluded_from_stock, is_international, ship_country, created_at";
const ORDER_COLUMNS = `${BASE_COLUMNS}, last_attempt_at, call_attempt_times, return_reviewed, is_manual, cancel_category, cancel_reason`;
// Added by supabase/stripe_payments.sql — the RICHEST tier, so a database without them still reads fine.
const PAYMENT_COLUMNS = "payment_method, payment_status, paid_at, stripe_payment_intent, stripe_session_id";

export async function getOrders(limit = 1000): Promise<AdminOrder[]> {
  const supabase = await createClient();
  // Try the richest column set first, degrade gracefully if a migration hasn't
  // run yet: payment columns → promo columns → extended columns → base. A missing
  // column must never blank the whole panel.
  const tiers = [
    `${ORDER_COLUMNS}, promo_code, promo_discount, return_kind, return_dwell_days, returning_at, restocked_at, restocked_source, ${PAYMENT_COLUMNS}`,
    `${ORDER_COLUMNS}, promo_code, promo_discount, return_kind, return_dwell_days, returning_at, restocked_at, restocked_source`,
    `${ORDER_COLUMNS}, promo_code, promo_discount, return_kind, return_dwell_days`,
    `${ORDER_COLUMNS}, promo_code, promo_discount`,
    ORDER_COLUMNS,
    BASE_COLUMNS,
  ];
  let data: unknown = null;
  let lastError: { message: string } | null = null;
  for (const cols of tiers) {
    const res = await supabase
      .from("orders")
      .select(cols)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (!res.error) { data = res.data; lastError = null; break; }
    lastError = res.error;
  }
  if (lastError) {
    console.error("[orders] read error:", lastError.message);
    return [];
  }
  return (data ?? []) as AdminOrder[];
}

// Computed reservation (Variant A). Inventory follows the status automatically:
//  - new / confirmed / shipped / completed (+ pending_payment: an open card payment) reduce available (held indefinitely)…
//  - …EXCEPT orders flagged excluded_from_stock (test / fake).
//  cancelled / returned never count (goods came back / never left).
export async function getReservedMap(): Promise<Record<string, number>> {
  const supabase = await createClient();
  const query = (statuses: readonly string[]) =>
    supabase.from("orders").select("items, status, excluded_from_stock").in("status", statuses as string[]);
  // pending_payment (open card payments) also holds stock. Before supabase/stripe_payments.sql has added that enum value,
  // Postgres rejects it inside IN (...) — fall back to the legacy list so this column never blanks.
  let { data, error } = await query(RESERVING_STATUSES);
  if (error) ({ data, error } = await query(RESERVING_STATUSES_LEGACY));
  if (error) {
    console.error("[orders] reserved error:", error.message);
    return {};
  }
  const map: Record<string, number> = {};
  for (const row of (data ?? []) as { items: OrderItem[]; excluded_from_stock: boolean }[]) {
    if (row.excluded_from_stock) continue;
    for (const it of row.items ?? []) {
      const slug = String(it.slug ?? "");
      if (!slug) continue;
      map[slug] = (map[slug] ?? 0) + Math.max(1, Number(it.quantity ?? it.qty ?? 1));
    }
  }
  return map;
}

// Internal customer profile by phone (OUR data only — never external lists):
//  confirmed = said yes on the phone · refused = said no · notTaken = shipment returned.
export async function getCustomerHistories(
  phones: string[],
): Promise<Record<string, CustomerHistory>> {
  const uniq = Array.from(new Set(phones.filter(Boolean)));
  if (!uniq.length) return {};
  const supabase = await createClient();
  // Include return_kind so "невзел" (notTaken) counts ONLY uncollected returns —
  // the real no-shows (seller pays both legs), not refused-after-inspection.
  // Falls back to counting any return if the column isn't migrated yet.
  // payment_status (stripe_payments.sql) lets unpaid card attempts (pending_payment / expired) be ignored.
  type Row = { phone: string; status: string; call_state: string; return_kind?: string | null; payment_status?: string | null };
  let rows: Row[] | null = null;
  let lastError: { message: string } | null = null;
  for (const cols of [
    "phone, status, call_state, return_kind, payment_status",
    "phone, status, call_state, return_kind",
    "phone, status, call_state",
  ]) {
    const res = await supabase.from("orders").select(cols).in("phone", uniq);
    if (!res.error) { rows = (res.data ?? []) as unknown as Row[]; break; }
    lastError = res.error;
  }
  if (!rows) { console.error("[orders] history error:", lastError?.message); return {}; }
  const map: Record<string, CustomerHistory> = {};
  for (const row of rows) {
    if (isUnpaidCardAttempt(row)) continue; // an unpaid card attempt is not a customer event
    const p = row.phone;
    if (!map[p]) map[p] = { confirmed: 0, refused: 0, notTaken: 0 };
    if (row.call_state === "confirmed") map[p].confirmed++;
    if (row.call_state === "refused") map[p].refused++;
    // невзел = uncollected only. If return_kind is absent (not migrated / column
    // not selected), fall back to counting any return. Covers both return
    // sub-statuses (returning / restocked) + the legacy value.
    if (isReturn(row.status) && (row.return_kind === "uncollected" || row.return_kind === undefined)) {
      map[p].notTaken++;
    }
  }
  return map;
}

// Audit log — RLS returns rows only to the owner; employees get an empty array.
export async function getStatusLog(orderIds: number[]): Promise<Record<number, StatusLogRow[]>> {
  if (!orderIds.length) return {};
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("order_status_log")
    .select("order_id, old_status, new_status, changed_by_email, changed_at, change_number")
    .in("order_id", orderIds)
    .order("changed_at", { ascending: true }); // chronological: oldest → newest
  if (error) return {};
  const map: Record<number, StatusLogRow[]> = {};
  for (const row of (data ?? []) as StatusLogRow[]) {
    (map[row.order_id] ??= []).push(row);
  }
  return map;
}
