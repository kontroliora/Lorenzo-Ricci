import { NextRequest, NextResponse } from "next/server";
import { checkPromoCode } from "@/lib/promo";

// Same check /api/order runs before accepting a promo discount (lib/promo.ts).
export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json() as { code?: string };
    return NextResponse.json(await checkPromoCode(code));
  } catch (err) {
    console.error("[Promo] Validate error:", err);
    return NextResponse.json({ valid: false, error: "Грешка при проверката" });
  }
}
