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
  // Prioritise confirmed returns (any age), then a few recent shipped/completed
  // for contrast.
  const [{ data: ret }, { data: recent }] = await Promise.all([
    sb.from("orders").select("id, order_ref, status, tracking_number, created_at").eq("status", "returned").not("tracking_number", "is", null).limit(50),
    sb.from("orders").select("id, order_ref, status, tracking_number, created_at").in("status", ["shipped", "completed"]).not("tracking_number", "is", null).order("created_at", { ascending: false }).limit(15),
  ]);
  const orders = ([...(ret ?? []), ...(recent ?? [])]) as { id: number; order_ref: string | null; status: string; tracking_number: string; created_at: string }[];
  const awbs = orders.map((o) => String(o.tracking_number).replace(/\s+/g, "")).filter(Boolean);
  if (!awbs.length) return NextResponse.json({ note: "no AWBs", orders: [] });

  const raw = await getShipmentStatusesRaw(awbs);

  // Map each order (ref/status only — no customer PII) to its AWB.
  return NextResponse.json({
    orders: orders.map((o) => ({ id: o.id, ref: o.order_ref, dbStatus: o.status, awb: String(o.tracking_number).replace(/\s+/g, "") })),
    raw,
  });
}
