// Vercel Cron — periodically reconciles shipped orders against Econt:
//   Econt "Доставена" → order 'completed' (source 'econt' → triggers the bonus)
//   Econt "Върната"   → order 'returned'
// Needs SUPABASE_SERVICE_ROLE_KEY (server-only) to bypass RLS as no user session
// exists. Vercel injects Authorization: Bearer ${CRON_SECRET}.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { reconcileShippedOrders, matchTrackingNumbers } from "@/lib/econt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
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
    // 2. reconcile shipped → delivered/returned
    const status = await reconcileShippedOrders(sb);
    console.log("[EcontCron]", JSON.stringify({ autoFilled: match.autoFilled.length, pending: match.pending.length, completed: status.completed, returned: status.returned }));
    return NextResponse.json({ ok: true, autoFilled: match.autoFilled.length, pending: match.pending.length, ...status });
  } catch (e) {
    console.error("[EcontCron] error:", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
