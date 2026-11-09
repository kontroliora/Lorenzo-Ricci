import { adminDb, getAdminSession } from "@/lib/supabase/admin-db";

export type RevenuePeriod = { revenue: number; collected: number; shipping: number; count: number };
export type TopProduct = { name: string; qty: number; revenue: number };
export type RevenueData = {
  current_month: RevenuePeriod;
  last_month: RevenuePeriod;
  all_time: RevenuePeriod;
  top_products: TopProduct[];
  // Romanian orders (ship_country = 'RO') in LEI, kept out of the euro figures above. Present once
  // supabase/owner_revenue_ro.sql has been run.
  ro?: { current_month: RevenuePeriod; last_month: RevenuePeriod; all_time: RevenuePeriod };
};

// Owner-only turnover. The SECURITY DEFINER owner_revenue() returns NULL for
// anyone who isn't the owner (is_owner() guard), so the employee gets nothing
// even on a direct RPC call. Returns null when unavailable / not owner.
export async function getRevenue(): Promise<RevenueData | null> {
  if ((await getAdminSession())?.role !== "owner") return null;   // app-level gate; owner_revenue() checks is_owner() itself too
  const supabase = await adminDb();
  const { data, error } = await supabase.rpc("owner_revenue");
  if (error || !data) return null;
  return data as RevenueData;
}
