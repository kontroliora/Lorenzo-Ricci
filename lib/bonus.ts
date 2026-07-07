import { createClient } from "@/lib/supabase/server";

// € per successfully delivered (Econt-confirmed) parcel.
export const BONUS_RATE = 2.5;

export type BonusParcel = {
  id: number;
  name: string | null;
  tracking_number: string | null;
  completed_at: string;
};

export type BonusPeriod = {
  key: string;   // "2026-07"
  label: string; // "юли"
  count: number;
  amount: number;
};

export type BonusData = {
  rate: number;
  current: {
    periodStart: string;
    periodEnd: string;
    count: number;
    amount: number;
    parcels: BonusParcel[];
  };
  history: BonusPeriod[]; // past periods, most recent first
  totalPaid: number;
};

const MONTHS_BG = [
  "януари", "февруари", "март", "април", "май", "юни",
  "юли", "август", "септември", "октомври", "ноември", "декември",
];

// The bonus period runs from the 5th of a month to the 5th of the next.
// Returns the most recent 5th (00:00 UTC) on or before d.
function periodStartFor(d: Date): Date {
  const y = d.getUTCFullYear(), m = d.getUTCMonth(), day = d.getUTCDate();
  return day >= 5 ? new Date(Date.UTC(y, m, 5)) : new Date(Date.UTC(y, m - 1, 5));
}
function addMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()));
}
function periodKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function getBonusData(): Promise<BonusData> {
  const now = new Date();
  const curStart = periodStartFor(now);
  const curEnd = addMonth(curStart);

  const empty: BonusData = {
    rate: BONUS_RATE,
    current: { periodStart: curStart.toISOString(), periodEnd: curEnd.toISOString(), count: 0, amount: 0, parcels: [] },
    history: [],
    totalPaid: 0,
  };

  const supabase = await createClient();
  // ONLY Econt-confirmed deliveries earn the bonus — manual completions never count.
  const { data, error } = await supabase
    .from("orders")
    .select("id, name, tracking_number, completed_at")
    .eq("status", "completed")
    .eq("completed_source", "econt")
    .eq("excluded_from_stock", false)
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false });

  if (error || !data) return empty;

  const curParcels: BonusParcel[] = [];
  const past = new Map<string, { start: Date; count: number }>();

  for (const row of data as BonusParcel[]) {
    const start = periodStartFor(new Date(row.completed_at));
    if (start.getTime() === curStart.getTime()) {
      curParcels.push(row);
    } else {
      const k = periodKey(start);
      const e = past.get(k) ?? { start, count: 0 };
      e.count++;
      past.set(k, e);
    }
  }

  const history: BonusPeriod[] = Array.from(past.values())
    .sort((a, b) => b.start.getTime() - a.start.getTime())
    .map((p) => ({
      key: periodKey(p.start),
      label: MONTHS_BG[p.start.getUTCMonth()],
      count: p.count,
      amount: +(p.count * BONUS_RATE).toFixed(2),
    }));

  return {
    rate: BONUS_RATE,
    current: {
      periodStart: curStart.toISOString(),
      periodEnd: curEnd.toISOString(),
      count: curParcels.length,
      amount: +(curParcels.length * BONUS_RATE).toFixed(2),
      parcels: curParcels,
    },
    history,
    totalPaid: +history.reduce((s, p) => s + p.amount, 0).toFixed(2),
  };
}

// App-layer owner gate (mirrors the RLS is_owner()). admin_users self-read policy
// returns only the caller's own row, so this reflects the logged-in admin.
export async function isOwner(): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.from("admin_users").select("role").maybeSingle();
  return (data as { role?: string } | null)?.role === "owner";
}
