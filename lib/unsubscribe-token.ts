import { createHmac, timingSafeEqual } from "node:crypto";

// Signed newsletter-unsubscribe links, so nobody can unsubscribe someone else by guessing an email:
//   /api/unsubscribe?e=<base64url(email)>&t=<base64url(HMAC-SHA256("unsub:" + email))>
// The secret is UNSUBSCRIBE_SECRET, falling back to CRON_SECRET (already set in production),
// so no new env var is required. No secret → no tokens (fails closed).
const secret = () => (process.env.UNSUBSCRIBE_SECRET || process.env.CRON_SECRET || "").trim();
const norm = (email: string) => email.trim().toLowerCase();

export function unsubscribeToken(email: string): string | null {
  const s = secret();
  if (!s) return null;
  return createHmac("sha256", s).update("unsub:" + norm(email)).digest("base64url");
}

/** Returns the email when the link is genuine, else null. */
export function verifyUnsubscribe(e: string | null, t: string | null): string | null {
  if (!e || !t) return null;
  let email: string;
  try {
    email = norm(Buffer.from(e, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!email.includes("@") || email.length > 254) return null;
  const expected = unsubscribeToken(email);
  if (!expected) return null;
  const a = Buffer.from(expected);
  const b = Buffer.from(t);
  return a.length === b.length && timingSafeEqual(a, b) ? email : null;
}

export function unsubscribeUrl(email: string, base = "https://www.lorenzo-ricci.com"): string | null {
  const t = unsubscribeToken(email);
  if (!t) return null;
  const e = Buffer.from(norm(email), "utf8").toString("base64url");
  return `${base}/api/unsubscribe?e=${e}&t=${t}`;
}
