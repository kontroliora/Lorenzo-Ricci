import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// TEMPORARY — prove the abandoned-cart consent filter: old query (no filter) vs
// new query (skips recovery_consent = false). Counts only. Token-guarded; remove.
const TOKEN = "cc7m2k4x";

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("k") !== TOKEN) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = supabaseAdmin();

  const idleCutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const ageCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Same window as the cron, WITHOUT the consent filter (old behaviour).
  const base = () =>
    sb.from("cart_sessions").select("session_id", { count: "exact", head: true })
      .eq("status", "pending").is("recovery_sent_at", null).not("email", "is", null)
      .lt("updated_at", idleCutoff).gt("updated_at", ageCutoff);

  const oldQ = await base();
  const newQ = await base().not("recovery_consent", "is", false); // new behaviour

  // How many opt-outs exist overall (pending, email known).
  const optOuts = await sb.from("cart_sessions").select("session_id", { count: "exact", head: true })
    .eq("status", "pending").not("email", "is", null).eq("recovery_consent", false);

  // Mechanical proof the filter drops recovery_consent=false: any-status counts
  // with email known, without vs with the filter. Delta = opt-outs excluded.
  const allNoFilter = await sb.from("cart_sessions").select("session_id", { count: "exact", head: true }).not("email", "is", null);
  const allFiltered = await sb.from("cart_sessions").select("session_id", { count: "exact", head: true }).not("email", "is", null).not("recovery_consent", "is", false);

  const oldCount = oldQ.count ?? 0;
  const newCount = newQ.count ?? 0;
  return NextResponse.json({
    windowOldBehaviour_wouldEmail: oldCount,
    windowNewBehaviour_wouldEmail: newCount,
    optOutsNowProtectedInWindow: oldCount - newCount,
    totalPendingOptOuts_allTime: optOuts.count ?? 0,
    mechanicalProof: {
      allWithEmail_noFilter: allNoFilter.count ?? 0,
      allWithEmail_withFilter: allFiltered.count ?? 0,
      excludedByFilter: (allNoFilter.count ?? 0) - (allFiltered.count ?? 0),
    },
    errors: { old: oldQ.error?.message ?? null, new: newQ.error?.message ?? null, optOuts: optOuts.error?.message ?? null },
  });
}
