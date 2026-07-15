// Shared shipment-email passes, used by BOTH the daily cron and the "Обнови"
// admin action (so Email 1 goes out the moment tracking is reconciled, not up
// to 24h later). Every email is idempotent via the *_sent_at columns.
import type { SupabaseClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { getRawStatuses, analyzeShipment } from "./econt";
import {
  buildShippedEmail, buildReminderOfficeEmail, buildReminderDoorEmail,
  shipmentSubjects, trackPageUrl, type ShipmentEmailData, type ShipmentItem,
} from "./shipment-emails";

const FROM = "Lorenzo Ricci <info@lorenzo-ricci.com>";
const DAY = 86_400_000;
const MIN_DAYS_AT_OFFICE = 4;

const clean = (s: unknown) => String(s ?? "").replace(/\s+/g, "");
function getResend(): Resend | null {
  const k = process.env.RESEND_API_KEY;
  return k ? new Resend(k) : null;
}

// No reminders on Sat/Sun (Europe/Sofia). Email 1 ignores this — see cron.
export function isWeekendSofia(now = Date.now()): boolean {
  const wd = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Sofia", weekday: "short" }).format(new Date(now));
  return wd === "Sat" || wd === "Sun";
}

type OrderRow = {
  id: number; order_ref: string | null; name: string | null; email: string | null;
  tracking_number: string | null; items: unknown; total: number | null;
};

export function toEmailData(o: OrderRow, awb: string, officeName = ""): ShipmentEmailData {
  const raw = Array.isArray(o.items) ? (o.items as Array<Record<string, unknown>>) : [];
  const items: ShipmentItem[] = raw.map((i) => ({
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
    officeName,
  };
}

const SELECT = "id, order_ref, name, email, tracking_number, items, total";

// ── EMAIL 1 — ship confirmation. Sends for every shipped order that Econt has
// physically accepted (sendTime != null) and hasn't been emailed. NO weekday
// gate — transactional confirmations go out 7 days a week.
export async function sendShipConfirmations(sb: SupabaseClient): Promise<{ sent: number; scanned: number }> {
  const resend = getResend();
  if (!resend) return { sent: 0, scanned: 0 };
  const { data, error } = await sb.from("orders").select(SELECT)
    .eq("status", "shipped").not("tracking_number", "is", null).not("email", "is", null)
    .is("ship_email_sent_at", null);
  if (error) throw new Error(error.message);
  const orders = (data ?? []) as OrderRow[];
  if (!orders.length) return { sent: 0, scanned: 0 };

  const statuses = await getRawStatuses(orders.map((o) => clean(o.tracking_number)));
  const nowIso = new Date().toISOString();
  let sent = 0;
  for (const o of orders) {
    const raw = statuses.get(clean(o.tracking_number));
    if (!raw) continue;
    const a = analyzeShipment(raw);
    if (!a.accepted) continue;                                  // sendTime == null → the "prepared" trap
    if (a.returning || a.delivered) continue;                   // already heading back to sender / delivered → never send "on its way" (the LR-K2Y30V after-return bug)
    const d = toEmailData(o, clean(o.tracking_number));
    const { error: e } = await resend.emails.send({ from: FROM, to: [o.email!], subject: shipmentSubjects.shipped(d.ref), html: buildShippedEmail(d) });
    if (e) { console.error("[ship] email failed", o.id, e.message); continue; }
    await sb.from("orders").update({ shipped_at: a.shippedAtMs ? new Date(a.shippedAtMs).toISOString() : nowIso, ship_email_sent_at: nowIso }).eq("id", o.id);
    sent++;
  }
  return { sent, scanned: orders.length };
}

// ── EMAIL 2 — single reminder. Weekday gating is the CALLER's job (the cron
// skips this on weekends; Email 1 above never does).
export async function sendReminders(sb: SupabaseClient): Promise<{ sent: number; scanned: number }> {
  const resend = getResend();
  if (!resend) return { sent: 0, scanned: 0 };
  const { data, error } = await sb.from("orders").select(SELECT)
    .eq("status", "shipped").not("tracking_number", "is", null).not("email", "is", null)
    .is("reminder_sent_at", null);
  if (error) throw new Error(error.message);
  const orders = (data ?? []) as OrderRow[];
  if (!orders.length) return { sent: 0, scanned: 0 };

  const statuses = await getRawStatuses(orders.map((o) => clean(o.tracking_number)));
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  let sent = 0;
  for (const o of orders) {
    const raw = statuses.get(clean(o.tracking_number));
    if (!raw) continue;
    const a = analyzeShipment(raw);
    if (a.delivered || a.returned || !a.atFinalOffice || !a.arrivedAtFinalOfficeMs) continue;
    if ((now - a.arrivedAtFinalOfficeMs) / DAY < MIN_DAYS_AT_OFFICE) continue;
    const officeCase = a.deliveryType === "office";
    const doorCase = a.deliveryType === "door" && a.deliveryAttemptCount > 0;
    if (!officeCase && !doorCase) continue;
    const d = toEmailData(o, clean(o.tracking_number), a.officeName);
    const html = doorCase ? buildReminderDoorEmail(d) : buildReminderOfficeEmail(d);
    const { error: e } = await resend.emails.send({ from: FROM, to: [o.email!], subject: shipmentSubjects.reminder(d.ref), html });
    if (e) { console.error("[reminder] email failed", o.id, e.message); continue; }
    await sb.from("orders").update({ reminder_sent_at: nowIso }).eq("id", o.id);
    sent++;
  }
  return { sent, scanned: orders.length };
}
