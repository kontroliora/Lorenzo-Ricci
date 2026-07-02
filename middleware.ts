import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Programmatic endpoint with its own Bearer-token auth — bypass the session gate.
  if (pathname.startsWith("/api/admin/cart-abandonment")) {
    return NextResponse.next();
  }

  // Refresh the Supabase session (also rotates auth cookies) and read the user.
  const { supabaseResponse, user } = await updateSession(request);

  // Login screen: always reachable. If already authenticated, skip straight in.
  if (pathname === "/admin/login") {
    if (user) {
      return redirectWithCookies(new URL("/admin/inventory", request.url), supabaseResponse);
    }
    return supabaseResponse;
  }

  // Everything else under /admin and /api/admin requires an authenticated user.
  if (!user) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return redirectWithCookies(new URL("/admin/login", request.url), supabaseResponse);
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
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
