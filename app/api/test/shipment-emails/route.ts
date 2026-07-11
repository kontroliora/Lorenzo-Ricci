import { NextResponse } from "next/server";
import { Resend } from "resend";
import {
  buildShippedEmail,
  buildReminderOfficeEmail,
  buildReminderDoorEmail,
  shipmentSubjects,
  trackPageUrl,
  type ShipmentEmailData,
} from "@/lib/shipment-emails";

// ── TEMPORARY test endpoint ──────────────────────────────────────────────────
// Sends the FINAL approved templates (shipped + reminder office + reminder door)
// to the OWNER only, for review before anything reaches customers. Token-guarded,
// recipient hard-locked. Remove at activation.
const TEST_TOKEN = "lr-ship-test-8x2k";
const TEST_TO = "sodolos3@gmail.com";
const FROM = "Lorenzo Ricci <info@lorenzo-ricci.com>";

export async function GET(req: Request) {
  if (new URL(req.url).searchParams.get("token") !== TEST_TOKEN) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const key = process.env.RESEND_API_KEY;
  if (!key) return NextResponse.json({ ok: false, error: "RESEND_API_KEY not set" }, { status: 500 });
  const resend = new Resend(key);

  const d: ShipmentEmailData = {
    firstName: "Иван",
    ref: "LR-TEST-001",
    items: [{ name: "Кардхолдър Ambra", qty: 1, price: 65, currency: "€" }],
    total: "65.00",
    currency: "€",
    tracking: "1234567890",
    trackUrl: trackPageUrl("1234567890"),
    officeName: "Русе Чародейка",
  };

  const emails = [
    { subject: shipmentSubjects.shipped(d.ref), html: buildShippedEmail(d) },
    { subject: `${shipmentSubjects.reminder(d.ref)} [тест: офис]`, html: buildReminderOfficeEmail(d) },
    { subject: `${shipmentSubjects.reminder(d.ref)} [тест: адрес]`, html: buildReminderDoorEmail(d) },
  ];

  const results: Array<{ subject: string; id: string | null; error: string | null }> = [];
  for (const e of emails) {
    const { data, error } = await resend.emails.send({ from: FROM, to: [TEST_TO], subject: e.subject, html: e.html });
    results.push({ subject: e.subject, id: data?.id ?? null, error: error?.message ?? null });
  }
  return NextResponse.json({ ok: true, sentTo: TEST_TO, results });
}
