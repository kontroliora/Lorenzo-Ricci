import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

// Server-side write to an RLS-protected table → use the SERVICE-ROLE key, which
// bypasses RLS. The anon key is (correctly) denied writes to cart_sessions, so
// the shared anon client hit "new row violates row-level security policy". The
// service key stays server-only; the route validates input before writing.

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, email, phone, name, items, subtotal, emailConsent } = body as {
      sessionId:    string;
      email?:       string;
      phone?:       string;
      name?:        string;
      items:        unknown[];
      subtotal:     number;
      emailConsent?: boolean;
    };

    const cleanEmail = email?.trim().toLowerCase() || null;
    const cleanPhone = phone?.trim() || null;

    if (!sessionId || !Array.isArray(items) || (!cleanEmail && !cleanPhone)) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    if (cleanEmail && !cleanEmail.includes("@")) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const supabase = supabaseAdmin();
    const { error } = await supabase.from("cart_sessions").upsert(
      {
        session_id:       sessionId,
        ...(cleanEmail ? { email: cleanEmail } : {}),
        ...(cleanPhone ? { phone: cleanPhone } : {}),
        name:             name?.trim() || null,
        items,
        subtotal:         Number(subtotal) || 0,
        // Record the customer's actual marketing-consent choice for the record.
        // The recovery send policy is decided separately (currently: send to all
        // captured carts), but storing the true value keeps the option open.
        recovery_consent: emailConsent !== false,
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
