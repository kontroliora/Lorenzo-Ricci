import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getRawStatuses } from "@/lib/econt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// TEMPORARY read-only investigation of the duplicate-AWB pair (LR-CZW81J /
// LR-CZLAUP share tracking 1080115929303). Dumps both orders + the parcel's real
// Econt data (esp. COD amount) so the owner can decide with Koko. Zero writes.
const TOKEN = "dup7k2m9x";
const AWB = "1080115929303";
const toISO = (n: unknown) => { const v = Number(n) || 0; return v ? new Date(v < 1e12 ? v * 1000 : v).toISOString() : null; };

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("k") !== TOKEN) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = supabaseAdmin();

  const od = await sb
    .from("orders")
    .select("order_ref, name, phone, city, address, items, total, status, is_manual, created_at, completed_at, tracking_number")
    .in("order_ref", ["LR-CZW81J", "LR-CZLAUP"]);
  if (od.error) return NextResponse.json({ error: od.error.message }, { status: 500 });

  const raws = await getRawStatuses([AWB]);
  const raw = (raws.get(AWB) ?? null) as Record<string, unknown> | null;

  // Surface every top-level key + the COD/delivery-relevant ones explicitly.
  const econt = raw
    ? {
        allKeys: Object.keys(raw),
        shortDeliveryStatus: raw.shortDeliveryStatus ?? null,
        cdAmount: raw.cdAmount ?? raw.cd ?? null,
        cdPaidTime: toISO(raw.cdPaidTime),
        cdCollectedTime: toISO(raw.cdCollectedTime),
        deliveryTime: toISO(raw.deliveryTime),
        receiverName: raw.receiverName ?? null,
        receiverPhone: raw.receiverPhone ?? null,
        packCount: raw.packCount ?? null,
        weight: raw.weight ?? null,
      }
    : { note: "no Econt response for this AWB" };

  return NextResponse.json({ awb: AWB, orders: od.data, econtParcel: econt });
}
