import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, email, phone, name, items, subtotal } = body as {
      sessionId: string;
      email?:    string;
      phone?:    string;
      name?:     string;
      items:     unknown[];
      subtotal:  number;
    };

    const cleanEmail = email?.trim().toLowerCase() || null;
    const cleanPhone = phone?.trim() || null;

    if (!sessionId || !Array.isArray(items) || (!cleanEmail && !cleanPhone)) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    if (cleanEmail && !cleanEmail.includes("@")) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const { error } = await supabase.from("cart_sessions").upsert(
      {
        session_id:       sessionId,
        ...(cleanEmail ? { email: cleanEmail } : {}),
        ...(cleanPhone ? { phone: cleanPhone } : {}),
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
