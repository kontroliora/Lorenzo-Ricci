// mail-policy: internal
import { NextRequest, NextResponse } from "next/server";
import { getPartnerRow, issueLoginToken, loginRateOk, normEmail } from "@/lib/partner/access";
import { sendPartnerLoginEmail } from "@/lib/partner/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The partner asks for a sign-in link. Same answer whether or not the address is a partner (no way to probe addresses);
// a link goes out only to an ENABLED partner, at most 5 per 15 minutes.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { email?: unknown };
  const email = normEmail(body.email);
  const ok = NextResponse.json({ ok: true });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) return ok;
  try {
    if (!(await loginRateOk(email))) return ok;
    const p = await getPartnerRow(email);
    if (!p?.enabled) return ok;
    await sendPartnerLoginEmail(p.email, await issueLoginToken(p.email));
  } catch (e) { console.error("[partner] login link failed:", e instanceof Error ? e.message : e); }
  return ok;
}
