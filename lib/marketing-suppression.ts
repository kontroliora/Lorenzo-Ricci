/**
 * marketing-suppression — single gate for every outbound marketing email.
 *
 * ALL marketing send paths (Ранен Черен петък / Early Black Friday, Private Sale,
 * Christmas, waitlist codes, VIP, abandoned-cart recovery) MUST call
 * getSuppressedEmails() (or isSuppressed()) and skip any address it returns.
 *
 * Transactional emails (order confirmation, shipment tracking, card-payment
 * receipt) are EXEMPT and must NOT be filtered through this helper.
 *
 * The suppression source is newsletter_subscribers.unsubscribed_at:
 *   - Set via POST /api/unsubscribe (visitor opt-out link)
 *   - Set via admin tooling / migration for mandatory removals
 * It is intentionally separate from the transactional-email path so that a
 * marketing opt-out never blocks a customer from receiving their order details.
 *
 * Standalone campaign scripts (private/email-campaigns/*/send.mjs) cannot import
 * TypeScript, so they reproduce the same check inline inside loadSubscribers()
 * with an explicit cross-reference comment. If you change the suppression logic
 * here, update that function too.
 */

import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * Given a list of candidate email addresses, returns the subset that are
 * suppressed (i.e. have a non-NULL unsubscribed_at in newsletter_subscribers).
 * Matching is case-insensitive. Returns an empty set on any DB error so that
 * a transient failure is conservative (block nothing) rather than loud.
 */
export async function getSuppressedEmails(emails: string[]): Promise<Set<string>> {
  if (!emails.length) return new Set();
  const normalised = emails.map((e) => e.toLowerCase().trim());
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("newsletter_subscribers")
    .select("email")
    .in("email", normalised)
    .not("unsubscribed_at", "is", null);
  if (error) {
    console.error("[marketing-suppression] getSuppressedEmails error:", error.message);
    return new Set(); // fail open: do not block sends on a transient DB error
  }
  return new Set((data ?? []).map((r: { email: string }) => r.email.toLowerCase().trim()));
}

/**
 * Convenience wrapper for checking a single email address.
 */
export async function isSuppressed(email: string): Promise<boolean> {
  const set = await getSuppressedEmails([email]);
  return set.has(email.toLowerCase().trim());
}
