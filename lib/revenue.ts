import { adminDb, getAdminSession } from "@/lib/supabase/admin-db";
import { complaintAmountOf } from "@/lib/order-status";

export type RevenuePeriod = { revenue: number; collected: number; shipping: number; count: number };
export type TopProduct = { name: string; qty: number; revenue: number };
/** Money taken OUT of a period's turnover by рекламации, and how many there were. */
export type ComplaintPeriod = { amount: number; count: number };
export type ComplaintPeriods = { current_month: ComplaintPeriod; last_month: ComplaintPeriod; all_time: ComplaintPeriod };
export type RevenueData = {
  current_month: RevenuePeriod;
  last_month: RevenuePeriod;
  all_time: RevenuePeriod;
  top_products: TopProduct[];
  // Romanian orders (ship_country = 'RO') in LEI, kept out of the euro figures above. Present once
  // supabase/owner_revenue_ro.sql has been run.
  ro?: { current_month: RevenuePeriod; last_month: RevenuePeriod; all_time: RevenuePeriod };
  // Рекламации already SUBTRACTED from the figures above (euro for Bulgaria, lei for Romania).
  // Kept separately so the board can also show the gross number and the deduction.
  // Absent until supabase/orders_complaints.sql has been run.
  complaints?: ComplaintPeriods;
  complaints_ro?: ComplaintPeriods;
};

// ── Рекламации ───────────────────────────────────────────────────────────────
// owner_revenue() counts every delivered parcel. A рекламация is a parcel that
// WAS delivered and came back afterwards, with the money given back — so it is
// taken off the turnover here, in the app, bucketed by the date the рекламация
// was registered (Europe/Sofia), and owner_revenue() itself stays untouched.

type ComplaintRow = {
  complaint_at: string | null;
  complaint_amount: number | null;
  complaint_state: string | null;
  total: number | null;
  shipping_cost: number | null;
  status: string | null;
  excluded_from_stock: boolean | null;
  ship_country: string | null;
};

const ZERO: ComplaintPeriod = { amount: 0, count: 0 };
const emptyPeriods = (): ComplaintPeriods => ({ current_month: { ...ZERO }, last_month: { ...ZERO }, all_time: { ...ZERO } });

/** "2026-11" for an instant, in Sofia time — the same bucketing owner_revenue() does in SQL. */
function sofiaMonth(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Sofia", year: "numeric", month: "2-digit" }).formatToParts(new Date(iso));
  const y = parts.find((p) => p.type === "year")?.value ?? "0000";
  const m = parts.find((p) => p.type === "month")?.value ?? "00";
  return `${y}-${m}`;
}

/** This Sofia month and the one before it, as "YYYY-MM" keys. */
function monthKeys(): { cur: string; prev: string } {
  const cur = sofiaMonth(new Date().toISOString());
  const [y, m] = cur.split("-").map(Number);
  const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
  return { cur, prev };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function bucket(rows: ComplaintRow[]): ComplaintPeriods {
  const { cur, prev } = monthKeys();
  const out = emptyPeriods();
  for (const r of rows) {
    if (!r.complaint_at) continue;
    const amount = complaintAmountOf(r);           // 0 for a rejected claim — the money stayed with us
    const key = sofiaMonth(r.complaint_at);
    const add = (p: ComplaintPeriod) => { p.amount += amount; p.count += 1; };
    add(out.all_time);
    if (key === cur) add(out.current_month);
    else if (key === prev) add(out.last_month);
  }
  for (const p of [out.current_month, out.last_month, out.all_time]) p.amount = round2(p.amount);
  return out;
}

/** Take a period's рекламации off its turnover. The parcel count stays: it really was delivered. */
function net(p: RevenuePeriod, c: ComplaintPeriod): RevenuePeriod {
  return { ...p, revenue: round2(p.revenue - c.amount), collected: round2(p.collected - c.amount) };
}

// Owner-only turnover. The SECURITY DEFINER owner_revenue() returns NULL for
// anyone who isn't the owner (is_owner() guard), so the employee gets nothing
// even on a direct RPC call. Returns null when unavailable / not owner.
export async function getRevenue(): Promise<RevenueData | null> {
  if ((await getAdminSession())?.role !== "owner") return null;   // app-level gate; owner_revenue() checks is_owner() itself too
  const supabase = await adminDb();
  const { data, error } = await supabase.rpc("owner_revenue");
  if (error || !data) return null;
  const revenue = data as RevenueData;

  // Рекламации — only the ones on orders the turnover actually counted
  // (status 'completed', not marked fake/test). A read problem (or the migration
  // not yet run) leaves the turnover exactly as the RPC returned it.
  const claims = await supabase
    .from("orders")
    .select("complaint_at, complaint_amount, complaint_state, total, shipping_cost, status, excluded_from_stock, ship_country")
    .not("complaint_at", "is", null);
  if (claims.error) {
    if (!/complaint/i.test(claims.error.message)) console.error("[revenue] complaints read error:", claims.error.message);
    return revenue;
  }
  const rows = ((claims.data ?? []) as unknown as ComplaintRow[])
    .filter((r) => r.status === "completed" && !r.excluded_from_stock);

  const bgClaims = bucket(rows.filter((r) => r.ship_country !== "RO"));
  const roClaims = bucket(rows.filter((r) => r.ship_country === "RO"));

  const out: RevenueData = {
    ...revenue,
    current_month: net(revenue.current_month, bgClaims.current_month),
    last_month: net(revenue.last_month, bgClaims.last_month),
    all_time: net(revenue.all_time, bgClaims.all_time),
    complaints: bgClaims,
  };
  if (revenue.ro) {
    out.ro = {
      current_month: net(revenue.ro.current_month, roClaims.current_month),
      last_month: net(revenue.ro.last_month, roClaims.last_month),
      all_time: net(revenue.ro.all_time, roClaims.all_time),
    };
    out.complaints_ro = roClaims;
  }
  return out;
}
