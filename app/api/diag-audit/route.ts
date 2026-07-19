import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getRawStatuses } from "@/lib/econt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// TEMPORARY read-only pipeline audit. Zero writes. Aggregates + a few masked
// examples. Token-guarded; remove after use.
const TOKEN = "aud7k2m9x";
const clean = (s: unknown) => String(s ?? "").replace(/\s+/g, "");
const mask = (e: string | null) => {
  const [u, d] = String(e ?? "").split("@");
  if (!u || !d) return "—";
  return `${u[0]}${"*".repeat(Math.max(1, Math.min(u.length - 2, 4)))}${u.length > 1 ? u[u.length - 1] : ""}@${d}`;
};
const NOW = Date.now();
const toMs = (iso: unknown) => (iso ? Date.parse(String(iso)) : NaN);

type O = {
  id: number; order_ref: string | null; status: string; tracking_number: string | null; email: string | null;
  ship_email_sent_at: string | null; reminder_sent_at: string | null; shipped_at: string | null;
  completed_at: string | null; returning_at: string | null; restocked_at: string | null; restocked_source: string | null;
  created_at: string; excluded_from_stock: boolean; items: unknown; total: number | null; is_manual: boolean | null;
};
type C = {
  session_id: string; email: string | null; phone: string | null; status: string; recovery_consent: boolean | null;
  recovery_sent_at: string | null; converted_at: string | null; updated_at: string | null; created_at: string | null; items: unknown;
};

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("k") !== TOKEN) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = supabaseAdmin();

  const od = await sb.from("orders").select(
    "id, order_ref, status, tracking_number, email, ship_email_sent_at, reminder_sent_at, shipped_at, completed_at, returning_at, restocked_at, restocked_source, created_at, excluded_from_stock, items, total, is_manual",
  );
  if (od.error) return NextResponse.json({ error: "orders: " + od.error.message }, { status: 500 });
  const allOrders = (od.data ?? []) as O[];
  const orders = allOrders.filter((o) => !o.excluded_from_stock);
  const excluded = allOrders.length - orders.length;
  const nEmpty = (v: string | null) => v == null || v === "";
  const hasTrack = (o: O) => !nEmpty(o.tracking_number);
  const DISPATCHED = new Set(["shipped", "completed", "returning", "restocked", "returned"]);
  const itemsOf = (x: unknown) => (Array.isArray(x) ? x : []);

  // ── status counts ──
  const byStatus: Record<string, number> = {};
  for (const o of orders) byStatus[o.status] = (byStatus[o.status] ?? 0) + 1;

  // ── SECTION 1: tracking ──
  const dispatchedNoTrack = orders.filter((o) => DISPATCHED.has(o.status) && !hasTrack(o)).map((o) => ({ ref: o.order_ref, status: o.status }));
  const trackMap: Record<string, string[]> = {};
  for (const o of orders) { if (hasTrack(o)) (trackMap[clean(o.tracking_number)] ??= []).push(o.order_ref ?? String(o.id)); }
  const dupTracking = Object.entries(trackMap).filter(([, refs]) => refs.length > 1).map(([awb, refs]) => ({ awb, refs }));
  const shippedNoTrack = orders.filter((o) => o.status === "shipped" && !hasTrack(o)).length;

  // real examples: 3 orders (shipped/returning) + their live Econt status
  const sample = orders.filter((o) => (o.status === "shipped" || o.status === "returning") && hasTrack(o)).slice(0, 3);
  const rawMap = await getRawStatuses(sample.map((o) => o.tracking_number as string));
  const examples = sample.map((o) => {
    const raw = rawMap.get(clean(o.tracking_number)) as { shortDeliveryStatus?: string | null } | undefined;
    return { ref: o.order_ref, status: o.status, tracking: o.tracking_number, econtStatus: raw?.shortDeliveryStatus ?? "(няма отговор)" };
  });

  // ── SECTION 2: emails ──
  const shippedNoEmailFlag = orders.filter((o) => o.status === "shipped" && nEmpty(o.ship_email_sent_at)).map((o) => ({ ref: o.order_ref, hasTrack: hasTrack(o), email: !nEmpty(o.email) }));
  const shipFlagButNoEmail = orders.filter((o) => !nEmpty(o.ship_email_sent_at) && nEmpty(o.email)).map((o) => o.order_ref);
  const shipFlagButNotDispatched = orders.filter((o) => !nEmpty(o.ship_email_sent_at) && (o.status === "new" || o.status === "confirmed")).map((o) => ({ ref: o.order_ref, status: o.status }));
  const shipEmailCount = orders.filter((o) => !nEmpty(o.ship_email_sent_at)).length;
  const reminderCount = orders.filter((o) => !nEmpty(o.reminder_sent_at)).length;
  // "email log" = the real DB record of sends, most recent first
  const emailLog = orders
    .flatMap((o) => [
      !nEmpty(o.ship_email_sent_at) ? { ref: o.order_ref, type: "shipped", to: mask(o.email), at: o.ship_email_sent_at } : null,
      !nEmpty(o.reminder_sent_at) ? { ref: o.order_ref, type: "reminder", to: mask(o.email), at: o.reminder_sent_at } : null,
    ])
    .filter(Boolean)
    .sort((a, b) => toMs((b as { at: string }).at) - toMs((a as { at: string }).at))
    .slice(0, 10);

  // ── SECTION 3: abandoned carts ──
  const cs = await sb.from("cart_sessions").select("session_id, email, phone, status, recovery_consent, recovery_sent_at, converted_at, updated_at, created_at, items");
  const carts = (cs.data ?? []) as C[];
  const cartByStatus: Record<string, number> = {};
  for (const c of carts) cartByStatus[c.status] = (cartByStatus[c.status] ?? 0) + 1;
  const withEmail = carts.filter((c) => !nEmpty(c.email));
  const consentTrue = withEmail.filter((c) => c.recovery_consent === true).length;
  const consentFalse = withEmail.filter((c) => c.recovery_consent === false).length;
  const consentNull = withEmail.filter((c) => c.recovery_consent == null).length;
  const alreadyEmailed = carts.filter((c) => !nEmpty(c.recovery_sent_at)).length;
  // replicate the cron's exact eligibility (pending, consent!=false, not sent, 1h–7d, email, non-empty)
  const idle = NOW - 60 * 60 * 1000, age = NOW - 7 * 24 * 60 * 60 * 1000;
  const eligible = carts.filter((c) =>
    c.status === "pending" && c.recovery_consent !== false && nEmpty(c.recovery_sent_at) && !nEmpty(c.email) &&
    itemsOf(c.items).length > 0 && toMs(c.updated_at) < idle && toMs(c.updated_at) > age,
  );
  const eligibleOptOuts = eligible.filter((c) => c.recovery_consent === false).length; // must be 0
  const pendingOptOuts = carts.filter((c) => c.status === "pending" && c.recovery_consent === false).length;
  // race: emailed AFTER the cart converted (bad)
  const emailedAfterConvert = carts.filter((c) => !nEmpty(c.recovery_sent_at) && !nEmpty(c.converted_at) && toMs(c.recovery_sent_at) > toMs(c.converted_at)).map((c) => ({ email: mask(c.email), sent: c.recovery_sent_at, converted: c.converted_at }));

  // ── SECTION 4: consistency ──
  const completedNoTrack = orders.filter((o) => o.status === "completed" && !hasTrack(o)).map((o) => ({ ref: o.order_ref, manual: !!o.is_manual }));
  const returnNoTrack = orders.filter((o) => (o.status === "returning" || o.status === "restocked" || o.status === "returned") && !hasTrack(o)).map((o) => ({ ref: o.order_ref, status: o.status }));
  const futureStamp = orders.filter((o) => toMs(o.shipped_at) > NOW || toMs(o.restocked_at) > NOW || toMs(o.completed_at) > NOW).map((o) => ({ ref: o.order_ref, shipped_at: o.shipped_at, completed_at: o.completed_at, restocked_at: o.restocked_at }));
  const restockedNoStamp = orders.filter((o) => o.status === "restocked" && nEmpty(o.restocked_at)).map((o) => o.order_ref);
  const stampNoRestocked = orders.filter((o) => !nEmpty(o.restocked_at) && o.status !== "restocked").map((o) => ({ ref: o.order_ref, status: o.status }));
  const statusSum = Object.values(byStatus).reduce((a, b) => a + b, 0);
  // orphan-ish: converted carts whose email matches no order
  const orderEmails = new Set(orders.map((o) => String(o.email ?? "").trim().toLowerCase()).filter(Boolean));
  const convertedNoOrder = carts.filter((c) => c.status === "converted" && !nEmpty(c.email) && !orderEmails.has(String(c.email).trim().toLowerCase())).map((c) => mask(c.email));

  return NextResponse.json({
    totals: { ordersReal: orders.length, excludedTestFake: excluded, byStatus, statusSumEqualsTotal: statusSum === orders.length },
    section1_tracking: {
      dispatchedWithoutTracking: dispatchedNoTrack,   // ⚠ if non-empty
      shippedWithoutTracking: shippedNoTrack,          // ⚠ if > 0
      duplicateTrackingNumbers: dupTracking,           // ⚠ if non-empty
      cronMatchKey: "Econt raw matched by tracking number; DB row updated by order id (.eq('id')). Safe unless duplicate trackings.",
      liveExamples: examples,
    },
    section2_emails: {
      inventory: [
        "1. Order confirmation (customer) — /api/order sendCustomerEmail, on placement (status new)",
        "2. Admin new-order notify — /api/order sendAdminEmail (+ TEMP protataotos@gmail.com until 2026-07-21)",
        "3. Email 1 'shipped' — lib/shipment-notify.ts:79, dedup ship_email_sent_at",
        "4. Email 2 'reminder' — lib/shipment-notify.ts:114, dedup reminder_sent_at",
        "5. Abandoned cart — cron/abandoned-cart:68, dedup recovery_sent_at",
        "6. Review notify (admin) — /api/review:29",
        "7. (dead) admin/cart-abandonment:309 — unwired, anon RLS blocks",
      ],
      shipEmailsSent: shipEmailCount,
      remindersSent: reminderCount,
      shippedStatusMissingShipFlag: shippedNoEmailFlag, // may be legit (gate skips returning/delivered/at-office)
      shipFlagButNoEmailAddress: shipFlagButNoEmail,    // ⚠ if non-empty
      shipFlagButStatusNewOrConfirmed: shipFlagButNotDispatched, // ⚠ if non-empty
      recentEmailLog: emailLog,
      addressSource: "shipment emails send to orders.email (shipment-notify SELECT); NOT cart_sessions.",
    },
    section3_abandoned: {
      cartTotals: { total: carts.length, byStatus: cartByStatus, withEmail: withEmail.length },
      consent: { true: consentTrue, null: consentNull, false_optOut: consentFalse },
      pendingOptOuts, alreadyEmailed,
      cronEligibleNow: eligible.length,
      eligibleOptOuts_mustBeZero: eligibleOptOuts,
      emailedAfterConvert,   // ⚠ if non-empty (race)
    },
    section4_consistency: {
      completedWithoutTracking: completedNoTrack,     // ⚠ if non-empty
      returnWithoutTracking: returnNoTrack,           // ⚠ if non-empty
      futureTimestamps: futureStamp,                  // ⚠ if non-empty
      restockedWithoutTimestamp: restockedNoStamp,    // ⚠ if non-empty
      restockedTimestampButWrongStatus: stampNoRestocked, // ⚠ if non-empty
      convertedCartWithNoMatchingOrder: convertedNoOrder, // soft
    },
  });
}
