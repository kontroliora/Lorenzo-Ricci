"use server";
// Owner-gated reads for the ТРАФИК tab, the per-ad block of the ROAS tab and the health bar. Read-only.
import { isOwner } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { computeTraffic, type TrafficData } from "@/lib/traffic";
import { computeAdPerformance, type AdPerformance } from "@/lib/ad-performance";
import { periodRange, type Market, type PeriodKey } from "@/lib/sofia-time";

const okPeriod = (p: string): PeriodKey => (p === "today" || p === "7d" || p === "30d" ? p : "7d");
const okMarket = (m: string): Market => (m === "bg" || m === "ro" ? m : "all");

export async function getTraffic(period: string, market: string): Promise<TrafficData | null> {
  if (!(await isOwner())) return null;
  return computeTraffic(supabaseAdmin(), okPeriod(period), okMarket(market));
}

export async function getAdPerformance(period: string, market: string): Promise<AdPerformance | null> {
  if (!(await isOwner())) return null;
  const sb = supabaseAdmin();
  const r = periodRange(okPeriod(period));
  const today = periodRange("today");
  const tv = await sb.rpc("traffic_summary", { p_start: r.startISO, p_end: r.endISO, p_market: okMarket(market) === "all" ? null : market });
  const utmVisitors = ((tv.data as { campaigns?: { campaign: string | null; content: string | null; sessions: number }[] } | null)?.campaigns) ?? [];
  return computeAdPerformance(sb, {
    since: r.sinceDay, until: r.untilDay, startISO: r.startISO, endISO: r.endISO,
    today: today.untilDay, todayStartISO: today.startISO, market: okMarket(market), utmVisitors,
  });
}

export type HealthItem = { key: string; title: string; detail: string | null; since: string | null };
export type HealthState = { lastRun: string | null; problems: HealthItem[]; unknown: HealthItem[]; ready: boolean };

export async function getHealth(): Promise<HealthState | null> {
  if (!(await isOwner())) return null;
  const q = await supabaseAdmin().from("health_status").select("key, ok, title, detail, since, checked_at");
  if (q.error) return { lastRun: null, problems: [], unknown: [], ready: false };
  const rows = q.data ?? [];
  const run = rows.find((r) => r.key === "_run");
  const lastRun = (run?.checked_at as string | undefined) ?? null;
  const problems: HealthItem[] = rows.filter((r) => !r.ok && r.key !== "_run").map((r) => ({ key: r.key, title: r.title, detail: r.detail, since: r.since }));
  // The checks themselves stopped (GitHub schedule off / endpoint failing) - that is a problem too.
  if (lastRun && Date.now() - Date.parse(lastRun) > 45 * 60_000)
    problems.unshift({ key: "_stale", title: "Проверките не са вървели от над 45 мин", detail: "GitHub Actions „health“ или /api/cron/health не работи", since: lastRun });
  const unknown = rows.filter((r) => r.ok && typeof r.detail === "string" && r.detail.startsWith("не е проверено"))
    .map((r) => ({ key: r.key, title: r.title, detail: r.detail, since: null }));
  return { lastRun, problems, unknown, ready: true };
}
