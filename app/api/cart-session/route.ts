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
    const { sessionId, email, phone, name, items, subtotal, emailConsent, lang } = body as {
      sessionId:    string;
      email?:       string;
      phone?:       string;
      name?:        string;
      items:        unknown[];
      subtotal:     number;
      emailConsent?: boolean;
      lang?:        string;   // the site the cart belongs to: "ro" for /ro, otherwise Bulgarian
    };
    const cartLang = lang === "ro" ? "ro" : "bg";

    const cleanEmail = email?.trim().toLowerCase() || null;
    const cleanPhone = phone?.trim() || null;

    if (!sessionId || !Array.isArray(items) || (!cleanEmail && !cleanPhone)) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    if (cleanEmail && !cleanEmail.includes("@")) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    // Romanian carts are stored ONLY with the customer's explicit e-mail consent (an unticked box in the /ro checkout): nothing is
    // captured, and no reminder can follow, without it.
    if (cartLang === "ro" && emailConsent !== true) {
      // Consent withdrawn (box unticked after the cart was saved): the saved cart is closed and gets no reminder.
      if (emailConsent === false) await supabaseAdmin().from("cart_sessions").update({ recovery_consent: false, status: "opted_out" }).eq("session_id", sessionId);
      return NextResponse.json({ ok: true, stored: false });
    }

    const supabase = supabaseAdmin();
    const row = {
        session_id:       sessionId,
        ...(cleanEmail ? { email: cleanEmail } : {}),
        ...(cleanPhone ? { phone: cleanPhone } : {}),
        name:             name?.trim() || null,
        items,
        subtotal:         Number(subtotal) || 0,
        // Record the customer's actual marketing-consent choice for the record.
        // The recovery send policy is decided separately (currently: send to all
        // captured carts), but storing the true value keeps the option open.
        recovery_consent: cartLang === "ro" ? true : emailConsent !== false,
        status:           "pending",
        updated_at:       new Date().toISOString(),
    };
    let { error } = await supabase.from("cart_sessions").upsert(
      { ...row, lang: cartLang },
      { onConflict: "session_id", ignoreDuplicates: false }
    );
    // The lang column comes with supabase/lang_columns.sql. Until it has run, a Bulgarian cart is stored as before; a Romanian one
    // is NOT stored at all (it could not be told apart and would get a Bulgarian reminder).
    if (error && /lang/i.test(error.message)) {
      if (cartLang === "ro") return NextResponse.json({ ok: true, stored: false });
      ({ error } = await supabase.from("cart_sessions").upsert(row, { onConflict: "session_id", ignoreDuplicates: false }));
    }

    if (error) {
      console.error("[CartSession] upsert error:", error.message);
      return NextResponse.json({ ok: false }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
