import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const VALID_DAYS = 14;

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars (0/O, 1/I)
  let code = "LR-";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// Expiry = creation + 14 days. Computed from subscribed_at so it works even if
// the expires_at column migration hasn't run yet.
function expiryFrom(subscribedAtISO: string): string {
  return new Date(new Date(subscribedAtISO).getTime() + VALID_DAYS * 86_400_000).toISOString();
}

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json() as { email?: string };
    const clean = (email ?? "").trim().toLowerCase();

    if (!clean || !clean.includes("@")) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    // One email = one code. If it already exists, NEVER generate a new one —
    // return the same code + its status so the UI can say "вече абониран".
    const { data: existing } = await supabase
      .from("newsletter_subscribers")
      .select("promo_code, code_used, subscribed_at")
      .eq("email", clean)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        success: true,
        alreadySubscribed: true,
        code: existing.promo_code,
        used: existing.code_used,
        expiresAt: expiryFrom(existing.subscribed_at),
      });
    }

    // New subscriber — generate + insert. expires_at is filled by the column
    // DEFAULT (once the migration is run); the response computes it regardless.
    let code = generateCode();
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const { error } = await supabase
        .from("newsletter_subscribers")
        .insert({ email: clean, promo_code: code, code_used: false });
      if (!error) { lastErr = null; break; }
      lastErr = error;

      // Someone inserted this email between our SELECT and INSERT (unique race)
      // → return the existing code instead of minting a second one.
      const { data: raced } = await supabase
        .from("newsletter_subscribers")
        .select("promo_code, code_used, subscribed_at")
        .eq("email", clean)
        .maybeSingle();
      if (raced) {
        return NextResponse.json({
          success: true,
          alreadySubscribed: true,
          code: raced.promo_code,
          used: raced.code_used,
          expiresAt: expiryFrom(raced.subscribed_at),
        });
      }
      // Otherwise a (astronomically rare) promo_code collision → regenerate.
      code = generateCode();
    }
    if (lastErr) throw lastErr;

    console.log("[Newsletter] New subscriber:", clean, "code:", code);
    return NextResponse.json({
      success: true,
      alreadySubscribed: false,
      code,
      used: false,
      expiresAt: new Date(Date.now() + VALID_DAYS * 86_400_000).toISOString(),
    });
  } catch (err) {
    console.error("[Newsletter] Error:", err);
    return NextResponse.json({ error: "Failed to subscribe" }, { status: 500 });
  }
}
