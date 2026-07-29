import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json() as { code?: string };
    const clean = (code ?? "").trim().toUpperCase();

    if (!clean) {
      return NextResponse.json({ valid: false, error: "Въведете промо код" });
    }

    // Look up just this one code via a SECURITY DEFINER function — the anon key
    // can no longer read the subscribers table directly.
    const { data } = await supabase
      .rpc("promo_lookup", { p_code: clean })
      .single();
    const row = data as {
      found: boolean; code_used: boolean; subscribed_at: string | null;
      discount: number | null; expires_at: string | null;
    } | null;

    if (!row || !row.found) {
      return NextResponse.json({ valid: false, error: "Невалиден промо код" });
    }

    if (row.code_used) {
      return NextResponse.json({ valid: false, error: "Промо кодът вече е използван" });
    }

    // Expiry: a stored expires_at wins — waitlist codes store 'infinity', which
    // serialises to a non-date string → never expires. When expires_at is null,
    // fall back to the legacy computed rule: 14 days from subscribed_at, applied
    // only to codes issued from the rule start onward (earlier ones grandfathered).
    const exp = row.expires_at;
    let expired = false;
    if (exp) {
      const expMs = new Date(exp).getTime();
      expired = !Number.isNaN(expMs) && Date.now() > expMs;
    } else {
      const RULE_START = Date.parse("2026-07-07T15:40:00Z");
      const created = new Date(row.subscribed_at as string).getTime();
      expired = created >= RULE_START && Date.now() > created + 14 * 86_400_000;
    }
    if (expired) {
      return NextResponse.json({ valid: false, error: "Кодът е изтекъл" });
    }

    // Discount now travels with the code (10% newsletter, 5% waitlist apology).
    const discount = typeof row.discount === "number" ? row.discount : 0.10;
    return NextResponse.json({ valid: true, discount });
  } catch (err) {
    console.error("[Promo] Validate error:", err);
    return NextResponse.json({ valid: false, error: "Грешка при проверката" });
  }
}
