import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getShipmentStatusesRaw } from "@/lib/econt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// TEMPORARY Stage-1 research — raw Econt getShipmentStatuses for RETURNED (and
// recently shipped) parcels, to find fields that separate "uncollected / expired
// storage" from "refused after inspection". Token-guarded; remove after use.
const TOKEN = "r7k2m9x4qp";

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("k") !== TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("orders")
    .select("id, order_ref, status, tracking_number, created_at")
    .in("status", ["returned", "shipped", "completed"])
    .not("tracking_number", "is", null)
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const orders = (data ?? []) as { id: number; order_ref: string | null; status: string; tracking_number: string; created_at: string }[];
  const awbs = orders.map((o) => String(o.tracking_number).replace(/\s+/g, "")).filter(Boolean);
  if (!awbs.length) return NextResponse.json({ note: "no AWBs", orders: [] });

  const raw = await getShipmentStatusesRaw(awbs);

  // Map each order (ref/status only — no customer PII) to its AWB.
  return NextResponse.json({
    orders: orders.map((o) => ({ id: o.id, ref: o.order_ref, dbStatus: o.status, awb: String(o.tracking_number).replace(/\s+/g, "") })),
    raw,
  });
}
