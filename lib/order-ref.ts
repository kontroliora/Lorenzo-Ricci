// Order references are minted in the browser (the Meta Purchase event id needs the number before the request is sent),
// so the server validates their shape and the database enforces uniqueness (supabase/stripe_payments.sql).
// 8 characters from a 32-letter alphabet: ~40 bits of randomness, not guessable, no look-alike characters.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function newOrderRef(prefix: "LR" | "LRRO"): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return `${prefix}-${Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("")}`;
}

/** Bulgaria: LR-XXXXXXXX (older tabs may still send 6 characters), Romania: LRRO-XXXXXXXX. */
export const BG_ORDER_REF_RE = /^LR-[A-Z0-9]{6,10}$/;
export const RO_ORDER_REF_RE = /^LRRO-[A-Z0-9]{6,10}$/;
/** Any shop reference, as seen in Stripe metadata (events from other sites on the same Stripe account fail this). */
export const ANY_ORDER_REF_RE = /^LR(RO)?-[A-Z0-9]{4,10}$/;
