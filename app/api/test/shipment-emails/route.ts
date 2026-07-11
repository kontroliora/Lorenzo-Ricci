import { NextResponse } from "next/server";
import { Resend } from "resend";
import {
  buildShippedEmail,
  buildReminderEmail,
  buildFinalReminderEmail,
  shipmentSubjects,
  econtTrackUrl,
  type ShipmentEmailData,
} from "@/lib/shipment-emails";

// ── TEMPORARY test endpoint ──────────────────────────────────────────────────
// Sends one sample of each of the 3 shipment emails to the OWNER only, so the
// design/tone/deliverability can be reviewed before anything goes to customers.
// Guarded by a token; recipient is hard-locked to the owner. Delete this route
// once the emails are approved.
const TEST_TOKEN = "lr-ship-test-8x2k";
const TEST_TO = "sodolos3@gmail.com";
const FROM = "Lorenzo Ricci <info@lorenzo-ricci.com>";

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  if (token !== TEST_TOKEN) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    return NextResponse.json({ ok: false, error: "RESEND_API_KEY not set" }, { status: 500 });
  }
  const resend = new Resend(key);

  const d: ShipmentEmailData = {
    firstName: "Иван",
    ref: "LR-TEST-001",
    product: "Кардхолдър Ambra",
    tracking: "1234567890",
    amount: "65.00",
    trackUrl: econtTrackUrl("1234567890"),
  };

  const emails = [
    { subject: shipmentSubjects.shipped(d.ref), html: buildShippedEmail(d) },
    { subject: shipmentSubjects.reminder(d.ref), html: buildReminderEmail(d) },
    { subject: shipmentSubjects.final(d.ref), html: buildFinalReminderEmail(d) },
  ];

  const results: Array<{ subject: string; id: string | null; error: string | null }> = [];
  for (const e of emails) {
    const { data, error } = await resend.emails.send({ from: FROM, to: [TEST_TO], subject: e.subject, html: e.html });
    results.push({ subject: e.subject, id: data?.id ?? null, error: error?.message ?? null });
  }

  return NextResponse.json({ ok: true, sentTo: TEST_TO, results });
}
