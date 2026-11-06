// Vercel Cron (every 30 min, 08:00–20:00 Europe/Sofia) — shipment notifications.
//   vercel.json schedules 05–18 UTC, which covers 08:00–20:00 Sofia in both
//   summer (UTC+3) and winter (UTC+2); runs outside that window in Sofia time
//   are skipped here, so no customer gets a shipment e-mail at night.
//   Email 1 (ship confirmation) — runs 7 days a week. Transactional; a paid,
//     waiting customer should get it even on Sat/Sun (also better for
//     deliverability than a Monday burst). Instant path is the "Обнови" action;
//     this cron picks up each parcel within 30 min of Econt accepting it.
//   Email 2 (single reminder)   — WEEKDAYS ONLY. If today is Sat/Sun it's
//     skipped and picked up on Monday.
// Idempotent via ship_email_sent_at / reminder_sent_at. Needs CRON_SECRET +
// SUPABASE_SERVICE_ROLE_KEY + RESEND_API_KEY.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendShipConfirmations, sendReminders, isWeekendSofia } from "@/lib/shipment-notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 08:00 up to and including 20:00, Europe/Sofia.
function inSofiaSendingHours(now = new Date()): boolean {
  const [h, m] = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Sofia", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .format(now).split(":").map(Number);
  const minutes = h * 60 + m;
  return minutes >= 8 * 60 && minutes <= 20 * 60;
}

export async function GET(req: NextRequest) {
  const cronSecret = (process.env.CRON_SECRET ?? "").trim();
  const auth = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!cronSecret || auth !== cronSecret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!inSofiaSendingHours()) return NextResponse.json({ ok: true, skipped: "outside 08:00-20:00 Europe/Sofia" });
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").replace(/\s/g, "");
  if (!url || !key) return NextResponse.json({ ok: false, error: "SUPABASE_SERVICE_ROLE_KEY not configured" }, { status: 500 });

  try {
    const sb = createClient(url, key, { auth: { persistSession: false } });

    // Email 1 — always (7 days a week).
    const ship = await sendShipConfirmations(sb);

    // Email 2 — weekdays only; deferred to Monday on Sat/Sun.
    const weekend = isWeekendSofia();
    const rem = weekend ? { sent: 0, scanned: 0 } : await sendReminders(sb);

    console.log("[ShipCron]", JSON.stringify({ shipped: ship.sent, reminders: rem.sent, weekend }));
    return NextResponse.json({ ok: true, shipped: ship.sent, shipScanned: ship.scanned, reminders: rem.sent, remScanned: rem.scanned, weekend });
  } catch (e) {
    console.error("[ShipCron] error:", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
