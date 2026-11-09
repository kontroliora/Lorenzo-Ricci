import { NextRequest, NextResponse } from "next/server";
import { PARTNER_COOKIE, consumeLoginToken, cookieOptions, getPartnerRow, signSession } from "@/lib/partner/access";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The magic link: single-use token -> 30-day partner cookie -> /partner.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("t") ?? "";
  const email = await consumeLoginToken(token).catch(() => null);
  const p = email ? await getPartnerRow(email) : null;
  if (!p?.enabled) return NextResponse.redirect(new URL("/partner/login?e=link", req.url), 303);
  await supabaseAdmin().from("partners").update({ last_login_at: new Date().toISOString() }).eq("email", p.email);
  const res = NextResponse.redirect(new URL("/partner", req.url), 303);
  res.cookies.set(PARTNER_COOKIE, signSession(p.email), cookieOptions);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
