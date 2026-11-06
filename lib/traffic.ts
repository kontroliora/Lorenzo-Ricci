// The ТРАФИК tab: page_views (traffic_summary RPC) x orders. Read-only, server-only; callers gate on isOwner().
import type { SupabaseClient } from "@supabase/supabase-js";
import { products } from "@/lib/products";
import { fetchOrders, inMarket, isMetaOrder } from "@/lib/ad-performance";
import { periodRange, type Market, type PeriodKey } from "@/lib/sofia-time";

type Summary = {
  visitors: number; sessions: number; pageviews: number;
  daily: { day: string; visitors: number; views: number }[];
  pages: { path: string; views: number; visitors: number }[];
  sources: { source: string; sessions: number; visitors: number }[];
  products: { slug: string; views: number; visitors: number }[];
  devices: { device: string; visitors: number }[];
  countries: { country: string; visitors: number }[];
  campaigns: { campaign: string | null; content: string | null; sessions: number; visitors: number }[];
};
export type ProductRow = { slug: string; name: string; views: number; visitors: number; sold: number; orders: number; conv: number | null; flag: boolean };
export type TrafficData = {
  period: PeriodKey; market: Market; range: { start: string; end: string };
  flagAt: number;                       // VIEWS_NO_SALE_FLAG (for the client)
  ready: boolean;                       // page_views + traffic_summary exist
  firstView: string | null;             // tracking started (so short history is explained)
  visitors: number; sessions: number; pageviews: number;
  orders: number; revenue: number; metaOrders: number; conversion: number | null;   // orders / visitors, %
  daily: Summary["daily"]; pages: Summary["pages"]; sources: Summary["sources"]; devices: Summary["devices"]; countries: Summary["countries"];
  products: ProductRow[];
  campaigns: Summary["campaigns"];
};

// A product is flagged when this many different people looked at it in the window and nobody bought it.
export const VIEWS_NO_SALE_FLAG = 30;

const nameOf = new Map(products.map((p) => [p.slug, p.name]));

export async function computeTraffic(sb: SupabaseClient, period: PeriodKey, market: Market): Promise<TrafficData> {
  const r = periodRange(period);
  const [sum, orders, first] = await Promise.all([
    sb.rpc("traffic_summary", { p_start: r.startISO, p_end: r.endISO, p_market: market === "all" ? null : market }),
    fetchOrders(sb, r.startISO, r.endISO),
    sb.from("page_views").select("created_at").order("created_at").limit(1),
  ]);
  const s = (sum.data ?? null) as Summary | null;
  const ords = inMarket(orders, market);

  const sold = new Map<string, { qty: number; orders: number }>();
  for (const o of ords) {
    const seen = new Set<string>();
    for (const it of o.items) {
      if (!it?.slug) continue;
      const e = sold.get(it.slug) ?? { qty: 0, orders: 0 };
      e.qty += Math.max(1, Number(it.quantity ?? it.qty ?? 1));
      if (!seen.has(it.slug)) { e.orders++; seen.add(it.slug); }
      sold.set(it.slug, e);
    }
  }
  const slugs = new Set<string>([...(s?.products ?? []).map((p) => p.slug), ...sold.keys()]);
  const productRows: ProductRow[] = [...slugs].map((slug) => {
    const v = s?.products.find((p) => p.slug === slug);
    const so = sold.get(slug) ?? { qty: 0, orders: 0 };
    const visitors = v?.visitors ?? 0;
    return {
      slug, name: nameOf.get(slug) ?? slug, views: v?.views ?? 0, visitors, sold: so.qty, orders: so.orders,
      conv: visitors > 0 ? Math.round((so.orders / visitors) * 1000) / 10 : null,
      flag: so.qty === 0 && visitors >= VIEWS_NO_SALE_FLAG,
    };
  }).sort((a, b) => Number(b.flag) - Number(a.flag) || b.visitors - a.visitors || b.sold - a.sold);

  const visitors = s?.visitors ?? 0;
  return {
    period, market, range: { start: r.startISO, end: r.endISO },
    flagAt: VIEWS_NO_SALE_FLAG,
    ready: !sum.error,
    firstView: (first.data?.[0]?.created_at as string | undefined) ?? null,
    visitors, sessions: s?.sessions ?? 0, pageviews: s?.pageviews ?? 0,
    orders: ords.length, revenue: Math.round(ords.reduce((t, o) => t + o.totalEur, 0) * 100) / 100,
    metaOrders: ords.filter(isMetaOrder).length,
    conversion: visitors > 0 ? Math.round((ords.length / visitors) * 1000) / 10 : null,
    daily: s?.daily ?? [], pages: s?.pages ?? [], sources: s?.sources ?? [], devices: s?.devices ?? [], countries: s?.countries ?? [],
    products: productRows, campaigns: s?.campaigns ?? [],
  };
}
