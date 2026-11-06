import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { syncMeta } from "@/lib/meta-ads";
import { cronAuthorized } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Meta ads -> meta_ads + meta_ad_insights (lib/meta-ads.ts). Called by:
//   - GitHub Actions every hour (.github/workflows/health.yml): ?days=2 = yesterday + today;
//   - Vercel Cron once a day (vercel.json): ?days=3, so the final numbers of the last days are kept.
// ?days=30 once fills the history (?days>=3 also refreshes every live ad, not only the active ones). Answers totals only.
export async function GET(req: NextRequest) {
  if (!cronAuthorized(req.headers.get("authorization"))) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const days = Number(req.nextUrl.searchParams.get("days") ?? 2);
  try {
    const r = await syncMeta(supabaseAdmin(), Number.isFinite(days) ? days : 2);
    console.log("[meta-ads]", JSON.stringify(r));
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    console.error("[meta-ads] failed:", e);
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
