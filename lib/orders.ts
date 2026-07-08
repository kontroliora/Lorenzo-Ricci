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
  return_reviewed?: boolean; // undefined until the migration runs (resilient fallback)
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
export const RESERVING_STATUSES = ["new", "confirmed", "shipped", "completed"] as const;

const BASE_COLUMNS =
  "id, order_ref, name, phone, city, post_code, address, shipping_method, courier, items, total, notes, status, call_state, call_notes, call_attempts, tracking_number, excluded_from_stock, created_at";
const ORDER_COLUMNS = `${BASE_COLUMNS}, last_attempt_at, return_reviewed`;

export async function getOrders(limit = 150): Promise<AdminOrder[]> {
  const supabase = await createClient();
  const primary = await supabase
    .from("orders")
    .select(ORDER_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);

  let data: unknown = primary.data;
  let error = primary.error;
  // Fallback if last_attempt_at isn't migrated yet — the view still works.
  if (error) {
    const fallback = await supabase
      .from("orders")
      .select(BASE_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(limit);
    data = fallback.data;
    error = fallback.error;
  }
  if (error) {
    console.error("[orders] read error:", error.message);
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
  const { data, error } = await supabase
    .from("orders")
    .select("phone, status, call_state")
    .in("phone", uniq);
  if (error) {
    console.error("[orders] history error:", error.message);
    return {};
  }
  const map: Record<string, CustomerHistory> = {};
  for (const row of (data ?? []) as { phone: string; status: string; call_state: string }[]) {
    const p = row.phone;
    if (!map[p]) map[p] = { confirmed: 0, refused: 0, notTaken: 0 };
    if (row.call_state === "confirmed") map[p].confirmed++;
    if (row.call_state === "refused") map[p].refused++;
    if (row.status === "returned") map[p].notTaken++;
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
    .order("changed_at", { ascending: false });
  if (error) return {};
  const map: Record<number, StatusLogRow[]> = {};
  for (const row of (data ?? []) as StatusLogRow[]) {
    (map[row.order_id] ??= []).push(row);
  }
  return map;
}
