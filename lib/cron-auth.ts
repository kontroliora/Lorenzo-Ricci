import { timingSafeEqual } from "node:crypto";

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
