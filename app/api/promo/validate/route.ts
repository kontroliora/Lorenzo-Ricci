import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json() as { code?: string };
    const clean = (code ?? "").trim().toUpperCase();

    if (!clean) {
      return NextResponse.json({ valid: false, error: "Въведете промо код" });
    }

    const { data, error } = await supabase
      .from("newsletter_subscribers")
      .select("promo_code, code_used")
      .eq("promo_code", clean)
      .single();

    if (error || !data) {
      return NextResponse.json({ valid: false, error: "Невалиден промо код" });
    }

    if (data.code_used) {
      return NextResponse.json({ valid: false, error: "Промо кодът вече е използван" });
    }

    return NextResponse.json({ valid: true, discount: 0.10 });
  } catch (err) {
    console.error("[Promo] Validate error:", err);
    return NextResponse.json({ valid: false, error: "Грешка при проверката" });
  }
}
