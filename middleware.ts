import { NextResponse, type NextRequest } from "next/server";
import { ATTR_COOKIE, ATTR_MAX_AGE, attributionFromSearch, encodeAttribution } from "@/lib/attribution";
import { updateSession } from "@/lib/supabase/middleware";
import { decideGeoRedirect, LANG_COOKIE } from "@/lib/geo-redirect";
import { RO_ALWAYS_OPEN, RO_STORE_ENABLED } from "@/lib/ro-store";
import { roToBgPath } from "@/lib/ro/route-map";
import { offShelfTarget } from "@/lib/storefront-redirects";

// Two jobs: (1) the admin panel / admin API session gate (below, unchanged); (2) the first-visit redirect of Romanian
// visitors to the Romanian store (lib/geo-redirect.ts has the rules). The storefront pages themselves stay static: only this
// edge step looks at the visitor.
function geoRedirect(request: NextRequest): NextResponse {
  if (!RO_STORE_ENABLED) return NextResponse.next(); // Romanian store off (lib/ro-store.ts): nobody is sent to /ro
  const { pathname, search } = request.nextUrl;
  const h = request.headers;
  const decision = decideGeoRedirect({
    method: request.method,
    pathname,
    search,
    cookies: { lang: request.cookies.get(LANG_COOKIE)?.value, xGeo: request.cookies.get("x_geo")?.value },
    headers: {
      cfCountry: h.get("cf-ipcountry"),
      vercelCountry: h.get("x-vercel-ip-country"),
      acceptLanguage: h.get("accept-language"),
      userAgent: h.get("user-agent"),
      accept: h.get("accept"),
      secFetchDest: h.get("sec-fetch-dest"),
      rsc: h.has("rsc") || h.has("next-router-state-tree"),
      prefetch: h.has("next-router-prefetch") || h.get("purpose") === "prefetch" || h.get("sec-purpose")?.includes("prefetch") === true,
    },
  });
  if (!decision) return NextResponse.next();
  const res = NextResponse.redirect(new URL(decision.redirectTo, request.url), 307);
  if (decision.setCookie) res.cookies.set(LANG_COOKIE, "ro", { path: "/", maxAge: 31_536_000, sameSite: "lax" });
  return res;
}

export async function middleware(request: NextRequest) {
  const res = await route(request);
  // Ad attribution of the landing (utm_* / fbclid) -> first-party cookie, last touch, 30 days (lib/attribution.ts). Not on the panel.
  const { pathname, searchParams } = request.nextUrl;
  if (!pathname.startsWith("/lr-panel-v8m3q") && !pathname.startsWith("/api/")) {
    const attr = attributionFromSearch(searchParams);
    if (attr) res.cookies.set(ATTR_COOKIE, encodeAttribution(attr), { path: "/", maxAge: ATTR_MAX_AGE, sameSite: "lax" });
  }
  return res;
}

async function route(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  // A collection switched off (lib/storefront.ts): its category pages and product pages answer 301 -> the women's collection
  // (lib/storefront-redirects.ts), never a 404. The query string stays (utm_* / fbclid: the ad click is still attributed on the
  // landing); the attribution cookie is set on this response too (middleware() above). Short browser cache so that switching a
  // collection back on is not held up by redirects people's browsers remembered.
  const off = offShelfTarget(pathname, RO_STORE_ENABLED);
  if (off) {
    const to = new URL(off.path, request.url);
    to.search = request.nextUrl.search;
    to.hash = off.hash;
    const res = NextResponse.redirect(to, 301);
    res.headers.set("Cache-Control", "public, max-age=3600");
    return res;
  }
  // Romanian store off (lib/ro-store.ts): every /ro page -> its Bulgarian twin (302, query string kept: utm_* / fbclid).
  if ((pathname === "/ro" || pathname.startsWith("/ro/")) && !RO_STORE_ENABLED && !RO_ALWAYS_OPEN(pathname)) {
    const to = new URL(roToBgPath(pathname), request.url);
    to.search = request.nextUrl.search;
    return NextResponse.redirect(to, 302);
  }
  // Matched only for the attribution cookie: the Romanian store and the sale page never had a geo redirect.
  if (pathname === "/ro" || pathname.startsWith("/ro/") || pathname === "/namalenia") return NextResponse.next();

  if (!pathname.startsWith("/lr-panel-v8m3q") && !pathname.startsWith("/api/admin") && !pathname.startsWith("/api/ingest/")) return geoRedirect(request);

  // Programmatic endpoints with their own Bearer-token auth — bypass the session gate.
  if (pathname.startsWith("/api/admin/cart-abandonment") || pathname.startsWith("/api/ingest/")) {
    return NextResponse.next();
  }

  // Refresh the Supabase session (also rotates auth cookies) and read the user.
  const { supabaseResponse, user, isAdmin, adminRole } = await updateSession(request);

  // Login screen: always reachable. If already authenticated, skip straight in.
  if (pathname === "/lr-panel-v8m3q/login") {
    if (user && isAdmin) {
      // Fulfillment role lands on /orders (no access to /inventory).
      const target = adminRole === "fulfillment" ? "/lr-panel-v8m3q/orders" : "/lr-panel-v8m3q/inventory";
      return redirectWithCookies(new URL(target, request.url), supabaseResponse);
    }
    return supabaseResponse;
  }

  // Everything else under /lr-panel-v8m3q and /api/admin requires an authenticated user.
  if (!user) {
    // The partner (/partner, own cookie, no Supabase account) is never let in here: a plain 403.
    if (request.cookies.has("lr_partner")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return redirectWithCookies(new URL("/lr-panel-v8m3q/login", request.url), supabaseResponse);
  }

  // Signed in but not in admin_users → no panel access.
  // Page requests: redirect to login (don't expose a JSON 403 to the browser).
  // API requests: 403 JSON (the caller must handle it).
  if (!isAdmin) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return redirectWithCookies(new URL("/lr-panel-v8m3q/login", request.url), supabaseResponse);
  }

  // Fulfillment role: the orders board only (not its sub-pages such as confirm-emails); no admin API at all.
  if (adminRole === "fulfillment") {
    const ordersBase = "/lr-panel-v8m3q/orders";
    if (pathname.startsWith("/api/admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (pathname !== ordersBase && pathname !== `${ordersBase}/`) {
      return redirectWithCookies(new URL(ordersBase, request.url), supabaseResponse);
    }
  }

  return supabaseResponse;
}

// Redirect while preserving any auth cookies that updateSession refreshed.
function redirectWithCookies(url: URL, source: NextResponse): NextResponse {
  const response = NextResponse.redirect(url);
  source.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
  return response;
}

// Storefront entries skip Next's in-app navigations and prefetches (RSC headers): the geo redirect ignores them anyway
// (lib/geo-redirect.ts) and the attribution cookie is set on the landing, a full page load. Browser prerenders still match
// (an ad click Chrome prerendered keeps its utm cookie). The admin gate keeps matching every request. Literal entries:
// Next reads this config statically.
export const config = {
  matcher: [
    "/lr-panel-v8m3q/:path*",
    "/api/admin/:path*",
    "/api/ingest/:path*",
    // Bulgarian storefront pages that have a Romanian twin (lib/ro/route-map.ts); nothing else is touched.
    { source: "/", missing: [{ type: "header", key: "rsc" }, { type: "header", key: "next-router-prefetch" }] },
    { source: "/watches", missing: [{ type: "header", key: "rsc" }, { type: "header", key: "next-router-prefetch" }] },
    { source: "/jewellery", missing: [{ type: "header", key: "rsc" }, { type: "header", key: "next-router-prefetch" }] },
    { source: "/leather-goods", missing: [{ type: "header", key: "rsc" }, { type: "header", key: "next-router-prefetch" }] },
    { source: "/bundles", missing: [{ type: "header", key: "rsc" }, { type: "header", key: "next-router-prefetch" }] },
    { source: "/story", missing: [{ type: "header", key: "rsc" }, { type: "header", key: "next-router-prefetch" }] },
    { source: "/faq", missing: [{ type: "header", key: "rsc" }, { type: "header", key: "next-router-prefetch" }] },
    { source: "/watch-manual", missing: [{ type: "header", key: "rsc" }, { type: "header", key: "next-router-prefetch" }] },
    { source: "/warranty/:path*", missing: [{ type: "header", key: "rsc" }, { type: "header", key: "next-router-prefetch" }] },
    { source: "/policies/:path*", missing: [{ type: "header", key: "rsc" }, { type: "header", key: "next-router-prefetch" }] },
    { source: "/products/:path*", missing: [{ type: "header", key: "rsc" }, { type: "header", key: "next-router-prefetch" }] },
    // attribution cookie only (no geo redirect): the Romanian store and the sale page
    { source: "/ro", missing: [{ type: "header", key: "rsc" }, { type: "header", key: "next-router-prefetch" }] },
    { source: "/ro/:path*", missing: [{ type: "header", key: "rsc" }, { type: "header", key: "next-router-prefetch" }] },
    { source: "/namalenia", missing: [{ type: "header", key: "rsc" }, { type: "header", key: "next-router-prefetch" }] },
  ],
};
