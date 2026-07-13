import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/cart-session/recover?t=<session_id>
// Returns the saved cart for a recovery link. The token IS the session_id — a
// random UUID, unguessable — so no extra auth is needed; whoever has the link
// (the customer, from their own email) may restore their own cart. Converted
// carts are not returned (nothing to recover). Read uses the service key
// because anon can't SELECT cart_sessions under RLS.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("t")?.trim();
  if (!token) {
    return NextResponse.json({ ok: false, error: "missing token" }, { status: 400 });
  }

  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from("cart_sessions")
      .select("session_id, email, name, phone, items, subtotal, status")
      .eq("session_id", token)
      .maybeSingle();

    if (error) {
      console.error("[Recover] query error:", error.message);
      return NextResponse.json({ ok: false }, { status: 500 });
    }
    if (!data || data.status === "converted") {
      return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
    }

    const items = Array.isArray(data.items) ? data.items : [];
    return NextResponse.json({
      ok:       true,
      items,                       // [{ slug, quantity, ... }]
      name:     data.name  ?? "",
      email:    data.email ?? "",
      phone:    data.phone ?? "",
      subtotal: data.subtotal ?? 0,
    });
  } catch (e) {
    console.error("[Recover] error:", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
