import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { reconcileStripe } from "@/lib/stripe-reconcile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Stripe -> orders reconciliation (lib/stripe-reconcile.ts). Called by:
//   - Vercel Cron, daily with ?days=30 (vercel.json; the Hobby plan allows daily crons only), with Authorization: Bearer ${CRON_SECRET};
//   - GitHub Actions every 15 minutes (.github/workflows/stripe-reconcile.yml), with Authorization: Bearer ${RECONCILE_SECRET}.
// ?days=N (1-60, default 7) widens the window for a one-off full check. The answer carries order references only (no customer data).

const sameSecret = (a: string, b: string): boolean => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

export async function GET(req: NextRequest) {
  const auth = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const secrets = [process.env.CRON_SECRET, process.env.RECONCILE_SECRET].map((s) => (s ?? "").trim()).filter(Boolean);
  if (!auth || !secrets.some((s) => sameSecret(auth, s))) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const days = Number(req.nextUrl.searchParams.get("days") ?? 7);
  try {
    const report = await reconcileStripe(supabaseAdmin(), { days: Number.isFinite(days) ? days : 7 });
    console.log("[stripe-reconcile]", JSON.stringify({ checked: report.checkedSessions, fixed: report.fixed.length, orphans: report.orphans.length, cardWithoutPayment: report.cardWithoutPayment.length, paidWithoutStripe: report.paidWithoutStripe.length, errors: report.errors.length }));
    return NextResponse.json({ ok: report.errors.length === 0, ...report });
  } catch (e) {
    console.error("[stripe-reconcile] failed:", e);
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
