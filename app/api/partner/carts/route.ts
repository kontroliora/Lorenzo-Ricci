import { NextRequest, NextResponse } from "next/server";
import { noStore, requirePartner } from "@/lib/partner/server";
import { partnerCarts } from "@/lib/partner/carts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** His abandoned carts (women's-collection carts only, no customer e-mail), newest first. */
export async function GET(req: NextRequest) {
  const p = await requirePartner(req);
  if (p instanceof NextResponse) return p;
  try {
    return NextResponse.json({ carts: await partnerCarts() }, { headers: noStore });
  } catch (e) {
    console.error("[partner] carts failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Грешка при зареждане" }, { status: 500, headers: noStore });
  }
}
