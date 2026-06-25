import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json() as { email?: string };
    const clean = (email ?? "").trim().toLowerCase();

    if (!clean || !clean.includes("@")) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    const { error } = await supabase
      .from("newsletter_subscribers")
      .upsert({ email: clean }, { onConflict: "email" });

    if (error) throw error;

    console.log("[Newsletter] Subscriber saved:", clean);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Newsletter] Failed to save subscriber:", err);
    return NextResponse.json({ error: "Failed to subscribe" }, { status: 500 });
  }
}
