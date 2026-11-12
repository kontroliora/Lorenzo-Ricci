import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { PARTNER_COOKIE, cookieOptions, signSession } from "@/lib/partner/access";
import { passwordLogin } from "@/lib/partner/password";
import { noStore } from "@/lib/partner/server";
import { cronAuthorized } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Partner sign-in with e-mail + password (lib/partner/password.ts). Same 30-day session cookie as the magic link. The body is
// never logged. 401 = wrong (no reason given), 429 = locked for 15 minutes after 5 wrong attempts.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object" || Object.keys(body).some((k) => k !== "email" && k !== "password")) {
    return NextResponse.json({ error: "Грешен имейл или парола" }, { status: 400, headers: noStore });
  }
  // The self-test (server -> its own site, carrying the cron secret) is counted under its own key, which it clears after the run;
  // otherwise its lockout checks would lock the server's shared egress IP for 15 minutes and break the next run.
  const selftest = cronAuthorized(req.headers.get("x-lr-selftest"));
  const ip = selftest ? "selftest" : (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "";
  try {
    const r = await passwordLogin(body.email, body.password, ip);
    if (!r.ok) {
      return r.locked
        ? NextResponse.json({ error: "Твърде много грешни опити. Опитайте отново след 15 минути." }, { status: 429, headers: { ...noStore, "Retry-After": String(r.retryAfter ?? 900) } })
        : NextResponse.json({ error: "Грешен имейл или парола" }, { status: 401, headers: noStore });
    }
    await supabaseAdmin().from("partners").update({ last_login_at: new Date().toISOString() }).eq("email", r.partner.email);
    const res = NextResponse.json({ ok: true }, { headers: noStore });
    res.cookies.set(PARTNER_COOKIE, signSession(r.partner.email), cookieOptions);
    return res;
  } catch (e) {
    console.error("[partner] password sign-in error:", e instanceof Error ? e.message : "error");
    return NextResponse.json({ error: "Грешка. Опитайте пак." }, { status: 500, headers: noStore });
  }
}
