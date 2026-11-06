import { createHmac, timingSafeEqual } from "node:crypto";

// Bearer auth for cron endpoints: Vercel Cron sends CRON_SECRET, the GitHub Actions schedules send RECONCILE_SECRET
// (the same pair /api/cron/stripe-reconcile accepts).
const same = (a: string, b: string): boolean => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

export function cronAuthorized(authorization: string | null): boolean {
  const auth = (authorization ?? "").replace(/^Bearer\s+/i, "").trim();
  const secrets = [process.env.CRON_SECRET, process.env.RECONCILE_SECRET].map((s) => (s ?? "").trim()).filter(Boolean);
  return !!auth && secrets.some((s) => same(auth, s));
}

/**
 * Narrow operator key for /api/cron/health?status=1 (read the last 2 run timestamps), ?sync=1 (pull Meta now) and ?simulate=on|off (a fake test problem
 * to try the Telegram alert): HMAC-SHA256(TELEGRAM_BOT_TOKEN, "lr-health-ops"), hex. Whoever holds the bot token can already
 * write to the alert chat; this key opens nothing else (no customer data, no orders).
 */
export function opsAuthorized(authorization: string | null): boolean {
  const bot = (process.env.TELEGRAM_BOT_TOKEN ?? "").trim();
  const auth = (authorization ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!bot || !auth) return false;
  return same(auth, createHmac("sha256", bot).update("lr-health-ops").digest("hex"));
}
