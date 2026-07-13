import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { buildRecoveryEmail, type RecoverySession } from "@/lib/recovery-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── GET /api/cron/abandoned-cart ─────────────────────────────────────────────
// Vercel Cron (daily, schedule in vercel.json). Vercel injects
// Authorization: Bearer ${CRON_SECRET}. Reads cart_sessions with the SERVICE
// key — anon can't SELECT the table under RLS (that silently returned 0 for as
// long as this cron used the anon client, so no recovery email ever went out).

export async function GET(req: NextRequest) {
  // Fail CLOSED. Guard tolerates a stray "Bearer " prefix / surrounding whitespace.
  const cronSecret = (process.env.CRON_SECRET ?? "").trim();
  const auth = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!cronSecret || auth !== cronSecret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.warn("[AbandonedCart] RESEND_API_KEY not set — skipping");
    return NextResponse.json({ ok: true, sent: 0 });
  }

  const supabase = supabaseAdmin();

  // Sessions: pending, >1 h idle, no recovery email yet, email known.
  // Send policy = ALL captured carts with an email (no consent filter, by choice).
  const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { data: sessions, error } = await supabase
    .from("cart_sessions")
    .select("session_id, email, name, phone, items, subtotal, updated_at")
    .eq("status", "pending")
    .is("recovery_sent_at", null)
    .not("email", "is", null)
    .lt("updated_at", cutoff)
    .limit(50);

  if (error) {
    console.error("[AbandonedCart] Query error:", error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  if (!sessions?.length) {
    console.log("[AbandonedCart] No abandoned sessions found");
    return NextResponse.json({ ok: true, sent: 0 });
  }

  const resend = new Resend(resendKey);
  let sent = 0;

  for (const session of sessions as RecoverySession[]) {
    // Skip empty carts — nothing to recover.
    if (!Array.isArray(session.items) || session.items.length === 0) continue;
    try {
      const { error: emailError } = await resend.emails.send({
        from:    "Lorenzo Ricci <info@lorenzo-ricci.com>",
        to:      session.email,
        subject: "Вашата количка ви очаква — Lorenzo Ricci",
        html:    buildRecoveryEmail(session),
      });

      if (emailError) {
        console.error(`[AbandonedCart] Email failed for ${session.session_id}:`, emailError);
        continue;
      }

      await supabase
        .from("cart_sessions")
        .update({ recovery_sent_at: new Date().toISOString() })
        .eq("session_id", session.session_id);

      sent++;
      console.log(`[AbandonedCart] Sent to session ${session.session_id}`);
    } catch (err) {
      console.error(`[AbandonedCart] Error for session ${session.session_id}:`, err);
    }
  }

  return NextResponse.json({ ok: true, sent });
}
