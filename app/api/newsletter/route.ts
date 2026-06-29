import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars (0/O, 1/I)
  let code = "LR-";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json() as { email?: string };
    const clean = (email ?? "").trim().toLowerCase();

    if (!clean || !clean.includes("@")) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    // Check for existing subscriber
    const { data: existing } = await supabase
      .from("newsletter_subscribers")
      .select("promo_code")
      .eq("email", clean)
      .single();

    const code = existing?.promo_code || generateCode();

    if (!existing) {
      const { error: insertErr } = await supabase
        .from("newsletter_subscribers")
        .insert({ email: clean, promo_code: code, code_used: false });
      if (insertErr) throw insertErr;
      console.log("[Newsletter] New subscriber:", clean, "code:", code);
    } else if (!existing.promo_code) {
      const { error: updateErr } = await supabase
        .from("newsletter_subscribers")
        .update({ promo_code: code, code_used: false })
        .eq("email", clean);
      if (updateErr) throw updateErr;
      console.log("[Newsletter] Assigned code to existing subscriber:", clean);
    } else {
      console.log("[Newsletter] Returning existing code for:", clean);
    }

    // Return the code directly — shown on screen, not emailed
    return NextResponse.json({ success: true, code });
  } catch (err) {
    console.error("[Newsletter] Error:", err);
    return NextResponse.json({ error: "Failed to subscribe" }, { status: 500 });
  }
}
