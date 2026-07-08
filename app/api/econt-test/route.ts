// ⚠️ TEMPORARY DIAGNOSTIC — read live Econt status for given AWBs (no DB access,
// ECONT creds only). Token-gated. Delete after diagnosing.
//   /api/econt-test?key=...&awb=1080114507847,1080114504259
import { NextRequest, NextResponse } from "next/server";
import { getShipmentStatuses, classify } from "@/lib/econt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOKEN = "e7probe_Kx9zQ2wL8vRt5nJ";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("key") !== TOKEN) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const awbs = (searchParams.get("awb") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const statuses = await getShipmentStatuses(awbs);
  return NextResponse.json({
    marker: "econt-diag-v1",
    results: statuses.map((s) => ({
      awb: s.shipmentNumber,
      shortDeliveryStatus: s.shortDeliveryStatus,
      shortDeliveryStatusEn: s.shortDeliveryStatusEn,
      deliveryTime: s.deliveryTime,
      verdict: classify(s),
      error: s.error,
    })),
  });
}
