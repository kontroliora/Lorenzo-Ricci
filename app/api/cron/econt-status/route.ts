// Vercel Cron — periodically reconciles shipped orders against Econt:
//   Econt "Доставена" → order 'completed' (source 'econt' → Econt-confirmed)
//   Econt "Върната"   → order 'returned'
// Needs SUPABASE_SERVICE_ROLE_KEY (server-only) to bypass RLS as no user session
// exists. Vercel injects Authorization: Bearer ${CRON_SECRET}.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { reconcileShippedOrders, matchTrackingNumbers, classifyExistingReturns } from "@/lib/econt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Fail CLOSED: without CRON_SECRET set (and matching) the endpoint refuses —
  // it never runs open to the public. Vercel injects the Bearer once the secret
  // is set on the project.
  const cronSecret = (process.env.CRON_SECRET ?? "").trim();
  const auth = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!cronSecret || auth !== cronSecret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").replace(/\s/g, "");
  if (!url || !key) {
    return NextResponse.json(
      { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY not configured — the cron can't read/update orders (RLS)." },
      { status: 500 },
    );
  }

  try {
    const sb = createClient(url, key, { auth: { persistSession: false } });
    // 1. auto-fill tracking numbers (sure matches only — never confirms uncertain)
    const match = await matchTrackingNumbers(sb);
    // 2. reconcile shipped → delivered/returned (returns get auto-classified)
    const status = await reconcileShippedOrders(sb);
    // 3. backfill return_kind for any already-returned orders not yet classified
    const backfilledReturns = await classifyExistingReturns(sb);
    console.log("[EcontCron]", JSON.stringify({ autoFilled: match.autoFilled.length, pending: match.pending.length, completed: status.completed, returned: status.returned, restocked: status.restocked, backfilledReturns }));
    return NextResponse.json({ ok: true, autoFilled: match.autoFilled.length, pending: match.pending.length, ...status, backfilledReturns });
  } catch (e) {
    console.error("[EcontCron] error:", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
