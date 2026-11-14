// Meta Marketing API -> meta_ads (one row per ad) + meta_ad_insights (one row per ad per day). Server-only.
// Env: META_ADS_TOKEN (ads_read), META_AD_ACCOUNT_ID (with or without "act_"). The account runs in EUR, time zone Europe/Sofia,
// so Meta's dates are Sofia dates. Called by /api/cron/meta-ads (hourly: yesterday + today; daily: the last 3 days).
import type { SupabaseClient } from "@supabase/supabase-js";
import { GRAPH_VERSION } from "@/lib/meta-capi";

const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

export const sofiaDate = (d = new Date()): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Sofia", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

function account(): { id: string; token: string } {
  const token = (process.env.META_ADS_TOKEN ?? "").trim();
  const raw = (process.env.META_AD_ACCOUNT_ID ?? "").trim().replace(/^act_/, "");
  if (!token || !raw) throw new Error("META_ADS_TOKEN / META_AD_ACCOUNT_ID not set");
  return { id: `act_${raw}`, token };
}

type Paged<T> = { data?: T[]; paging?: { next?: string }; error?: { message?: string; code?: number } };

async function getAll<T>(path: string, params: Record<string, string>, limit = 200): Promise<T[]> {
  const { token } = account();
  const qs = new URLSearchParams({ ...params, access_token: token, limit: String(limit) });
  let next: string | undefined = `${GRAPH}/${path}?${qs}`;
  const out: T[] = [];
  for (let page = 0; next && page < 60; page++) {
    const res = await fetch(next, { cache: "no-store", signal: AbortSignal.timeout(25_000) });
    const json = (await res.json()) as Paged<T>;
    if (json.error) throw new Error(`Meta API: ${json.error.message ?? "error"} (${json.error.code ?? res.status})`);
    out.push(...(json.data ?? []));
    next = json.paging?.next;
  }
  return out;
}

type RawAd = {
  id: string; name?: string; effective_status?: string; created_time?: string;
  adset?: { id?: string; name?: string; targeting?: { geo_locations?: { countries?: string[] } } };
  campaign?: { id?: string; name?: string };
  creative?: Record<string, unknown> & { url_tags?: string };
};
export type MetaAd = {
  ad_id: string; ad_name: string | null; adset_id: string | null; adset_name: string | null; campaign_id: string | null; campaign_name: string | null;
  effective_status: string | null; market: "bg" | "ro"; landing_url: string | null; product_slug: string | null; url_tags: string | null;
  created_time: string | null;
};

/** The ad's landing page on our site (first lorenzo-ricci.com link anywhere in the creative) and the product it shows. */
export function landingOf(creative: unknown): { url: string | null; slug: string | null; ro: boolean } {
  const m = JSON.stringify(creative ?? {}).match(/https?:\\?\/\\?\/(?:www\.)?lorenzo-ricci\.com[^"\s\\]*/);
  if (!m) return { url: null, slug: null, ro: false };
  const url = m[0].replace(/\\\//g, "/");
  let path = "/";
  try { path = new URL(url).pathname; } catch { /* keep "/" */ }
  const slug = path.match(/^\/(?:ro\/produse|products)\/([a-z0-9-]+)/)?.[1] ?? null;
  return { url, slug, ro: path === "/ro" || path.startsWith("/ro/") };
}

const AD_FIELDS = "name,effective_status,created_time,adset{name,targeting{geo_locations}},campaign{name},creative{url_tags,object_story_spec,asset_feed_spec{link_urls}}";
const LIVE_STATUSES = ["ACTIVE", "PAUSED", "CAMPAIGN_PAUSED", "ADSET_PAUSED", "WITH_ISSUES", "PENDING_REVIEW", "DISAPPROVED", "IN_PROCESS", "PREAPPROVED"];

function toAd(a: RawAd): MetaAd {
  const land = landingOf(a.creative);
  const countries = a.adset?.targeting?.geo_locations?.countries ?? [];
  const ro = (countries.length > 0 && countries.every((c) => c === "RO")) || (countries.length === 0 && land.ro);
  return {
    ad_id: a.id, ad_name: a.name ?? null,
    adset_id: a.adset?.id ?? null, adset_name: a.adset?.name ?? null,
    campaign_id: a.campaign?.id ?? null, campaign_name: a.campaign?.name ?? null,
    effective_status: a.effective_status ?? null,
    market: ro ? "ro" : "bg",
    landing_url: land.url, product_slug: land.slug,
    url_tags: typeof a.creative?.url_tags === "string" ? a.creative.url_tags : null,
    created_time: a.created_time ? new Date(a.created_time).toISOString() : null,
  };
}

/** Ads of the account with these delivery statuses (all live ones by default; ~1 s per 25 ads, creatives are large). */
export async function fetchAds(statuses: string[] = LIVE_STATUSES): Promise<MetaAd[]> {
  const { id } = account();
  // Meta refuses 200 per page with full creatives ("reduce the amount of data"): 25.
  const raw = await getAll<RawAd>(`${id}/ads`, { fields: AD_FIELDS, effective_status: JSON.stringify(statuses) }, 25);
  return raw.map(toAd);
}

/** Specific ads by id (any status, also archived / deleted), 25 per request. (The ?ids= batch read is gone since v26.0.) */
export async function fetchAdsByIds(ids: string[]): Promise<MetaAd[]> {
  const { id } = account();
  const out: MetaAd[] = [];
  for (let i = 0; i < ids.length; i += 25) {
    const raw = await getAll<RawAd>(`${id}/ads`, {
      fields: AD_FIELDS,
      filtering: JSON.stringify([
        { field: "ad.id", operator: "IN", value: ids.slice(i, i + 25) },
        { field: "ad.effective_status", operator: "IN", value: [...LIVE_STATUSES, "ARCHIVED", "DELETED"] },
      ]),
    }, 25);
    out.push(...raw.map(toAd));
  }
  return out;
}

type RawInsight = {
  date_start: string; ad_id: string; adset_id?: string; campaign_id?: string;
  spend?: string; impressions?: string; clicks?: string; inline_link_clicks?: string; ctr?: string; cpm?: string;
  actions?: { action_type: string; value: string }[]; action_values?: { action_type: string; value: string }[];
};
// Meta reports the same purchase under several names; take the first one present (omni = pixel + CAPI, de-duplicated).
const PURCHASE_TYPES = ["omni_purchase", "purchase", "offsite_conversion.fb_pixel_purchase"];
const pick = (list: { action_type: string; value: string }[] | undefined): number => {
  for (const t of PURCHASE_TYPES) { const hit = list?.find((x) => x.action_type === t); if (hit) return Number(hit.value) || 0; }
  return 0;
};

/** Account-level spend per Sofia day straight from Meta (no ad breakdown) - the number Ads Manager shows. Used by the revenue audit. */
export async function fetchAccountDailySpend(since: string, until: string): Promise<Map<string, number>> {
  const { id } = account();
  const raw = await getAll<{ date_start: string; spend?: string }>(`${id}/insights`, {
    level: "account", time_increment: "1", time_range: JSON.stringify({ since, until }), fields: "spend",
  });
  return new Map(raw.map((r) => [r.date_start, Number(r.spend) || 0]));
}

export async function fetchInsights(since: string, until: string) {
  const { id } = account();
  const raw = await getAll<RawInsight>(`${id}/insights`, {
    level: "ad",
    time_increment: "1",
    time_range: JSON.stringify({ since, until }),
    fields: "ad_id,adset_id,campaign_id,spend,impressions,clicks,inline_link_clicks,ctr,cpm,actions,action_values",
  });
  return raw.map((r) => ({
    date: r.date_start, ad_id: r.ad_id, adset_id: r.adset_id ?? null, campaign_id: r.campaign_id ?? null,
    spend: Number(r.spend) || 0, impressions: Number(r.impressions) || 0, clicks: Number(r.clicks) || 0,
    link_clicks: Number(r.inline_link_clicks) || 0,
    ctr: r.ctr != null ? Number(r.ctr) : null, cpm: r.cpm != null ? Number(r.cpm) : null,
    purchases: Math.round(pick(r.actions)), purchase_value: Math.round(pick(r.action_values) * 100) / 100,
  }));
}

/**
 * Pull the last `days` days (Sofia dates, today included) and upsert them.
 * Ads: full = every live ad (daily run, ~20 s for ~300 ads); otherwise only the ACTIVE ones, plus ads that were ACTIVE before or
 * have spend in the window but are not known yet (so a paused ad flips to paused and a new ad gets its name / market).
 */
export async function syncMeta(sb: SupabaseClient, days: number, full = days >= 3) {
  const n = Math.min(Math.max(1, Math.floor(days)), 90);
  const until = sofiaDate();
  const since = sofiaDate(new Date(Date.now() - (n - 1) * 86_400_000));
  const now = new Date().toISOString();

  const [insights, ads] = await Promise.all([fetchInsights(since, until), fetchAds(full ? LIVE_STATUSES : ["ACTIVE"])]);
  if (!full) {
    const known = await sb.from("meta_ads").select("ad_id, effective_status, market");
    const have = new Set(ads.map((a) => a.ad_id));
    const rows = (known.data ?? []) as { ad_id: string; effective_status: string | null }[];
    const knownIds = new Set(rows.map((r) => r.ad_id));
    const extra = new Set<string>();
    for (const r of rows) if (r.effective_status === "ACTIVE" && !have.has(r.ad_id)) extra.add(r.ad_id);
    for (const r of insights) if (!have.has(r.ad_id) && !knownIds.has(r.ad_id)) extra.add(r.ad_id);
    if (extra.size) ads.push(...(await fetchAdsByIds([...extra].slice(0, 100))));
  }
  if (ads.length) {
    let { error } = await sb.from("meta_ads").upsert(ads.map((a) => ({ ...a, updated_at: now })), { onConflict: "ad_id" });
    // Until supabase/monitoring_v2.sql adds meta_ads.created_time, store the ads without it (the ad rule then waits).
    if (error && /created_time/.test(error.message)) {
      ({ error } = await sb.from("meta_ads").upsert(ads.map(({ created_time: _c, ...a }) => ({ ...a, updated_at: now })), { onConflict: "ad_id" }));
    }
    if (error) throw new Error(`meta_ads: ${error.message}`);
  }
  const marketRows = await sb.from("meta_ads").select("ad_id, market");
  const market = new Map(((marketRows.data ?? []) as { ad_id: string; market: string }[]).map((a) => [a.ad_id, a.market]));
  for (const a of ads) market.set(a.ad_id, a.market);
  const rows = insights.map((r) => ({ ...r, market: market.get(r.ad_id) ?? "bg", updated_at: now }));
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await sb.from("meta_ad_insights").upsert(rows.slice(i, i + 500), { onConflict: "date,ad_id" });
    if (error) throw new Error(`meta_ad_insights: ${error.message}`);
  }
  return { since, until, full, ads: ads.length, rows: rows.length, spend: Math.round(rows.reduce((s, r) => s + r.spend, 0) * 100) / 100 };
}
