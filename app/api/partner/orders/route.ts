import { NextRequest, NextResponse } from "next/server";
import { listPartnerOrders, noStore, requirePartner } from "@/lib/partner/server";
import type { PartnerFilter } from "@/lib/partner/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FILTERS: PartnerFilter[] = ["new", "called", "confirmed", "all"];

/** His orders (women's jewellery only, see lib/partner/orders.ts partnerView), newest first. */
export async function GET(req: NextRequest) {
  const p = await requirePartner(req);
  if (p instanceof NextResponse) return p;
  const f = req.nextUrl.searchParams.get("filter") as PartnerFilter;
  try {
    const r = await listPartnerOrders(FILTERS.includes(f) ? f : "new");
    return NextResponse.json(r, { headers: noStore });
  } catch (e) {
    console.error("[partner] list failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Грешка при зареждане" }, { status: 500, headers: noStore });
  }
}
