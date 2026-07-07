import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json() as { code?: string };
    const clean = (code ?? "").trim().toUpperCase();

    if (!clean) {
      return NextResponse.json({ valid: false, error: "Въведете промо код" });
    }

    const { data } = await supabase
      .from("newsletter_subscribers")
      .select("promo_code, code_used, subscribed_at")
      .eq("promo_code", clean)
      .maybeSingle();

    if (!data) {
      return NextResponse.json({ valid: false, error: "Невалиден промо код" });
    }

    if (data.code_used) {
      return NextResponse.json({ valid: false, error: "Промо кодът вече е използван" });
    }

    // 14-day validity applies ONLY to codes issued from the rule start onward.
    // Codes issued before it were open-ended and are grandfathered (never expire).
    const RULE_START = Date.parse("2026-07-07T15:40:00Z");
    const created = new Date(data.subscribed_at).getTime();
    if (created >= RULE_START && Date.now() > created + 14 * 86_400_000) {
      return NextResponse.json({ valid: false, error: "Кодът е изтекъл" });
    }

    return NextResponse.json({ valid: true, discount: 0.10 });
  } catch (err) {
    console.error("[Promo] Validate error:", err);
    return NextResponse.json({ valid: false, error: "Грешка при проверката" });
  }
}
