import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { toEmailData } from "@/lib/shipment-notify";
import { buildShippedEmail, shipmentSubjects } from "@/lib/shipment-emails";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// TEMPORARY, single-order surgical fix for order LR-JFKF3B (Венцислав): a typo'd
// email domain "g.mail.com" → "gmail.com", then re-send Email 1 (ship confirm).
// Hardcoded ref + a guard on the exact typo so it CANNOT touch any other order.
// Token-guarded; remove after use.
const TOKEN = "vc8m3q2z";
const REF = "LR-JFKF3B";
const BAD = "baterambo004499@g.mail.com";
const GOOD = "baterambo004499@gmail.com";
const FROM = "Lorenzo Ricci <info@lorenzo-ricci.com>";
const clean = (s: unknown) => String(s ?? "").replace(/\s+/g, "");

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  if (sp.get("k") !== TOKEN) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const mode = sp.get("mode") ?? "inspect";
  const sb = supabaseAdmin();

  // Query the Resend log for a given email id → returns last_event (delivered/bounced/…).
  if (mode === "check") {
    const id = sp.get("id");
    const key = process.env.RESEND_API_KEY;
    if (!id || !key) return NextResponse.json({ error: "need id + key" }, { status: 400 });
    const r = await fetch(`https://api.resend.com/emails/${id}`, { headers: { Authorization: `Bearer ${key}` } });
    const j = await r.json();
    return NextResponse.json({ httpStatus: r.status, last_event: j?.last_event ?? null, to: j?.to ?? null, subject: j?.subject ?? null, created_at: j?.created_at ?? null });
  }

  const { data, error } = await sb
    .from("orders")
    .select("id, order_ref, name, email, tracking_number, items, total, status, ship_email_sent_at")
    .eq("order_ref", REF)
    .single();
  if (error || !data) return NextResponse.json({ error: error?.message ?? "not found" }, { status: 404 });

  if (mode === "inspect") {
    return NextResponse.json({
      order_ref: data.order_ref,
      name: data.name,
      email: data.email,
      emailIsTypo: data.email === BAD,
      items: data.items,
      total: data.total,
      tracking_number: data.tracking_number,
      status: data.status,
      ship_email_sent_at: data.ship_email_sent_at,
    });
  }

  if (mode === "apply") {
    // Guard: only proceed if the email is still the exact known typo.
    if (data.email !== BAD) {
      return NextResponse.json(
        { error: "email is not the expected typo — aborting to avoid touching a changed order", currentEmail: data.email },
        { status: 409 },
      );
    }

    // 1) Fix the email (double-scoped WHERE: ref AND the typo).
    const { error: upErr } = await sb.from("orders").update({ email: GOOD }).eq("order_ref", REF).eq("email", BAD);
    if (upErr) return NextResponse.json({ error: "email update failed: " + upErr.message }, { status: 500 });

    // 2) Re-send Email 1 to the corrected address, using the real order data.
    const key = process.env.RESEND_API_KEY;
    if (!key) return NextResponse.json({ error: "RESEND_API_KEY missing", emailFixed: true, sent: false }, { status: 500 });
    const resend = new Resend(key);
    const d = toEmailData({ ...data, email: GOOD }, clean(data.tracking_number));
    const { data: sendData, error: sendErr } = await resend.emails.send({
      from: FROM,
      to: [GOOD],
      subject: shipmentSubjects.shipped(d.ref),
      html: buildShippedEmail(d),
    });
    if (sendErr) return NextResponse.json({ emailFixed: true, sent: false, resendError: sendErr.message }, { status: 500 });

    // 3) Mark Email 1 as (re)sent to the correct address.
    const nowIso = new Date().toISOString();
    await sb.from("orders").update({ ship_email_sent_at: nowIso }).eq("order_ref", REF);

    return NextResponse.json({
      emailFixed: true,
      sent: true,
      resendId: sendData?.id ?? null,
      sentTo: GOOD,
      subject: shipmentSubjects.shipped(d.ref),
      total: d.total,
      currency: d.currency,
      tracking: d.tracking,
      trackUrl: d.trackUrl,
      items: d.items,
    });
  }

  return NextResponse.json({ error: "unknown mode" }, { status: 400 });
}
