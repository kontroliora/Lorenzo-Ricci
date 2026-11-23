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
 * Standalone campaign scripts (private/email-campaigns/<month>/send.mjs) cannot import
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

/**
 * Stop all MARKETING e-mail to these addresses (owner, 23.11.2026: hard bounces). Sets newsletter_subscribers.unsubscribed_at - the
 * one suppression source every marketing path reads (above, and loadSubscribers() of the campaign script) - inserting a row when the
 * address is not a subscriber (e.g. an opted-in customer). Transactional e-mail never reads it, so order confirmations still go out.
 * An address already suppressed keeps its original date. Returns how many addresses were newly suppressed. Never throws.
 */
export async function suppressMarketing(emails: string[]): Promise<number> {
  const list = [...new Set(emails.map((e) => e.toLowerCase().trim()).filter((e) => e.includes("@")))];
  if (!list.length) return 0;
  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb.from("newsletter_subscribers").select("email, unsubscribed_at").in("email", list);
    if (error) throw new Error(error.message);
    const known = new Map((data ?? []).map((r: { email: string; unsubscribed_at: string | null }) => [r.email.toLowerCase().trim(), r.unsubscribed_at]));
    const now = new Date().toISOString();
    const toUpdate = list.filter((e) => known.has(e) && !known.get(e));
    const toInsert = list.filter((e) => !known.has(e));
    if (toUpdate.length) {
      const u = await sb.from("newsletter_subscribers").update({ unsubscribed_at: now }).in("email", toUpdate).is("unsubscribed_at", null);
      if (u.error) throw new Error(u.error.message);
    }
    if (toInsert.length) {
      const i = await sb.from("newsletter_subscribers").insert(toInsert.map((email) => ({ email, unsubscribed_at: now })));
      if (i.error) throw new Error(i.error.message);
    }
    return toUpdate.length + toInsert.length;
  } catch (e) {
    console.error("[marketing-suppression] suppressMarketing failed:", e instanceof Error ? e.message : e);
    return 0;
  }
}
