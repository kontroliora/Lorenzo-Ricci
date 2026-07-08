import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const VALID_DAYS = 14;

// The 14-day validity rule starts here. Codes issued BEFORE this moment were
// open-ended and are GRANDFATHERED (never expire) — we don't shorten codes
// people already hold. Only codes issued from here on expire after 14 days.
// Set just after the newest pre-existing code so all already-issued codes qualify.
const RULE_START = Date.parse("2026-07-07T15:40:00Z");

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

    // One email = one code — resolved atomically server-side by a SECURITY
    // DEFINER function (the anon key has NO direct access to the table). It
    // returns the existing code, or generates + inserts a new one.
    const { data, error } = await supabase
      .rpc("newsletter_get_or_create", { p_email: clean })
      .single();
    const row = data as
      | { out_promo_code: string; out_code_used: boolean; out_subscribed_at: string; out_is_new: boolean }
      | null;
    if (error || !row) throw error ?? new Error("newsletter_get_or_create returned no row");

    if (row.out_is_new) console.log("[Newsletter] New subscriber, code:", row.out_promo_code);

    return NextResponse.json({
      success: true,
      alreadySubscribed: !row.out_is_new,
      code: row.out_promo_code,
      used: row.out_code_used,
      // New code → 14 days from now; existing → grandfathered / expiry from creation.
      expiresAt: row.out_is_new
        ? new Date(Date.now() + VALID_DAYS * 86_400_000).toISOString()
        : expiryFor(row.out_subscribed_at),
    });
  } catch (err) {
    console.error("[Newsletter] Error:", err);
    return NextResponse.json({ error: "Failed to subscribe" }, { status: 500 });
  }
}
