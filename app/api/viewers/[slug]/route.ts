// Product page "X души разглеждат този продукт в момента" (owner, 15.11.2026: real, not generated): the number of DIFFERENT
// visitors (page_views.vid, the tracker's random browser id - components/analytics/PageViewTracker.tsx) who opened this
// product page in the last 5 minutes. Bots and Meta's scrapers never reach page_views (the beacon waits for a human signal and
// /api/pv drops bot user agents). The page hides the line under 2.
// Edge + one PostgREST read on the created_at index; the CDN keeps the answer 30 s, so a busy page costs ~2 reads a minute.
import type { NextRequest } from "next/server";

export const runtime = "edge";

const WINDOW_MS = 5 * 60 * 1000;
const json = (count: number, cache: boolean) =>
  new Response(JSON.stringify({ count }), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": cache ? "public, max-age=0, s-maxage=30, stale-while-revalidate=30" : "no-store",
    },
  });

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return json(0, false);
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").replace(/\s/g, "");
  if (!url || !key) return json(0, false);
  try {
    const since = new Date(Date.now() - WINDOW_MS).toISOString();
    const r = await fetch(
      `${url}/rest/v1/page_views?select=vid&product_slug=eq.${slug}&created_at=gte.${encodeURIComponent(since)}&limit=1000`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(4000) },
    );
    if (!r.ok) return json(0, false);
    const rows = (await r.json()) as { vid: string }[];
    return json(new Set(rows.map((x) => x.vid)).size, true);
  } catch {
    return json(0, false);
  }
}
