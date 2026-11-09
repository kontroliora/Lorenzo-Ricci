import { NextRequest, NextResponse } from "next/server";
import { noStore, partnerPieces, requirePartner } from "@/lib/partner/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Read-only: the women's pieces with photo, price and current stock. */
export async function GET(req: NextRequest) {
  const p = await requirePartner(req);
  if (p instanceof NextResponse) return p;
  return NextResponse.json({ pieces: await partnerPieces() }, { headers: noStore });
}
