import { createClient } from "@/lib/supabase/server";

export type OrderItem = {
  name?: string;
  sku?: string;
  slug?: string;
  quantity?: number;
  qty?: number;
  price?: number;
  currency?: string;
};

export type AdminOrder = {
  id: number;
  order_ref: string | null;
  name: string | null;
  phone: string | null;
  city: string | null;
  post_code: string | null;
  address: string | null;
  shipping_method: string | null;
  courier: string | null;
  items: OrderItem[];
  total: number | null;
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

// Statuses that hold stock. A reservation is held INDEFINITELY until the order
// is processed manually (confirmed / cancelled / returned / marked fake).
// NOTE: neither `returning` nor `restocked` reserve — a return frees KV stock the
// same as the legacy `returned` did (KV model left unchanged, by decision).
export const RESERVING_STATUSES = ["new", "confirmed", "shipped", "completed"] as const;

// Every status that represents a return (the two sub-statuses + the legacy value
// during the migration window). Use this instead of === "returned" everywhere.
export const RETURN_STATUSES = ["returning", "restocked", "returned"] as const;
export const isReturn = (status: string): boolean => (RETURN_STATUSES as readonly string[]).includes(status);

const BASE_COLUMNS =
  "id, order_ref, name, phone, city, post_code, address, shipping_method, courier, items, total, notes, status, call_state, call_notes, call_attempts, tracking_number, excluded_from_stock, created_at";
const ORDER_COLUMNS = `${BASE_COLUMNS}, last_attempt_at, call_attempt_times, return_reviewed, is_manual, cancel_category, cancel_reason`;

export async function getOrders(limit = 150): Promise<AdminOrder[]> {
  const supabase = await createClient();
  // Try the richest column set first, degrade gracefully if a migration hasn't
  // run yet: promo columns → extended columns → base. A missing column must
  // never blank the whole panel.
  const tiers = [
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
//  - new / confirmed / shipped / completed reduce available (held indefinitely)…
//  - …EXCEPT orders flagged excluded_from_stock (test / fake).
//  cancelled / returned never count (goods came back / never left).
export async function getReservedMap(): Promise<Record<string, number>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select("items, status, excluded_from_stock")
    .in("status", RESERVING_STATUSES as unknown as string[]);
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
  type Row = { phone: string; status: string; call_state: string; return_kind?: string | null };
  let rows: Row[];
  const primary = await supabase.from("orders").select("phone, status, call_state, return_kind").in("phone", uniq);
  if (primary.error) {
    const fb = await supabase.from("orders").select("phone, status, call_state").in("phone", uniq);
    if (fb.error) { console.error("[orders] history error:", fb.error.message); return {}; }
    rows = (fb.data ?? []) as Row[];
  } else {
    rows = (primary.data ?? []) as Row[];
  }
  const map: Record<string, CustomerHistory> = {};
  for (const row of rows) {
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
