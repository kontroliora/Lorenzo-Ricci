// Vercel Cron (daily) — shipment notifications. Two emails, each sent once:
//   Email 1  ship confirmation — when Econt has physically accepted the parcel
//            (analyzeShipment.accepted === sendTime != null). NOT on tracking
//            generation (a "prepared"-only shipment has sendTime = null).
//   Email 2  single reminder — parcel waiting uncollected at the recipient's
//            final office for 4+ days (office delivery), or parked there after a
//            failed door attempt. Never if delivered/returned.
// No sends on Sat/Sun (Europe/Sofia). Dedup via shipped_at / ship_email_sent_at
// / reminder_sent_at. Needs CRON_SECRET + SUPABASE_SERVICE_ROLE_KEY + RESEND_API_KEY.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { getRawStatuses, analyzeShipment } from "@/lib/econt";
import {
  buildShippedEmail, buildReminderOfficeEmail, buildReminderDoorEmail,
  shipmentSubjects, trackPageUrl, type ShipmentEmailData, type ShipmentItem,
} from "@/lib/shipment-emails";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FROM = "Lorenzo Ricci <info@lorenzo-ricci.com>";
const MIN_DAYS_AT_OFFICE = 4;             // 4-5 days after arrival at final office
const DAY = 86_400_000;

function isWeekendSofia(now = Date.now()): boolean {
  const wd = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Sofia", weekday: "short" }).format(new Date(now));
  return wd === "Sat" || wd === "Sun";
}

type OrderRow = {
  id: number; order_ref: string | null; name: string | null; email: string | null;
  tracking_number: string | null; items: unknown; total: number | null;
  ship_email_sent_at: string | null; reminder_sent_at: string | null;
};

function toEmailData(o: OrderRow, awb: string): ShipmentEmailData {
  const rawItems = Array.isArray(o.items) ? (o.items as Array<Record<string, unknown>>) : [];
  const items: ShipmentItem[] = rawItems.map((i) => ({
    name: String(i.name ?? "Артикул"),
    qty: Number(i.qty ?? i.quantity ?? 1) || 1,
    price: Number(i.price ?? 0) || 0,
    currency: String(i.currency ?? "€"),
  }));
  return {
    firstName: (o.name ?? "").trim().split(" ")[0] || "клиент",
    ref: o.order_ref ?? String(o.id),
    items,
    total: (Number(o.total ?? 0) || 0).toFixed(2),
    currency: items[0]?.currency ?? "€",
    tracking: awb,
    trackUrl: trackPageUrl(awb),
  };
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (isWeekendSofia()) {
    return NextResponse.json({ ok: true, skipped: "weekend" });
  }
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const resendKey = process.env.RESEND_API_KEY;
  if (!url || !key) return NextResponse.json({ ok: false, error: "SUPABASE_SERVICE_ROLE_KEY not configured" }, { status: 500 });
  if (!resendKey) return NextResponse.json({ ok: false, error: "RESEND_API_KEY not configured" }, { status: 500 });

  const sb = createClient(url, key, { auth: { persistSession: false } });
  const resend = new Resend(resendKey);

  // Candidates: shipped, have tracking + email, still owe at least one email.
  const { data, error } = await sb
    .from("orders")
    .select("id, order_ref, name, email, tracking_number, items, total, ship_email_sent_at, reminder_sent_at")
    .eq("status", "shipped")
    .not("tracking_number", "is", null)
    .not("email", "is", null)
    .or("ship_email_sent_at.is.null,reminder_sent_at.is.null");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const orders = (data ?? []) as OrderRow[];
  if (!orders.length) return NextResponse.json({ ok: true, candidates: 0, shipped: 0, reminders: 0 });

  const statuses = await getRawStatuses(orders.map((o) => String(o.tracking_number).replace(/\s+/g, "")));

  const now = Date.now();
  let sentShipped = 0, sentReminder = 0, skipped = 0;

  for (const o of orders) {
    const awb = String(o.tracking_number).replace(/\s+/g, "");
    const raw = statuses.get(awb);
    if (!raw) { skipped++; continue; }
    const a = analyzeShipment(raw);
    const d = toEmailData(o, awb);

    // ── Email 1 — Econt has accepted the parcel ──────────────────────────────
    if (!o.ship_email_sent_at && a.accepted) {
      const { error: e } = await resend.emails.send({ from: FROM, to: [o.email!], subject: shipmentSubjects.shipped(d.ref), html: buildShippedEmail(d) });
      if (!e) {
        await sb.from("orders").update({
          shipped_at: a.shippedAtMs ? new Date(a.shippedAtMs).toISOString() : new Date(now).toISOString(),
          ship_email_sent_at: new Date(now).toISOString(),
        }).eq("id", o.id);
        sentShipped++;
      } else { console.error("[ShipCron] ship email failed", o.id, e.message); }
    }

    // ── Email 2 — single reminder (never if delivered/returned) ──────────────
    if (!o.reminder_sent_at && !a.delivered && !a.returned && a.atFinalOffice && a.arrivedAtFinalOfficeMs) {
      const daysAtOffice = (now - a.arrivedAtFinalOfficeMs) / DAY;
      const officeCase = a.deliveryType === "office";
      const doorCase = a.deliveryType === "door" && a.deliveryAttemptCount > 0;
      if (daysAtOffice >= MIN_DAYS_AT_OFFICE && (officeCase || doorCase)) {
        const html = doorCase ? buildReminderDoorEmail(d) : buildReminderOfficeEmail(d);
        const { error: e } = await resend.emails.send({ from: FROM, to: [o.email!], subject: shipmentSubjects.reminder(d.ref), html });
        if (!e) {
          await sb.from("orders").update({ reminder_sent_at: new Date(now).toISOString() }).eq("id", o.id);
          sentReminder++;
        } else { console.error("[ShipCron] reminder failed", o.id, e.message); }
      }
    }
  }

  console.log("[ShipCron]", JSON.stringify({ candidates: orders.length, sentShipped, sentReminder, skipped }));
  return NextResponse.json({ ok: true, candidates: orders.length, shipped: sentShipped, reminders: sentReminder, skipped });
}
