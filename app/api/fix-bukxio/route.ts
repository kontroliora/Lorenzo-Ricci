import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// TEMPORARY, single-order authorised fix: LR-BUKXIO is stuck on the legacy
// 'returned' status (from the pre-migration fallback window) so neither the
// button nor the cron can restock it. Relabel to 'returning' — returning_at stays
// NULL, so the cron leaves it and Koko clears it with "Взех пратката", exactly
// like the other legacy returns. Hardcoded ref + status guard. Remove after use.
const TOKEN = "bux7k2m9x";
const REF = "LR-BUKXIO";

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("k") !== TOKEN) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = supabaseAdmin();
  const sel = "order_ref, status, tracking_number, returning_at, restocked_at";

  const before = await sb.from("orders").select(sel).eq("order_ref", REF).single();
  if (before.error || !before.data) return NextResponse.json({ error: before.error?.message ?? "not found" }, { status: 404 });

  if (req.nextUrl.searchParams.get("mode") !== "apply") {
    return NextResponse.json({ mode: "inspect", before: before.data });
  }

  // Guard: only act while it is still the legacy 'returned'.
  const { data, error } = await sb
    .from("orders")
    .update({ status: "returning" })
    .eq("order_ref", REF).eq("status", "returned")
    .select(sel);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data?.length) return NextResponse.json({ ok: false, note: "not in 'returned' — nothing changed", before: before.data });

  const after = await sb.from("orders").select(sel).eq("order_ref", REF).single();
  return NextResponse.json({ ok: true, before: before.data, after: after.data });
}
