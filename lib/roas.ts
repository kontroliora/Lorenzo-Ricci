import { supabaseAdmin } from "@/lib/supabase-admin";
import { isOwner } from "@/lib/admin-auth";
import { EUR_RON } from "@/lib/ro/config";
import { isUnpaidCardAttempt } from "@/lib/order-status";
import { collectionUnits } from "@/lib/new-collection";
import { sofiaDay, shiftDay } from "@/lib/sofia-time";

// ── Config ───────────────────────────────────────────────────────────────────
// What the shop eats when a parcel is never collected: it pays BOTH delivery
// legs (out + return). Single, easily-editable source of truth for the loss line.
export const UNCOLLECTED_DELIVERY_COST = 10;

// ── Types ────────────────────────────────────────────────────────────────────
export type SpendEntry = { id: string; period_start: string; period_end: string; amount: number; note: string | null };
export type StatusBucket = { count: number; total: number };

/** Romanian orders (ship_country = 'RO') are placed in LEI. Their own block, in lei (totals) with the euro equivalent at the owner's
 *  rate; the same orders are ALSO inside the euro totals of RoasData (lei / rate), so the headline numbers cover both markets. */
export type RoRoas = {
  rate: number;                  // lei per euro used for the conversion (lib/ro/config EUR_RON = 5.25)
  count: number;
  gross: number;                 // every placed order, lei
  delivered: StatusBucket;       // completed
  inMotion: StatusBucket;        // shipped
  pending: StatusBucket;         // new + confirmed
  cancelled: StatusBucket;
  returned: StatusBucket;
};

export type RoasData = {
  range: { start: string; end: string };
  spend: number;                 // ad spend in the window: Meta's synced daily spend; manual entries only for days without Meta data
  spendSource: SpendSource;
  spendEntries: SpendEntry[];    // full history (not window-filtered)
  totalOrders: number;           // real (non-test) orders in window
  gross: number;                 // Meta's view: every placed order's total
  real: number;                  // completed (delivered + paid) only
  inMotion: number;              // shipped — in transit, not yet resolved
  pending: number;               // new + confirmed — placed, not yet shipped
  byStatus: Record<string, StatusBucket>;
  cancelled: StatusBucket;
  returned: StatusBucket;
  uncollected: { count: number; loss: number; classified: boolean };
  metaRoas: number | null;       // gross / spend
  realRoas: number | null;       // real / spend
  potentialRoas: number | null;  // (real + inMotion + pending) / spend
  exaggerationPct: number | null;// how much Meta overstates vs real (gross→real)
  cancelRate: number;            // cancelled count / total, %
  ro: RoRoas | null;             // Romanian orders in the window, in lei (null when there are none) - separate row, also counted in the euro totals
  /** Women's collection 1+1 (owner, 08.11.2026): real orders (both markets) holding collection pieces, by how many - 1 piece
   *  (missed the free one) vs 2+. Read from each order's own lines, so it covers every order since the collection went live. */
  collection: { orders: number; one: number; twoPlus: number; units: number };
  bg: { all: StatusBucket; delivered: StatusBucket; inMotion: StatusBucket; pending: StatusBucket; lost: StatusBucket }; // Bulgarian orders only, euro: the other half of the split
};

type OrderRow = {
  status: string;
  total: number | null;
  excluded_from_stock: boolean;
  cancel_category: string | null;
  return_kind?: string | null;
  ship_country?: string | null;
  payment_status?: string | null;   // undefined until supabase/stripe_payments.sql has run
  created_at: string;
  items?: { slug?: unknown; quantity?: unknown; qty?: unknown; gift?: unknown }[] | null;
};

const DAY = 86_400_000;
const dayNum = (iso: string) => Date.parse(iso.slice(0, 10));
function inclusiveDays(startISO: string, endISO: string): number {
  return Math.max(0, Math.round((dayNum(endISO) - dayNum(startISO)) / DAY) + 1);
}
function overlapDays(aStart: string, aEnd: string, bStart: string, bEnd: string): number {
  const s = Math.max(dayNum(aStart), dayNum(bStart));
  const e = Math.min(dayNum(aEnd), dayNum(bEnd));
  return Math.max(0, Math.round((e - s) / DAY) + 1);
}
const round2 = (n: number) => Math.round(n * 100) / 100;

async function fetchSpend(): Promise<SpendEntry[]> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("ad_spend")
    .select("id, period_start, period_end, amount, note")
    .order("period_start", { ascending: false });
  if (error) return []; // table not migrated yet → treat as no spend
  return (data ?? []).map((r) => ({
    id: String(r.id),
    period_start: String(r.period_start).slice(0, 10),
    period_end: String(r.period_end).slice(0, 10),
    amount: Number(r.amount) || 0,
    note: r.note ?? null,
  }));
}

export type SpendSource = { metaDays: number; manualDays: number; noDataDays: number; metaSpend: number; manualSpend: number; lastMetaDay: string | null };

/** Ad spend over Sofia days firstDay..lastDay (inclusive, YYYY-MM-DD): Meta's synced daily spend (meta_ad_insights) for every day that
 *  has it, a manual ad_spend entry (pro-rated by its days) only for days without Meta data. Server-only, no owner gate - callers gate. */
async function spendForDays(firstDay: string, lastDay: string, spendEntries: SpendEntry[]): Promise<{ spend: number; source: SpendSource }> {
  const sb = supabaseAdmin();
  const metaByDay = new Map<string, number>();
  for (let from = 0; from < 50_000; from += 1000) {
    const q = await sb.from("meta_ad_insights").select("date, spend").gte("date", firstDay).lte("date", lastDay).range(from, from + 999);
    if (q.error) break;
    for (const row of (q.data ?? []) as { date: string; spend: number | null }[]) {
      const d = String(row.date).slice(0, 10);
      metaByDay.set(d, (metaByDay.get(d) ?? 0) + (Number(row.spend) || 0));
    }
    if ((q.data ?? []).length < 1000) break;
  }
  const lm = await sb.from("meta_ad_insights").select("date").order("date", { ascending: false }).limit(1);
  const lastMetaDay = (lm.data?.[0]?.date as string | undefined)?.slice(0, 10) ?? null;
  let metaSpend = 0, manualSpend = 0, metaDays = 0, manualDays = 0, noDataDays = 0;
  for (let d = firstDay, guard = 0; d <= lastDay && guard < 4000; d = shiftDay(d, -1), guard++) {
    if (metaByDay.has(d)) { metaSpend += metaByDay.get(d)!; metaDays++; continue; }
    let m = 0, hit = false;
    for (const e of spendEntries) {
      const entryDays = inclusiveDays(e.period_start, e.period_end);
      if (entryDays <= 0 || d < e.period_start || d > e.period_end) continue;
      m += e.amount / entryDays; hit = true;
    }
    if (hit) { manualSpend += m; manualDays++; } else noDataDays++;
  }
  return { spend: round2(metaSpend + manualSpend), source: { metaDays, manualDays, noDataDays, metaSpend: round2(metaSpend), manualSpend: round2(manualSpend), lastMetaDay } };
}

export type SpendPeriods = {
  current_month: { spend: number; source: SpendSource };
  last_month: { spend: number; source: SpendSource };
  all_time: { spend: number; source: SpendSource; since: string | null };
};

/** Ad spend for the Оборот tab's three periods (Sofia calendar months; all time = from the first day with any spend data). Owner only. */
export async function getSpendPeriods(): Promise<SpendPeriods | null> {
  if (!(await isOwner())) return null;
  const sb = supabaseAdmin();
  const entries = await fetchSpend();
  const today = sofiaDay();
  const curStart = `${today.slice(0, 7)}-01`;
  const lastEnd = shiftDay(curStart, 1);
  const lastStart = `${lastEnd.slice(0, 7)}-01`;
  const fm = await sb.from("meta_ad_insights").select("date").order("date", { ascending: true }).limit(1);
  const firstMeta = (fm.data?.[0]?.date as string | undefined)?.slice(0, 10) ?? null;
  const firstManual = entries.length ? entries.map((e) => e.period_start).sort()[0] : null;
  const since = [firstMeta, firstManual].filter((d): d is string => !!d).sort()[0] ?? null;
  const [cur, last, all] = await Promise.all([
    spendForDays(curStart, today, entries),
    spendForDays(lastStart, lastEnd, entries),
    since ? spendForDays(since, today, entries) : Promise.resolve({ spend: 0, source: { metaDays: 0, manualDays: 0, noDataDays: 0, metaSpend: 0, manualSpend: 0, lastMetaDay: null } }),
  ]);
  return { current_month: cur, last_month: last, all_time: { ...all, since } };
}

// Owner-gated. Returns null for non-owners (defence in depth on top of the
// page redirect + hidden nav tab).
export async function computeRoas(startISO: string, endISO: string): Promise<RoasData | null> {
  if (!(await isOwner())) return null;
  return computeRoasCore(startISO, endISO);
}

// The pure computation, without the owner gate. Module-private — only the
// gated wrapper above calls it.
async function computeRoasCore(startISO: string, endISO: string): Promise<RoasData> {
  const sb = supabaseAdmin();

  // Orders in window - resilient to columns that are not migrated yet (return_kind, payment_status, ship_country): the first
  // column list the database accepts is used. classified = the return_kind column exists (drives the "непотърсени" loss line).
  const base = "status, total, excluded_from_stock, cancel_category, created_at, items";
  const sets: string[][] = [
    ["return_kind", "payment_status", "ship_country"], ["return_kind", "ship_country"], ["payment_status", "ship_country"], ["ship_country"],
    ["return_kind", "payment_status"], ["return_kind"], ["payment_status"], [],
  ];
  let rows: OrderRow[] = [];
  let classified = false;
  for (const extra of sets) {
    const cols = [base, ...extra].join(", ");
    const q = await sb.from("orders").select(cols).gte("created_at", startISO).lte("created_at", endISO);
    if (!q.error) { rows = (q.data ?? []) as unknown as OrderRow[]; classified = extra.includes("return_kind"); break; }
  }
  // Romanian orders are placed in lei. The headline numbers are in euro for BOTH markets (lei / EUR_RON); the Romanian orders also get
  // their own row in lei (below), and `bg` keeps the Bulgarian-only euro split.
  // Test/fake orders and unpaid card attempts (pending_payment, or cancelled with payment_status expired/failed) are not
  // sales: they never count toward Meta's gross, the cancel rate, or any bucket. A PAID card order counts like any other.
  const real0 = rows.filter((r) => !r.excluded_from_stock && !isUnpaidCardAttempt(r));
  const bgOrders = real0.filter((r) => r.ship_country !== "RO");
  const roOrders = real0.filter((r) => r.ship_country === "RO");
  const eurOf = (r: OrderRow) => (r.ship_country === "RO" ? (Number(r.total) || 0) / EUR_RON : Number(r.total) || 0);
  const orders = real0;

  const byStatus: Record<string, StatusBucket> = {};
  for (const r of orders) {
    const k = r.status ?? "?";
    (byStatus[k] ??= { count: 0, total: 0 });
    byStatus[k].count++;
    byStatus[k].total += eurOf(r);
  }
  const B = (k: string): StatusBucket => byStatus[k] ?? { count: 0, total: 0 };
  for (const k of Object.keys(byStatus)) byStatus[k].total = round2(byStatus[k].total);

  const gross = round2(orders.reduce((s, r) => s + eurOf(r), 0));
  const real = B("completed").total;
  const inMotion = B("shipped").total;
  const pending = round2(B("new").total + B("confirmed").total);
  const cancelled = B("cancelled");
  // Returns split into returning / restocked (+ legacy 'returned') — merge for the
  // single "Върнати" figure.
  const returned: StatusBucket = {
    count: B("returning").count + B("restocked").count + B("returned").count,
    total: round2(B("returning").total + B("restocked").total + B("returned").total),
  };

  const isRet = (s: string) => s === "returning" || s === "restocked" || s === "returned";
  const uncollectedCount = classified
    ? bgOrders.filter((r) => isRet(r.status) && r.return_kind === "uncollected").length // Econt classification: Bulgarian orders only
    : 0;

  // Ad spend (12.11.2026): Meta's own daily spend (meta_ad_insights, synced every morning by /api/cron/meta-ads) for every Sofia day
  // that has it; a manual entry (ad_spend) is used only for days with no Meta data, pro-rated by its days. Before, only the manual
  // entries counted, so ROAS went stale (too high) whenever no entry had been typed in for the latest days.
  const spendEntries = await fetchSpend();
  const { spend, source: spendSource } = await spendForDays(sofiaDay(new Date(startISO)), sofiaDay(new Date(endISO)), spendEntries);

  const metaRoas = spend > 0 ? round2(gross / spend) : null;
  const realRoas = spend > 0 ? round2(real / spend) : null;
  const potentialRoas = spend > 0 ? round2((real + inMotion + pending) / spend) : null;
  const exaggerationPct = real > 0 ? Math.round(((gross - real) / real) * 100) : null;
  const cancelRate = orders.length > 0 ? Math.round((cancelled.count / orders.length) * 1000) / 10 : 0;

  // Romania (lei)
  const roSum = (pred: (s: string) => boolean): StatusBucket => {
    const m = roOrders.filter((r) => pred(r.status ?? "?"));
    return { count: m.length, total: round2(m.reduce((s, r) => s + (Number(r.total) || 0), 0)) };
  };
  const bgBucket = (pred: (st: string) => boolean): StatusBucket => {
    const m = bgOrders.filter((r) => pred(r.status ?? "?"));
    return { count: m.length, total: round2(m.reduce((sum, r) => sum + (Number(r.total) || 0), 0)) };
  };
  const bg = {
    all: bgBucket(() => true),
    delivered: bgBucket((st) => st === "completed"),
    inMotion: bgBucket((st) => st === "shipped"),
    pending: bgBucket((st) => st === "new" || st === "confirmed"),
    lost: bgBucket((st) => st === "cancelled" || isRet(st)),
  };
  const ro: RoRoas | null = roOrders.length === 0 ? null : {
    rate: EUR_RON,
    count: roOrders.length,
    gross: round2(roOrders.reduce((s, r) => s + (Number(r.total) || 0), 0)),
    delivered: roSum((s) => s === "completed"),
    inMotion: roSum((s) => s === "shipped"),
    pending: roSum((s) => s === "new" || s === "confirmed"),
    cancelled: roSum((s) => s === "cancelled"),
    returned: roSum((s) => s === "returning" || s === "restocked" || s === "returned"),
  };

  const collection = { orders: 0, one: 0, twoPlus: 0, units: 0 };
  for (const r of orders) {
    const n = collectionUnits(Array.isArray(r.items) ? r.items : []);
    if (n === 0) continue;
    collection.orders++; collection.units += n;
    if (n === 1) collection.one++; else collection.twoPlus++;
  }

  return {
    range: { start: startISO, end: endISO },
    collection,
    spend,
    spendSource,
    spendEntries,
    totalOrders: orders.length,
    gross,
    real,
    inMotion,
    pending,
    byStatus,
    cancelled,
    returned,
    uncollected: { count: uncollectedCount, loss: round2(uncollectedCount * UNCOLLECTED_DELIVERY_COST), classified },
    metaRoas,
    realRoas,
    potentialRoas,
    exaggerationPct,
    cancelRate,
    ro,
    bg,
  };
}
