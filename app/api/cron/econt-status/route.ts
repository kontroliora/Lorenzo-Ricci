// Vercel Cron — periodically reconciles shipped orders against Econt:
//   Econt "Доставена" → order 'completed' (source 'econt' → triggers the bonus)
//   Econt "Върната"   → order 'returned'
// Needs SUPABASE_SERVICE_ROLE_KEY (server-only) to bypass RLS as no user session
// exists. Vercel injects Authorization: Bearer ${CRON_SECRET}.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { reconcileShippedOrders } from "@/lib/econt";

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
    const result = await reconcileShippedOrders(sb);
    console.log("[EcontCron]", JSON.stringify({ checked: result.checked, completed: result.completed, returned: result.returned }));
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("[EcontCron] error:", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
