// Read-only joins for the panel: Meta ad data (meta_ads / meta_ad_insights) x orders (utm_* / fbclid) x traffic (page_views).
// Never writes an order, a price or stock. Server-only; callers gate on isOwner() (the panel) or CRON auth (health checks).
import type { SupabaseClient } from "@supabase/supabase-js";
import { EUR_RON } from "@/lib/ro/config";
import { isUnpaidCardAttempt } from "@/lib/order-status";
import { shiftDay, sofiaMidnight, type Market } from "@/lib/sofia-time";

import { MAX_COST_PER_ORDER, MIN_AD_AGE_DAYS, RULE_DAYS, ZERO_ORDER_SPEND_3D } from "@/lib/ad-rule";
export { MAX_COST_PER_ORDER, MIN_AD_AGE_DAYS, RULE_DAYS, ZERO_ORDER_SPEND_3D };

const round2 = (n: number) => Math.round(n * 100) / 100;

// ── Orders ───────────────────────────────────────────────────────────────────
export type MarketingOrder = {
  created_at: string; status: string; totalEur: number; market: "bg" | "ro";
  utm_source: string | null; utm_campaign: string | null; fbclid: string | null;
  items: { slug?: string; quantity?: number; qty?: number }[];
};

/** Real orders (not test / excluded, not unpaid card attempts) created in the window, totals in euro (RO lei / EUR_RON). */
export async function fetchOrders(sb: SupabaseClient, startISO: string, endISO: string): Promise<MarketingOrder[]> {
  const base = "created_at, status, total, excluded_from_stock, ship_country, items";
  const variants = [`${base}, payment_status, utm_source, utm_campaign, fbclid`, `${base}, utm_source, utm_campaign, fbclid`, `${base}, payment_status`, base];
  for (const cols of variants) {
    const out: Record<string, unknown>[] = [];
    let failed = false;
    for (let from = 0; from < 20_000; from += 1000) {
      const q = await sb.from("orders").select(cols).gte("created_at", startISO).lte("created_at", endISO).order("created_at").range(from, from + 999);
      if (q.error) { failed = true; break; }
      out.push(...((q.data ?? []) as unknown as Record<string, unknown>[]));
      if ((q.data ?? []).length < 1000) break;
    }
    if (failed) continue;
    return out
      .filter((r) => !r.excluded_from_stock && !isUnpaidCardAttempt(r as Parameters<typeof isUnpaidCardAttempt>[0]))
      .map((r) => {
        const ro = r.ship_country === "RO";
        return {
          created_at: String(r.created_at), status: String(r.status ?? ""),
          totalEur: round2(ro ? (Number(r.total) || 0) / EUR_RON : Number(r.total) || 0),
          market: ro ? "ro" : "bg",
          utm_source: (r.utm_source as string) ?? null, utm_campaign: (r.utm_campaign as string) ?? null, fbclid: (r.fbclid as string) ?? null,
          items: Array.isArray(r.items) ? (r.items as MarketingOrder["items"]) : [],
        };
      });
  }
  return [];
}

export const inMarket = <T extends { market: string }>(rows: T[], m: Market) => (m === "all" ? rows : rows.filter((r) => r.market === m));
const META_SOURCES = /^(fb|facebook|ig|instagram|meta|an|audience_network|messenger)$/i;
export const isMetaOrder = (o: MarketingOrder) => !!o.fbclid || (!!o.utm_source && META_SOURCES.test(o.utm_source));

// ── Ads ──────────────────────────────────────────────────────────────────────
export type AdRow = {
  ad_id: string; ad_name: string; adset_name: string; campaign_id: string; campaign_name: string;
  status: string; market: "bg" | "ro"; product_slug: string | null; landing_url: string | null; tagged: boolean;
  spend: number; impressions: number; clicks: number; link_clicks: number; ctr: number | null; cpm: number | null;
  metaPurchases: number; metaValue: number;
  orders: number; revenue: number;        // our orders matched by utm_campaign = ad id
  costPerOrder: number | null; roas: number | null; basis: "ours" | "meta";
  todaySpend: number; todayOrders: number;
  spend3: number; orders3: number;         // last RULE_DAYS Sofia days, today included (the ad rule)
  ageDays: number | null;                  // since Meta's created_time; null = not known yet (meta_ads.created_time missing)
  visitors: number;                        // page_views sessions with utm_campaign = ad id (or utm_content)
  red: string[];                           // why it is red
};
export type CampaignRow = {
  campaign_id: string; campaign_name: string; market: "bg" | "ro";
  spend: number; orders: number; revenue: number; metaPurchases: number; costPerOrder: number | null; roas: number | null; ads: AdRow[];
};
export type AdPerformance = {
  since: string; until: string; market: Market;
  lastSync: string | null;
  tagging: "on" | "off";                    // do the ads carry utm_campaign? off -> per-ad orders fall back to Meta's purchases
  totals: { spend: number; impressions: number; clicks: number; metaPurchases: number; metaValue: number; orders: number; revenue: number;
            metaOrders: number; metaRevenue: number; costPerOrder: number | null; roas: number | null };
  unmatched: { orders: number; revenue: number };   // Meta orders (fbclid / utm_source facebook) not matched to an ad or campaign
  campaigns: CampaignRow[];
  ads: AdRow[];
};

type AdMeta = { ad_id: string; ad_name: string | null; adset_id: string | null; adset_name: string | null; campaign_id: string | null; campaign_name: string | null;
  effective_status: string | null; market: string; product_slug: string | null; landing_url: string | null; url_tags: string | null; created_time?: string | null };
type Ins = { date: string; ad_id: string; campaign_id: string | null; market: string; spend: number; impressions: number; clicks: number; link_clicks: number; purchases: number; purchase_value: number; updated_at: string };

async function selectAll<T>(sb: SupabaseClient, table: string, cols: string, apply: (q: ReturnType<ReturnType<SupabaseClient["from"]>["select"]>) => typeof q): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < 50_000; from += 1000) {
    const q = await apply(sb.from(table).select(cols)).range(from, from + 999);
    if (q.error) return out;
    out.push(...((q.data ?? []) as unknown as T[]));
    if ((q.data ?? []).length < 1000) break;
  }
  return out;
}

const AD_META_COLS = "ad_id, ad_name, adset_id, adset_name, campaign_id, campaign_name, effective_status, market, product_slug, landing_url, url_tags";
export async function fetchAdMeta(sb: SupabaseClient): Promise<AdMeta[]> {
  // created_time comes with supabase/monitoring_v2.sql; before that column exists, read without it (age unknown).
  const probe = await sb.from("meta_ads").select("created_time").limit(1);
  return selectAll<AdMeta>(sb, "meta_ads", probe.error ? AD_META_COLS : `${AD_META_COLS}, created_time`, (q) => q);
}

/** Per-ad / per-campaign performance for Sofia days [since, until]; orders in [startISO, endISO]. today = Sofia date of now. */
export async function computeAdPerformance(sb: SupabaseClient, a: {
  since: string; until: string; startISO: string; endISO: string; today: string; todayStartISO: string; market: Market;
  orders?: MarketingOrder[]; utmVisitors?: { campaign: string | null; content: string | null; sessions: number }[];
}): Promise<AdPerformance> {
  const metas = await fetchAdMeta(sb);
  const meta = new Map(metas.map((m) => [m.ad_id, m]));
  // The ad rule always looks at the last RULE_DAYS days, whatever period is shown.
  const ruleDay = shiftDay(a.today, RULE_DAYS - 1);
  const ruleStartISO = sofiaMidnight(ruleDay).toISOString();
  const minDay = [a.since, a.today, ruleDay].sort()[0];
  const ins = await selectAll<Ins>(sb, "meta_ad_insights", "date, ad_id, campaign_id, market, spend, impressions, clicks, link_clicks, purchases, purchase_value, updated_at",
    (q) => q.gte("date", minDay).lte("date", a.until >= a.today ? a.until : a.today));
  const orders = a.orders ?? await fetchOrders(sb, [a.todayStartISO, a.startISO, ruleStartISO].sort()[0], a.endISO);

  // utm_campaign on an order / visit -> what it names: an ad id, an ad set id, a campaign id or a campaign name.
  const byAd = new Set(metas.map((m) => m.ad_id));
  const adsetToCampaign = new Map(metas.filter((m) => m.adset_id).map((m) => [m.adset_id!, m.campaign_id ?? ""]));
  const campByKey = new Map<string, string>();
  for (const m of metas) if (m.campaign_id) { campByKey.set(m.campaign_id, m.campaign_id); if (m.campaign_name) campByKey.set(m.campaign_name.trim().toLowerCase(), m.campaign_id); }
  const resolve = (utm: string | null): { ad?: string; campaign?: string } | null => {
    const k = (utm ?? "").trim();
    if (!k) return null;
    if (byAd.has(k)) return { ad: k };
    if (adsetToCampaign.has(k)) return { campaign: adsetToCampaign.get(k) };
    const c = campByKey.get(k) ?? campByKey.get(k.toLowerCase());
    return c ? { campaign: c } : null;
  };

  const tagged = (m?: AdMeta) => !!m?.url_tags && /utm_campaign=/.test(m.url_tags);
  const tagging: "on" | "off" = metas.some((m) => m.effective_status === "ACTIVE" && tagged(m)) ? "on" : "off";

  const inWindow = (o: MarketingOrder) => o.created_at >= a.startISO && o.created_at <= a.endISO;
  const isToday = (o: MarketingOrder) => o.created_at >= a.todayStartISO;
  const inRule = (o: MarketingOrder) => o.created_at >= ruleStartISO;
  const ords = inMarket(orders, a.market);

  const adOrders = new Map<string, { n: number; rev: number; today: number; n3: number }>();
  const campOrders = new Map<string, { n: number; rev: number }>();
  let unmatchedN = 0, unmatchedRev = 0, metaN = 0, metaRev = 0;
  for (const o of ords) {
    const hit = resolve(o.utm_campaign);
    if (hit?.ad) {
      const e = adOrders.get(hit.ad) ?? { n: 0, rev: 0, today: 0, n3: 0 };
      if (inWindow(o)) { e.n++; e.rev += o.totalEur; }
      if (isToday(o)) e.today++;
      if (inRule(o)) e.n3++;
      adOrders.set(hit.ad, e);
    } else if (hit?.campaign && inWindow(o)) {
      const e = campOrders.get(hit.campaign) ?? { n: 0, rev: 0 };
      e.n++; e.rev += o.totalEur; campOrders.set(hit.campaign, e);
    }
    if (inWindow(o) && (hit || isMetaOrder(o))) { metaN++; metaRev += o.totalEur; if (!hit) { unmatchedN++; unmatchedRev += o.totalEur; } }
  }

  const visitors = new Map<string, number>();
  for (const v of a.utmVisitors ?? []) for (const k of [v.content, v.campaign]) if (k && byAd.has(k)) { visitors.set(k, (visitors.get(k) ?? 0) + v.sessions); break; }

  // Sum the daily rows per ad: window and today separately.
  type Acc = { spend: number; impressions: number; clicks: number; link_clicks: number; purchases: number; value: number; todaySpend: number; todayPurchases: number; spend3: number; purchases3: number };
  const acc = new Map<string, Acc>();
  let lastSync: string | null = null;
  for (const r of ins) {
    const m = meta.get(r.ad_id);
    const market = (m?.market ?? r.market) as "bg" | "ro";
    if (a.market !== "all" && market !== a.market) continue;
    if (!lastSync || r.updated_at > lastSync) lastSync = r.updated_at;
    const e = acc.get(r.ad_id) ?? { spend: 0, impressions: 0, clicks: 0, link_clicks: 0, purchases: 0, value: 0, todaySpend: 0, todayPurchases: 0, spend3: 0, purchases3: 0 };
    if (r.date >= a.since && r.date <= a.until) {
      e.spend += Number(r.spend) || 0; e.impressions += r.impressions; e.clicks += r.clicks; e.link_clicks += r.link_clicks;
      e.purchases += r.purchases; e.value += Number(r.purchase_value) || 0;
    }
    if (r.date === a.today) { e.todaySpend += Number(r.spend) || 0; e.todayPurchases += r.purchases; }
    if (r.date >= ruleDay && r.date <= a.today) { e.spend3 += Number(r.spend) || 0; e.purchases3 += r.purchases; }
    acc.set(r.ad_id, e);
  }

  const ads: AdRow[] = [];
  for (const [ad_id, e] of acc) {
    const m = meta.get(ad_id);
    if (e.spend <= 0 && e.todaySpend <= 0 && e.impressions === 0 && e.spend3 <= 0) continue;
    const ours = adOrders.get(ad_id) ?? { n: 0, rev: 0, today: 0, n3: 0 };
    const useOurs = tagging === "on" && tagged(m);
    const orders = useOurs ? ours.n : e.purchases;
    const revenue = useOurs ? round2(ours.rev) : round2(e.value);
    const todayOrders = useOurs ? ours.today : e.todayPurchases;
    const spend = round2(e.spend);
    const costPerOrder = orders > 0 ? round2(spend / orders) : null;
    const spend3 = round2(e.spend3);
    const orders3 = useOurs ? ours.n3 : e.purchases3;
    const created = m?.created_time ? Date.parse(m.created_time) : NaN;
    const ageDays = Number.isFinite(created) ? Math.floor(((Date.now() - created) / 86_400_000) * 10) / 10 : null;
    const red: string[] = [];
    if (ageDays != null && ageDays >= MIN_AD_AGE_DAYS) {
      if (orders3 === 0 && spend3 >= ZERO_ORDER_SPEND_3D) red.push(`3 дни: €${spend3.toFixed(2)} разход, 0 поръчки`);
      else if (orders3 > 0 && spend3 / orders3 > MAX_COST_PER_ORDER) red.push(`3 дни: €${(spend3 / orders3).toFixed(2)} на поръчка (> €${MAX_COST_PER_ORDER})`);
    }
    ads.push({
      ad_id, ad_name: m?.ad_name ?? ad_id, adset_name: m?.adset_name ?? "", campaign_id: m?.campaign_id ?? "", campaign_name: m?.campaign_name ?? "—",
      status: m?.effective_status ?? "?", market: (m?.market ?? "bg") as "bg" | "ro", product_slug: m?.product_slug ?? null, landing_url: m?.landing_url ?? null,
      tagged: tagged(m),
      spend, impressions: e.impressions, clicks: e.clicks, link_clicks: e.link_clicks,
      ctr: e.impressions > 0 ? round2((e.clicks / e.impressions) * 100) : null,
      cpm: e.impressions > 0 ? round2((e.spend / e.impressions) * 1000) : null,
      metaPurchases: e.purchases, metaValue: round2(e.value),
      orders, revenue, costPerOrder, roas: spend > 0 ? round2(revenue / spend) : null, basis: useOurs ? "ours" : "meta",
      todaySpend: round2(e.todaySpend), todayOrders, spend3, orders3, ageDays,
      visitors: visitors.get(ad_id) ?? 0,
      red,
    });
  }
  ads.sort((x, y) => y.spend - x.spend);

  const camps = new Map<string, CampaignRow>();
  for (const ad of ads) {
    const c = camps.get(ad.campaign_id) ?? { campaign_id: ad.campaign_id, campaign_name: ad.campaign_name, market: ad.market, spend: 0, orders: 0, revenue: 0, metaPurchases: 0, costPerOrder: null, roas: null, ads: [] };
    c.spend += ad.spend; c.orders += ad.orders; c.revenue += ad.revenue; c.metaPurchases += ad.metaPurchases; c.ads.push(ad);
    camps.set(ad.campaign_id, c);
  }
  for (const [cid, extra] of campOrders) { const c = camps.get(cid); if (c && tagging === "on") { c.orders += extra.n; c.revenue += extra.rev; } }
  const campaigns = [...camps.values()].map((c) => ({
    ...c, spend: round2(c.spend), revenue: round2(c.revenue),
    costPerOrder: c.orders > 0 ? round2(c.spend / c.orders) : null, roas: c.spend > 0 ? round2(c.revenue / c.spend) : null,
  })).sort((x, y) => y.spend - x.spend);

  const t = ads.reduce((s, x) => ({ spend: s.spend + x.spend, impressions: s.impressions + x.impressions, clicks: s.clicks + x.clicks, metaPurchases: s.metaPurchases + x.metaPurchases, metaValue: s.metaValue + x.metaValue }),
    { spend: 0, impressions: 0, clicks: 0, metaPurchases: 0, metaValue: 0 });
  const totOrders = campaigns.reduce((s, c) => s + c.orders, 0);
  const totRevenue = round2(campaigns.reduce((s, c) => s + c.revenue, 0));
  const spend = round2(t.spend);
  return {
    since: a.since, until: a.until, market: a.market, lastSync, tagging,
    totals: {
      spend, impressions: t.impressions, clicks: t.clicks, metaPurchases: t.metaPurchases, metaValue: round2(t.metaValue),
      orders: totOrders, revenue: totRevenue, metaOrders: metaN, metaRevenue: round2(metaRev),
      costPerOrder: metaN > 0 ? round2(spend / metaN) : null, roas: spend > 0 ? round2(metaRev / spend) : null,
    },
    unmatched: { orders: unmatchedN, revenue: round2(unmatchedRev) },
    campaigns, ads,
  };
}
