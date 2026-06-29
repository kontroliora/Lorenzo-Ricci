import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { supabase } from "@/lib/supabase";
import { buildRecoveryEmail, type RecoverySession } from "@/lib/recovery-email";

// ── GET /api/cron/abandoned-cart ─────────────────────────────────────────────
// Called by Vercel Cron every 10 minutes.
// Vercel automatically injects Authorization: Bearer ${CRON_SECRET}.

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.warn("[AbandonedCart] RESEND_API_KEY not set — skipping");
    return NextResponse.json({ ok: true, sent: 0 });
  }

  // Sessions pending, >1 h old, no recovery email sent yet, email known
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
      console.log(`[AbandonedCart] Sent to ${session.email}`);
    } catch (err) {
      console.error(`[AbandonedCart] Error for session ${session.session_id}:`, err);
    }
  }

  return NextResponse.json({ ok: true, sent });
}
