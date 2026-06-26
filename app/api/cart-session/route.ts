import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, email, name, items, subtotal } = body as {
      sessionId: string;
      email: string;
      name?: string;
      items: unknown[];
      subtotal: number;
    };

    if (!sessionId || !email || !email.includes("@") || !Array.isArray(items)) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const { error } = await supabase.from("cart_sessions").upsert(
      {
        session_id:       sessionId,
        email:            email.trim().toLowerCase(),
        name:             name?.trim() || null,
        items,
        subtotal:         Number(subtotal) || 0,
        recovery_consent: true,
        status:           "pending",
        updated_at:       new Date().toISOString(),
      },
      { onConflict: "session_id", ignoreDuplicates: false }
    );

    if (error) {
      console.error("[CartSession] upsert error:", error.message);
      return NextResponse.json({ ok: false }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
