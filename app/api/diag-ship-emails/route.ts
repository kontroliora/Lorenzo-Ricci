import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getRawStatuses, analyzeShipment } from "@/lib/econt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// TEMPORARY — find orders where Email 1 ("изпратена / на път към Вас") went out
// AFTER the parcel had already started returning to sender, or after it was
// delivered. Order refs + first name only. Token-guarded; remove after use.
const TOKEN = "se4m2k9x";

const clean = (s: unknown) => String(s ?? "").replace(/\s+/g, "");
const RETURN = new Set(["returned_to_sender", "is_returning_to_sender"]);
// Econt times are JS ms; guard in case any come back in seconds.
const toMs = (n: unknown) => { const v = Number(n) || 0; return v > 0 && v < 1e12 ? v * 1000 : v; };

type Row = { order_ref: string | null; name: string | null; status: string; tracking_number: string | null; ship_email_sent_at: string; excluded_from_stock: boolean };
type Ev = { destinationType?: string; time?: number | string };
type Raw = { trackingEvents?: Ev[]; deliveryTime?: number | string | null; cdCollectedTime?: number | string | null };

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("k") !== TOKEN) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = supabaseAdmin();

  // Single-order deep look: timing + live analysis + whether the new guard blocks it.
  const ref = req.nextUrl.searchParams.get("ref");
  if (ref) {
    const { data: o } = await sb.from("orders").select("order_ref, name, status, tracking_number, ship_email_sent_at").eq("order_ref", ref).single();
    if (!o) return NextResponse.json({ error: "not found" }, { status: 404 });
    const raw = (await getRawStatuses([clean(o.tracking_number)])).get(clean(o.tracking_number)) as Raw | undefined;
    const a = raw ? analyzeShipment(raw) : null;
    const events = raw && Array.isArray(raw.trackingEvents) ? raw.trackingEvents : [];
    const rt = events.filter((e) => RETURN.has(e?.destinationType ?? "")).map((e) => toMs(e?.time)).filter(Boolean);
    const returnStartMs = rt.length ? Math.min(...rt) : null;
    const deliveredMs = raw?.deliveryTime ? toMs(raw.deliveryTime) : raw?.cdCollectedTime ? toMs(raw.cdCollectedTime) : null;
    return NextResponse.json({
      ref: o.order_ref,
      status: o.status,
      tracking: o.tracking_number,
      ship_email_sent_at: o.ship_email_sent_at,
      hasEcontStatus: !!raw,
      returnStart: returnStartMs != null ? new Date(returnStartMs).toISOString() : null,
      delivered: deliveredMs != null ? new Date(deliveredMs).toISOString() : null,
      analysis: a,
      guardWouldBlockNow: a ? a.returning || a.delivered : null,
    });
  }

  const { data, error } = await sb
    .from("orders")
    .select("order_ref, name, status, tracking_number, ship_email_sent_at, excluded_from_stock")
    .not("ship_email_sent_at", "is", null)
    .not("tracking_number", "is", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = ((data ?? []) as Row[]).filter((r) => !r.excluded_from_stock);

  const statuses = await getRawStatuses(rows.map((r) => clean(r.tracking_number)));
  type Bad = { ref: string | null; name: string; status: string; kind: string; sentAt: string; returnStart: string | null; delivered: string | null; hoursAfter: number };
  const bad: Bad[] = [];
  let withStatus = 0;

  for (const o of rows) {
    const raw = statuses.get(clean(o.tracking_number)) as Raw | undefined;
    if (!raw) continue;
    withStatus++;
    const events = Array.isArray(raw.trackingEvents) ? raw.trackingEvents : [];
    const returnTimes = events.filter((e) => RETURN.has(e?.destinationType ?? "")).map((e) => toMs(e?.time)).filter(Boolean);
    const returnStartMs = returnTimes.length ? Math.min(...returnTimes) : null;
    const deliveredMs = raw.deliveryTime ? toMs(raw.deliveryTime) : raw.cdCollectedTime ? toMs(raw.cdCollectedTime) : null;
    const sentMs = Date.parse(o.ship_email_sent_at);
    const afterReturn = returnStartMs != null && sentMs > returnStartMs;
    const afterDelivered = deliveredMs != null && sentMs > deliveredMs;
    if (afterReturn || afterDelivered) {
      bad.push({
        ref: o.order_ref,
        name: (o.name || "").split(" ")[0],
        status: o.status,
        kind: afterReturn ? "СЛЕД ВРЪЩАНЕ" : "след доставка",
        sentAt: o.ship_email_sent_at,
        returnStart: returnStartMs != null ? new Date(returnStartMs).toISOString() : null,
        delivered: deliveredMs != null ? new Date(deliveredMs).toISOString() : null,
        hoursAfter: afterReturn ? Math.round((sentMs - (returnStartMs as number)) / 3.6e6) : Math.round((sentMs - (deliveredMs as number)) / 3.6e6),
      });
    }
  }
  bad.sort((a, b) => (a.kind === b.kind ? b.hoursAfter - a.hoursAfter : a.kind === "СЛЕД ВРЪЩАНЕ" ? -1 : 1));

  return NextResponse.json({
    emailedOrders: rows.length,
    withEcontStatus: withStatus,
    badCount: bad.length,
    afterReturn: bad.filter((b) => b.kind === "СЛЕД ВРЪЩАНЕ").length,
    afterDelivered: bad.filter((b) => b.kind === "след доставка").length,
    bad,
  });
}
