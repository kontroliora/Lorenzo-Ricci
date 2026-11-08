import { supabase } from "@/lib/supabase";

// One place for "is this promo code usable, and at what rate" — used by the cart's
// /api/promo/validate and by /api/order, so the server never takes the browser's
// word for a promo discount.
export type PromoCheck = { valid: true; discount: number } | { valid: false; error: string };

// The -10% signup offer is gone (owner, 03.11.2026): no new codes are issued. The newsletter signup still adds a row
// (newsletter_get_or_create needs a code for it), so a code created after this moment is never accepted.
export const PROMO_ISSUED_UNTIL = Date.parse("2026-11-03T13:30:00Z");
// Every code still out there stops working after 31.12.2026 23:59 Sofia time (EET, UTC+2), "unlimited" ones included.
// A code with an earlier expiry of its own keeps that earlier date.
export const PROMO_FINAL_EXPIRY = Date.parse("2026-12-31T23:59:59+02:00");
// Promo codes are switched off entirely (owner, 08.11.2026): the cart and the checkout have no code field, /api/promo/validate
// refuses every code and /api/order refuses an order that still carries a promo discount (a stale tab). true = the old behaviour.
export const PROMO_CODES_ENABLED: boolean = false;
export const PROMO_DISABLED_ERROR = "Промо кодовете вече не се приемат. Моля, обновете страницата.";
// Codes never apply to discounted products (no stacking; lib/bundles.ts promoBase, re-checked in lib/order-pricing.ts).
export const PROMO_NOT_ON_SALE = "Кодът не важи за продукти на намаление";

type PromoRow = {
  found: boolean; code_used: boolean; subscribed_at: string | null;
  discount: number | null; expires_at: string | null;
};

// Throws when the lookup itself fails — the caller decides what that means.
export async function checkPromoCode(code: unknown): Promise<PromoCheck> {
  if (!PROMO_CODES_ENABLED) return { valid: false, error: PROMO_DISABLED_ERROR };
  const clean = String(code ?? "").trim().toUpperCase();
  if (!clean) return { valid: false, error: "Въведете промо код" };

  // Look up just this one code via a SECURITY DEFINER function — the anon key
  // can no longer read the subscribers table directly.
  const { data, error } = await supabase.rpc("promo_lookup", { p_code: clean }).single();
  if (error) throw error;
  const row = data as PromoRow | null;

  if (!row || !row.found) return { valid: false, error: "Невалиден промо код" };
  if (row.code_used) return { valid: false, error: "Промо кодът вече е използван" };
  const issued = row.subscribed_at ? new Date(row.subscribed_at).getTime() : NaN;
  if (!Number.isNaN(issued) && issued > PROMO_ISSUED_UNTIL) return { valid: false, error: "Невалиден промо код" };

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
  if (expired || Date.now() > PROMO_FINAL_EXPIRY) return { valid: false, error: "Кодът е изтекъл" };

  // Discount travels with the code (10% newsletter, 5% waitlist apology).
  return { valid: true, discount: typeof row.discount === "number" ? row.discount : 0.10 };
}
