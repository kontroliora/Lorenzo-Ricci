import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const VALID_DAYS = 14;

// The 14-day validity rule starts here. Codes issued BEFORE this moment were
// open-ended and are GRANDFATHERED (never expire) — we don't shorten codes
// people already hold. Only codes issued from here on expire after 14 days.
// Set just after the newest pre-existing code so all already-issued codes qualify.
const RULE_START = Date.parse("2026-07-07T15:40:00Z");

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars (0/O, 1/I)
  let code = "LR-";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// null  → grandfathered (open-ended, never expires)
// string → ISO expiry (creation + 14 days) for codes issued under the new rule
function expiryFor(subscribedAtISO: string): string | null {
  const created = Date.parse(subscribedAtISO);
  if (isNaN(created) || created < RULE_START) return null;
  return new Date(created + VALID_DAYS * 86_400_000).toISOString();
}

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json() as { email?: string };
    const clean = (email ?? "").trim().toLowerCase();

    if (!clean || !clean.includes("@")) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    // One email = one code. If it already exists, NEVER generate a new one.
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
        expiresAt: expiryFor(existing.subscribed_at), // null if grandfathered
      });
    }

    // New subscriber — generate + insert (handles the unique-email race).
    let code = generateCode();
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const { error } = await supabase
        .from("newsletter_subscribers")
        .insert({ email: clean, promo_code: code, code_used: false });
      if (!error) { lastErr = null; break; }
      lastErr = error;

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
          expiresAt: expiryFor(raced.subscribed_at),
        });
      }
      code = generateCode(); // rare promo_code collision → regenerate
    }
    if (lastErr) throw lastErr;

    console.log("[Newsletter] New subscriber:", clean, "code:", code);
    // Freshly issued → under the new rule → 14 days from now.
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
