// TEMPORARY one-time backlog runner. Sends the single reminder (Email 2) to
// parcels that were already sitting uncollected before the system existed:
//   at final office, not delivered/returned, 2+ days there (office delivery), OR
//   parked at office after a failed door attempt, 2+ days.
// Only online orders that have an email. Dedup via reminder_sent_at, so the
// daily cron won't re-send. DRY RUN by default — add &send=1 to actually send.
// Token-guarded, no weekend sends. Remove after the one-time run.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { getRawStatuses, analyzeShipment } from "@/lib/econt";
import { buildReminderOfficeEmail, buildReminderDoorEmail, shipmentSubjects, trackPageUrl, type ShipmentEmailData, type ShipmentItem } from "@/lib/shipment-emails";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOKEN = "lr-backlog-8x2k";
const FROM = "Lorenzo Ricci <info@lorenzo-ricci.com>";
const MIN_DAYS_BACKLOG = 2;
const DAY = 86_400_000;

const maskEmail = (e: string) => e.replace(/^(..)[^@]*(@.*)$/, "$1***$2");

function isWeekendSofia(): boolean {
  const wd = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Sofia", weekday: "short" }).format(new Date());
  return wd === "Sat" || wd === "Sun";
}

type OrderRow = { id: number; order_ref: string | null; name: string | null; email: string | null; tracking_number: string | null; items: unknown; total: number | null };

function toEmailData(o: OrderRow, awb: string, officeName = ""): ShipmentEmailData {
  const raw = Array.isArray(o.items) ? (o.items as Array<Record<string, unknown>>) : [];
  const items: ShipmentItem[] = raw.map((i) => ({ name: String(i.name ?? "Артикул"), qty: Number(i.qty ?? i.quantity ?? 1) || 1, price: Number(i.price ?? 0) || 0, currency: String(i.currency ?? "€") }));
  return {
    firstName: (o.name ?? "").trim().split(" ")[0] || "клиент",
    ref: o.order_ref ?? String(o.id),
    items, total: (Number(o.total ?? 0) || 0).toFixed(2),
    currency: items[0]?.currency ?? "€", tracking: awb, trackUrl: trackPageUrl(awb),
    officeName,
  };
}

export async function GET(req: NextRequest) {
  const u = new URL(req.url);
  if (u.searchParams.get("token") !== TOKEN) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const send = u.searchParams.get("send") === "1";
  const limitRaw = u.searchParams.get("limit");
  const limit = limitRaw ? Math.max(0, parseInt(limitRaw, 10) || 0) : 0;   // 0 = no cap (send all)
  if (send && isWeekendSofia()) return NextResponse.json({ ok: false, error: "weekend — не се праща събота/неделя" }, { status: 400 });

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const resendKey = process.env.RESEND_API_KEY;
  if (!url || !key) return NextResponse.json({ ok: false, error: "SUPABASE_SERVICE_ROLE_KEY not configured" }, { status: 500 });
  if (send && !resendKey) return NextResponse.json({ ok: false, error: "RESEND_API_KEY not configured" }, { status: 500 });

  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await sb
    .from("orders")
    .select("id, order_ref, name, email, tracking_number, items, total")
    .eq("status", "shipped")
    .not("tracking_number", "is", null)
    .not("email", "is", null)
    .is("reminder_sent_at", null)
    .order("id", { ascending: true });   // stable order → canary sends the first N shown in the dry-run
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const orders = (data ?? []) as OrderRow[];
  const statuses = await getRawStatuses(orders.map((o) => String(o.tracking_number).replace(/\s+/g, "")));
  const resend = send && resendKey ? new Resend(resendKey) : null;
  const now = Date.now();

  const eligible: Array<{ ref: string; email: string; office: string; amount: string; tracking: string; case: string; daysAtOffice: number; sent: boolean }> = [];
  const skipped = { noEcontData: 0, deliveredOrReturned: 0, notAtFinalOffice: 0, tooRecent: 0, doorNoFailedAttempt: 0 };
  let sent = 0;

  for (const o of orders) {
    const awb = String(o.tracking_number).replace(/\s+/g, "");
    const raw = statuses.get(awb);
    if (!raw) { skipped.noEcontData++; continue; }
    const a = analyzeShipment(raw);
    if (a.delivered || a.returned) { skipped.deliveredOrReturned++; continue; }
    if (!a.atFinalOffice || !a.arrivedAtFinalOfficeMs) { skipped.notAtFinalOffice++; continue; }
    const days = (now - a.arrivedAtFinalOfficeMs) / DAY;
    if (days < MIN_DAYS_BACKLOG) { skipped.tooRecent++; continue; }
    const officeCase = a.deliveryType === "office";
    const doorCase = a.deliveryType === "door" && a.deliveryAttemptCount > 0;
    if (!officeCase && !doorCase) { skipped.doorNoFailedAttempt++; continue; }

    // Canary: with ?limit=N only the first N eligible are actually emailed; the
    // rest still appear in the list (sent:false) and keep reminder_sent_at NULL,
    // so a later unlimited run picks them up.
    let didSend = false;
    if (send && resend && (!limit || sent < limit)) {
      const d = toEmailData(o, awb, a.officeName);
      const html = doorCase ? buildReminderDoorEmail(d) : buildReminderOfficeEmail(d);
      const { error: e } = await resend.emails.send({ from: FROM, to: [o.email!], subject: shipmentSubjects.reminder(d.ref), html });
      if (!e) { await sb.from("orders").update({ reminder_sent_at: new Date(now).toISOString() }).eq("id", o.id); sent++; didSend = true; }
      else console.error("[Backlog] failed", o.id, e.message);
    }

    eligible.push({
      ref: o.order_ref ?? String(o.id),
      email: maskEmail(o.email!),
      office: a.officeName || "(няма име)",
      amount: `€${(Number(o.total ?? 0) || 0).toFixed(2)}`,
      tracking: awb,
      case: doorCase ? "door" : "office",
      daysAtOffice: Math.round(days * 10) / 10,
      sent: didSend,
    });
  }

  return NextResponse.json({
    ok: true,
    mode: send ? (limit ? `SENT (canary ${sent}/${limit})` : "SENT (all)") : "DRY-RUN",
    candidatesScanned: orders.length,
    eligibleCount: eligible.length,
    sent,
    skipped,
    list: eligible,
  });
}
