import { createHmac, timingSafeEqual } from "node:crypto";

// Signed "I changed my mind" link: Stripe's cancel_url carries ct = HMAC(order reference). Only that link can release
// the order's stock early (the customer left the Stripe page), so nobody can cancel somebody else's pending order by
// guessing a reference. Secret: PAYMENT_TOKEN_SECRET, falling back to CRON_SECRET / STRIPE_WEBHOOK_SECRET (already set).
const secret = () => (process.env.PAYMENT_TOKEN_SECRET || process.env.CRON_SECRET || process.env.STRIPE_WEBHOOK_SECRET || "").trim();

export function cancelToken(ref: string): string {
  const s = secret();
  if (!s) throw new Error("no secret available for the cancel token");
  return createHmac("sha256", s).update("cancel:" + ref).digest("base64url").slice(0, 24);
}

export function verifyCancelToken(ref: string, token: string): boolean {
  const s = secret();
  if (!s || !token) return false;
  const a = Buffer.from(cancelToken(ref));
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}
