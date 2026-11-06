// Page-view beacon (components/analytics/PageViewTracker.tsx) -> page_views (supabase/traffic_ads_health.sql). Feeds the panel's
// ТРАФИК tab. Own events instead of a Vercel Web Analytics Drain: drains need the Pro plan + a paid add-on and still carry no BG/RO
// market or our utm_content; this row has exactly what the panel joins on. No personal data: no IP, no cookie, only the random
// browser id the tracker keeps, the path, the external referrer's host, utm_* and the country header.
// Edge runtime + one PostgREST insert: no Node function cold start, no supabase-js. Always answers 204 (a beacon reads nothing).
import type { NextRequest } from "next/server";

export const runtime = "edge";

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|meta-externalagent|headless|lighthouse|pingdom|uptime|monitor|curl|wget|python|axios|node-fetch/i;
const ID = /^[a-z0-9]{8,40}$/i;
const str = (v: unknown, max: number): string | null => {
  const s = typeof v === "string" ? v.trim().slice(0, max) : "";
  return s && /^[\p{L}\p{N} ._\-|:+/()%#=&@!~,{}]+$/u.test(s) ? s : null;
};
const none = () => new Response(null, { status: 204 });

function device(ua: string): string {
  if (/ipad|tablet|(android(?!.*mobile))/i.test(ua)) return "tablet";
  if (/mobi|iphone|android/i.test(ua)) return "mobile";
  return "desktop";
}

export async function POST(req: NextRequest) {
  try {
    const ua = req.headers.get("user-agent") ?? "";
    if (!ua || BOT.test(ua)) return none();
    // Only our own pages send this (sendBeacon carries Origin on cross-site posts; same-site may omit it).
    const origin = req.headers.get("origin");
    if (origin && !/^https:\/\/(www\.)?lorenzo-ricci\.com$/.test(origin) && !/^http:\/\/localhost(:\d+)?$/.test(origin)) return none();

    const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!b) return none();
    const vid = String(b.vid ?? ""), sid = String(b.sid ?? "");
    const path = typeof b.path === "string" ? b.path.slice(0, 200) : "";
    if (!ID.test(vid) || !ID.test(sid) || !path.startsWith("/") || path.startsWith("/lr-panel") || path.startsWith("/api/")) return none();

    const product = path.match(/^\/(?:ro\/produse|products)\/([a-z0-9-]{1,80})\/?$/);
    let refHost: string | null = null;
    if (typeof b.ref === "string" && b.ref) {
      try { const h = new URL(b.ref).hostname.replace(/^www\./, ""); if (h && !/lorenzo-ricci\.com$/.test(h)) refHost = h.slice(0, 120); } catch { /* ignore */ }
    }
    const country = (req.headers.get("cf-ipcountry") || req.headers.get("x-vercel-ip-country") || "").toUpperCase().slice(0, 2) || null;

    const row = {
      vid, sid,
      market: path === "/ro" || path.startsWith("/ro/") ? "ro" : "bg",
      path,
      product_slug: product?.[1] ?? null,
      referrer_host: refHost,
      utm_source: str(b.us, 100), utm_medium: str(b.um, 100), utm_campaign: str(b.uc, 150), utm_content: str(b.ut, 150),
      fbclid: b.fb === true,
      country: country && /^[A-Z]{2}$/.test(country) ? country : null,
      device: device(ua),
    };

    const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").replace(/\s/g, "");
    if (!url || !key) return none();
    await fetch(`${url}/rest/v1/page_views`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(row),
      signal: AbortSignal.timeout(4000),
    });
  } catch { /* a lost page view never matters */ }
  return none();
}
