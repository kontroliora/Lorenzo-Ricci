import { NextResponse, type NextRequest } from "next/server";
import { ATTR_COOKIE, ATTR_MAX_AGE, attributionFromSearch, encodeAttribution } from "@/lib/attribution";
import { updateSession } from "@/lib/supabase/middleware";
import { decideGeoRedirect, LANG_COOKIE } from "@/lib/geo-redirect";

// Two jobs: (1) the admin panel / admin API session gate (below, unchanged); (2) the first-visit redirect of Romanian
// visitors to the Romanian store (lib/geo-redirect.ts has the rules). The storefront pages themselves stay static: only this
// edge step looks at the visitor.
function geoRedirect(request: NextRequest): NextResponse {
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
  // Matched only for the attribution cookie: the Romanian store and the sale page never had a geo redirect.
  if (pathname === "/ro" || pathname.startsWith("/ro/") || pathname === "/namalenia") return NextResponse.next();

  if (!pathname.startsWith("/lr-panel-v8m3q") && !pathname.startsWith("/api/admin")) return geoRedirect(request);

  // Programmatic endpoint with its own Bearer-token auth — bypass the session gate.
  if (pathname.startsWith("/api/admin/cart-abandonment")) {
    return NextResponse.next();
  }

  // Refresh the Supabase session (also rotates auth cookies) and read the user.
  const { supabaseResponse, user } = await updateSession(request);

  // Login screen: always reachable. If already authenticated, skip straight in.
  if (pathname === "/lr-panel-v8m3q/login") {
    if (user) {
      return redirectWithCookies(new URL("/lr-panel-v8m3q/inventory", request.url), supabaseResponse);
    }
    return supabaseResponse;
  }

  // Everything else under /lr-panel-v8m3q and /api/admin requires an authenticated user.
  if (!user) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return redirectWithCookies(new URL("/lr-panel-v8m3q/login", request.url), supabaseResponse);
  }

  return supabaseResponse;
}

// Redirect while preserving any auth cookies that updateSession refreshed.
function redirectWithCookies(url: URL, source: NextResponse): NextResponse {
  const response = NextResponse.redirect(url);
  source.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
  return response;
}

export const config = {
  matcher: [
    "/lr-panel-v8m3q/:path*",
    "/api/admin/:path*",
    // Bulgarian storefront pages that have a Romanian twin (lib/ro/route-map.ts); nothing else is touched.
    "/",
    "/watches",
    "/jewellery",
    "/leather-goods",
    "/bundles",
    "/story",
    "/faq",
    "/watch-manual",
    "/warranty/:path*",
    "/policies/:path*",
    "/products/:path*",
    // attribution cookie only (no geo redirect): the Romanian store and the sale page
    "/ro",
    "/ro/:path*",
    "/namalenia",
  ],
};
