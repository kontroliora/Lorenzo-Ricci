import { supabase } from "@/lib/supabase";

// One place for "is this promo code usable, and at what rate" — used by the cart's
// /api/promo/validate and by /api/order, so the server never takes the browser's
// word for a promo discount.
export type PromoCheck = { valid: true; discount: number } | { valid: false; error: string };

type PromoRow = {
  found: boolean; code_used: boolean; subscribed_at: string | null;
  discount: number | null; expires_at: string | null;
};

// Throws when the lookup itself fails — the caller decides what that means.
export async function checkPromoCode(code: unknown): Promise<PromoCheck> {
  const clean = String(code ?? "").trim().toUpperCase();
  if (!clean) return { valid: false, error: "Въведете промо код" };

  // Look up just this one code via a SECURITY DEFINER function — the anon key
  // can no longer read the subscribers table directly.
  const { data, error } = await supabase.rpc("promo_lookup", { p_code: clean }).single();
  if (error) throw error;
  const row = data as PromoRow | null;

  if (!row || !row.found) return { valid: false, error: "Невалиден промо код" };
  if (row.code_used) return { valid: false, error: "Промо кодът вече е използван" };

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
  if (expired) return { valid: false, error: "Кодът е изтекъл" };

  // Discount travels with the code (10% newsletter, 5% waitlist apology).
  return { valid: true, discount: typeof row.discount === "number" ? row.discount : 0.10 };
}
