import { LANG_COOKIE, bgToRoPath } from "@/lib/ro/route-map";

// First visit from Romania -> the Romanian store. Pure decision (no Next imports) so it can be tested without a server;
// middleware.ts feeds it the request and applies the answer.
//
//   - only a full-page GET of a Bulgarian storefront page is ever redirected (never /ro, /api, assets, the panel, payment returns);
//   - a remembered choice wins: cookie lr_lang = "ro" -> Romanian, "bg" -> stay (the BG / RO switch writes that cookie);
//   - no choice yet: the country decides (Cloudflare CF-IPCountry first, because Cloudflare sits in front of Vercel and
//     Vercel's own country header would then name Cloudflare's edge; then Vercel's x-vercel-ip-country); only when the
//     country is unknown, Accept-Language "ro" decides;
//   - bots and link previews (Google, Bing, Meta ad review, WhatsApp ...) are NEVER redirected: crawlers must see the Bulgarian
//     page and the Romanian pages by their own URLs;
//   - x_geo cookie = a two-letter country to test the redirect without a VPN.

const BOT = /bot|crawl|spider|slurp|bingpreview|google|yandex|baidu|duckduck|facebookexternalhit|facebot|meta-external|twitter|linkedin|whatsapp|telegram|slack|embedly|preview|pinterest|applebot|semrush|ahrefs|mj12|dotbot|petalbot|lighthouse|pagespeed|gtmetrix|headless|monitor|uptime|curl|wget|python-requests|node-fetch|axios|go-http/i;

export type GeoInput = {
  method: string;
  pathname: string;
  search: string;
  cookies: { lang?: string; xGeo?: string };
  headers: {
    cfCountry?: string | null;
    vercelCountry?: string | null;
    acceptLanguage?: string | null;
    userAgent?: string | null;
    accept?: string | null;
    secFetchDest?: string | null;
    rsc?: boolean;
    prefetch?: boolean;
  };
};

export type GeoDecision = { redirectTo: string; setCookie: boolean } | null;

const unknown = (c?: string | null) => !c || /^(xx|t1|zz)$/i.test(c.trim());

export function countryOf(h: GeoInput["headers"], xGeo?: string): string | null {
  if (xGeo && /^[A-Za-z]{2}$/.test(xGeo)) return xGeo.toUpperCase();
  if (!unknown(h.cfCountry)) return h.cfCountry!.trim().toUpperCase();
  if (!unknown(h.vercelCountry)) return h.vercelCountry!.trim().toUpperCase();
  return null;
}

const prefersRomanian = (al?: string | null): boolean => {
  const first = (al ?? "").split(",")[0]?.trim().toLowerCase() ?? "";
  return first === "ro" || first.startsWith("ro-");
};

export function decideGeoRedirect(i: GeoInput): GeoDecision {
  if (i.method !== "GET") return null;
  if (i.headers.rsc || i.headers.prefetch) return null;                      // in-app navigation / prefetch, not a landing
  const dest = i.headers.secFetchDest;
  if (dest && dest !== "document") return null;
  if (!dest && !(i.headers.accept ?? "").includes("text/html")) return null;
  const ua = i.headers.userAgent ?? "";
  if (!ua || BOT.test(ua)) return null;                                      // crawlers, previews, scripts: never redirected
  if (i.pathname === "/ro" || i.pathname.startsWith("/ro/")) return null;

  const target = bgToRoPath(i.pathname) + i.search;
  if (i.cookies.lang === "ro") return { redirectTo: target, setCookie: false }; // remembered choice
  if (i.cookies.lang === "bg") return null;                                  // chose Bulgarian by hand: never again

  const country = countryOf(i.headers, i.cookies.xGeo);
  const romanian = country ? country === "RO" : prefersRomanian(i.headers.acceptLanguage);
  return romanian ? { redirectTo: target, setCookie: true } : null;
}

export { LANG_COOKIE };
