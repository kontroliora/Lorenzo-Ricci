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
  created_at: string;
};

export type CustomerHistory = { total: number; taken: number; refused: number };

export type StatusLogRow = {
  order_id: number;
  old_status: string | null;
  new_status: string | null;
  changed_by_email: string | null;
  changed_at: string;
  change_number: number;
};

// Orders holding stock (a new order reserves immediately on arrival).
export const ACTIVE_STATUSES = ["new", "confirmed", "shipped"] as const;

const ORDER_COLUMNS =
  "id, order_ref, name, phone, city, post_code, address, shipping_method, courier, items, total, notes, status, call_state, call_notes, call_attempts, tracking_number, created_at";

export async function getOrders(limit = 150): Promise<AdminOrder[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[orders] read error:", error.message);
    return [];
  }
  return (data ?? []) as AdminOrder[];
}

// Variant A — reserved is COMPUTED from active order statuses (KV untouched).
export async function getReservedMap(): Promise<Record<string, number>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select("items, status")
    .in("status", ACTIVE_STATUSES as unknown as string[]);
  if (error) {
    console.error("[orders] reserved error:", error.message);
    return {};
  }
  const map: Record<string, number> = {};
  for (const row of (data ?? []) as { items: OrderItem[] }[]) {
    for (const it of row.items ?? []) {
      const slug = String(it.slug ?? "");
      if (!slug) continue;
      map[slug] = (map[slug] ?? 0) + Math.max(1, Number(it.quantity ?? it.qty ?? 1));
    }
  }
  return map;
}

// Internal customer history by phone (OUR data only — never external lists).
export async function getCustomerHistories(
  phones: string[],
): Promise<Record<string, CustomerHistory>> {
  const uniq = Array.from(new Set(phones.filter(Boolean)));
  if (!uniq.length) return {};
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select("phone, status")
    .in("phone", uniq);
  if (error) {
    console.error("[orders] history error:", error.message);
    return {};
  }
  const map: Record<string, CustomerHistory> = {};
  for (const row of (data ?? []) as { phone: string; status: string }[]) {
    const p = row.phone;
    if (!map[p]) map[p] = { total: 0, taken: 0, refused: 0 };
    map[p].total++;
    if (row.status === "completed") map[p].taken++;
    if (row.status === "cancelled") map[p].refused++;
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
  if (error) {
    // Non-owner (RLS) or missing table → just show no audit block.
    return {};
  }
  const map: Record<number, StatusLogRow[]> = {};
  for (const row of (data ?? []) as StatusLogRow[]) {
    (map[row.order_id] ??= []).push(row);
  }
  return map;
}
