import { supabaseAdmin } from "@/lib/supabase-admin";
import { isOwner } from "@/lib/admin-auth";

// ── Config ───────────────────────────────────────────────────────────────────
// What the shop eats when a parcel is never collected: it pays BOTH delivery
// legs (out + return). Single, easily-editable source of truth for the loss line.
export const UNCOLLECTED_DELIVERY_COST = 10;

// ── Types ────────────────────────────────────────────────────────────────────
export type SpendEntry = { id: string; period_start: string; period_end: string; amount: number; note: string | null };
export type StatusBucket = { count: number; total: number };

export type RoasData = {
  range: { start: string; end: string };
  spend: number;                 // pro-rated ad spend in the window
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
};

type OrderRow = {
  status: string;
  total: number | null;
  excluded_from_stock: boolean;
  cancel_category: string | null;
  return_kind?: string | null;
  created_at: string;
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

  // Orders in window — resilient to a missing return_kind column.
  const withKind = "status, total, excluded_from_stock, cancel_category, return_kind, created_at";
  const noKind = "status, total, excluded_from_stock, cancel_category, created_at";
  let rows: OrderRow[] = [];
  let classified = true;
  const q = await sb.from("orders").select(withKind).gte("created_at", startISO).lte("created_at", endISO);
  if (q.error) {
    classified = false;
    const q2 = await sb.from("orders").select(noKind).gte("created_at", startISO).lte("created_at", endISO);
    rows = (q2.data ?? []) as OrderRow[];
  } else {
    rows = (q.data ?? []) as OrderRow[];
  }
  const orders = rows.filter((r) => !r.excluded_from_stock);

  const byStatus: Record<string, StatusBucket> = {};
  for (const r of orders) {
    const k = r.status ?? "?";
    (byStatus[k] ??= { count: 0, total: 0 });
    byStatus[k].count++;
    byStatus[k].total += Number(r.total) || 0;
  }
  const B = (k: string): StatusBucket => byStatus[k] ?? { count: 0, total: 0 };
  for (const k of Object.keys(byStatus)) byStatus[k].total = round2(byStatus[k].total);

  const gross = round2(orders.reduce((s, r) => s + (Number(r.total) || 0), 0));
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
    ? orders.filter((r) => isRet(r.status) && r.return_kind === "uncollected").length
    : 0;

  // Pro-rate each spend entry by the fraction of its days that fall in the window.
  const spendEntries = await fetchSpend();
  let spend = 0;
  for (const e of spendEntries) {
    const entryDays = inclusiveDays(e.period_start, e.period_end);
    if (entryDays <= 0) continue;
    spend += e.amount * (overlapDays(startISO, endISO, e.period_start, e.period_end) / entryDays);
  }
  spend = round2(spend);

  const metaRoas = spend > 0 ? round2(gross / spend) : null;
  const realRoas = spend > 0 ? round2(real / spend) : null;
  const potentialRoas = spend > 0 ? round2((real + inMotion + pending) / spend) : null;
  const exaggerationPct = real > 0 ? Math.round(((gross - real) / real) * 100) : null;
  const cancelRate = orders.length > 0 ? Math.round((cancelled.count / orders.length) * 1000) / 10 : 0;

  return {
    range: { start: startISO, end: endISO },
    spend,
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
  };
}
