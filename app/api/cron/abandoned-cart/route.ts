import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { buildRecoveryEmail, type RecoverySession } from "@/lib/recovery-email";
import { buildRoRecoveryEmail, roRecoverySubject, type RoRecoverySession } from "@/lib/ro/recovery-email";
import { langOf, mayEmail } from "@/lib/mail-policy";
import { getSuppressedEmails } from "@/lib/marketing-suppression";

// mail-policy: abandoned_cart

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

  // Window: abandoned 1 h–7 days ago. The upper bound matters — capture was
  // RLS-broken until 2026-07-13, so any pre-existing rows could be weeks old;
  // we must not email someone about a cart from last month on the first run.
  // Also: pending, no recovery email yet, email known, AND recovery_consent is
  // NOT an explicit false — anyone who UNTICKED the marketing box has opted out
  // and must never get a recovery email. true / null (the default) still send.
  const idleCutoff = new Date(Date.now() -            60 * 60 * 1000).toISOString(); // >1 h idle
  const ageCutoff  = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(); // <7 days old

  // `lang` (supabase/lang_columns.sql) says which site the cart came from; without the column every cart is a Bulgarian one, as before.
  const baseQuery = (cols: string) => supabase
    .from("cart_sessions")
    .select(cols)
    .eq("status", "pending")
    .not("recovery_consent", "is", false) // GDPR: skip explicit opt-outs (unticked box); true/null still send
    .is("recovery_sent_at", null)
    .not("email", "is", null)
    .lt("updated_at", idleCutoff)
    .gt("updated_at", ageCutoff)
    .limit(50);
  let { data: sessions, error } = await baseQuery("session_id, email, name, phone, items, subtotal, updated_at, recovery_consent, lang");
  if (error && /lang/i.test(error.message)) {
    ({ data: sessions, error } = await baseQuery("session_id, email, name, phone, items, subtotal, updated_at, recovery_consent"));
  }

  if (error) {
    console.error("[AbandonedCart] Query error:", error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  if (!sessions?.length) {
    console.log("[AbandonedCart] No abandoned sessions found");
    return NextResponse.json({ ok: true, sent: 0 });
  }

  // Marketing suppression: skip anyone who opted out of marketing emails.
  const sessionEmails = (sessions as unknown as { email: string }[]).map((s) => s.email.toLowerCase().trim());
  const unsubSet = await getSuppressedEmails(sessionEmails);

  const resend = new Resend(resendKey);
  let sent = 0;

  for (const session of sessions as unknown as (RecoverySession & { lang?: string | null; recovery_consent?: boolean | null })[]) {
    // Skip empty carts — nothing to recover.
    if (!Array.isArray(session.items) || session.items.length === 0) continue;
    // Skip anyone who unsubscribed from marketing via the newsletter list.
    if (unsubSet.has(session.email.toLowerCase().trim())) {
      console.log(`[AbandonedCart] Suppressed (unsubscribed) ${session.session_id}`);
      continue;
    }
    // The reminder is in the language of the site the cart came from. Romanian carts additionally need the explicit consent
    // (the /ro checkout only stores a cart when it was given); anything without a version in the recipient's language is not sent.
    const lang = langOf(session);
    const ro = lang === "ro";
    if (!mayEmail("abandoned_cart", lang, ro ? "ro" : "bg")) continue;
    if (ro && session.recovery_consent !== true) continue;
    try {
      const { error: emailError } = await resend.emails.send({
        from:    "Lorenzo Ricci <info@lorenzo-ricci.com>",
        to:      session.email,
        subject: ro ? roRecoverySubject : "Вашата количка ви очаква — Lorenzo Ricci",
        html:    ro ? buildRoRecoveryEmail(session as unknown as RoRecoverySession) : buildRecoveryEmail(session),
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
