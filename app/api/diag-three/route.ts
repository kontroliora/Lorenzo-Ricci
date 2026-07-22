import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getRawStatuses } from "@/lib/econt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// TEMPORARY read-only. ZERO writes.
//  A) raw Econt for 5300779561555 (receiver/phone/COD) — rule the match theories in/out
//  B) raw events for 1080116328358 — the exact return-to-sender event + its code
//  C) every 'shipped' order re-checked with the BROAD return test (any return
//     event in history), which is what the cron currently does NOT do
const TOKEN = "thr7k2m9x";
const A_AWB = "5300779561555";
const B_AWB = "1080116328358";
const clean = (s: unknown) => String(s ?? "").replace(/\s+/g, "");
const toISO = (n: unknown) => { const v = Number(n) || 0; return v ? new Date(v < 1e12 ? v * 1000 : v).toISOString() : null; };
const RETURN_EVENTS = new Set(["returned_to_sender", "is_returning_to_sender"]);
const normPhone = (p: string) => { let d = (p || "").replace(/\D/g, ""); if (d.startsWith("359")) d = d.slice(3); if (d.startsWith("0")) d = d.slice(1); return d; };

type Ev = { destinationType?: string; officeName?: string; officeCode?: string | null; time?: number; detail?: string };
type Raw = {
  shortDeliveryStatus?: string | null; deliveryTime?: number | null; cdCollectedTime?: number | null;
  cdCollectedAmount?: number | null; cdPaidAmount?: number | null; trackingEvents?: Ev[];
  receiverClient?: { name?: string | null; phones?: string[] } | null; receiverAddress?: unknown;
  senderClient?: { name?: string | null } | null; sendTime?: number | null; services?: unknown;
};

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("k") !== TOKEN) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = supabaseAdmin();

  const raws = await getRawStatuses([A_AWB, B_AWB]);
  const a = raws.get(A_AWB) as Raw | undefined;
  const b = raws.get(B_AWB) as Raw | undefined;

  // ── A) the un-matched parcel ──
  const ord = await sb.from("orders").select("order_ref, name, phone, total, status, tracking_number, created_at").eq("order_ref", "LR-NHX715").single();
  const o = ord.data as { phone: string; total: number } | null;
  const aPhones = a?.receiverClient?.phones ?? [];
  const sectionA = {
    order: ord.data,
    orderPhoneNormalised: o ? normPhone(o.phone) : null,
    econt: a ? {
      shortDeliveryStatus: a.shortDeliveryStatus ?? null,
      senderClient: a.senderClient?.name ?? null,
      receiverName: a.receiverClient?.name ?? null,
      receiverPhones: aPhones,
      receiverPhonesNormalised: aPhones.map(normPhone),
      receiverAddress: a.receiverAddress ?? null,
      cdCollectedAmount: a.cdCollectedAmount ?? null,
      cdPaidAmount: a.cdPaidAmount ?? null,
      sendTime: toISO(a.sendTime),
    } : "(no Econt response)",
    phoneMatches: o && aPhones.some((p) => normPhone(p) === normPhone(o.phone)),
  };

  // ── B) the returning parcel — exact event vocabulary ──
  const bEvents = (b?.trackingEvents ?? []).map((e) => ({ destinationType: e?.destinationType ?? null, detail: e?.detail ?? null, office: e?.officeName ?? null, time: toISO(e?.time) }));
  const bReturnEvents = bEvents.filter((e) => RETURN_EVENTS.has(e.destinationType ?? ""));
  const bLast = bEvents[bEvents.length - 1] ?? null;
  const sectionB = {
    shortDeliveryStatus: b?.shortDeliveryStatus ?? null,
    textContainsVarnata: String(b?.shortDeliveryStatus ?? "").toLowerCase().includes("върната"),
    lastEventType: bLast?.destinationType ?? null,
    lastEventIsReturnEvent: RETURN_EVENTS.has(bLast?.destinationType ?? ""),
    returnEventsInHistory: bReturnEvents,
    narrowTest_currentCron: String(b?.shortDeliveryStatus ?? "").toLowerCase().includes("върната") || RETURN_EVENTS.has(bLast?.destinationType ?? ""),
    broadTest_analyzeShipmentReturning: (b?.trackingEvents ?? []).some((e) => RETURN_EVENTS.has(e?.destinationType ?? "")),
    allEvents: bEvents,
  };

  // ── C) every shipped order under the BROAD test ──
  const od = await sb.from("orders").select("order_ref, name, tracking_number, excluded_from_stock").eq("status", "shipped");
  type O = { order_ref: string | null; name: string | null; tracking_number: string | null; excluded_from_stock: boolean };
  const orders = ((od.data ?? []) as O[]).filter((x) => !x.excluded_from_stock && x.tracking_number);
  const allRaw = await getRawStatuses(orders.map((x) => x.tracking_number as string));
  const stuck: unknown[] = [];
  for (const x of orders) {
    const r = allRaw.get(clean(x.tracking_number)) as Raw | undefined;
    if (!r) continue;
    const evs = r.trackingEvents ?? [];
    const last = evs[evs.length - 1]?.destinationType ?? null;
    const bg = String(r.shortDeliveryStatus ?? "").toLowerCase();
    const narrowReturned = bg.includes("върната") || RETURN_EVENTS.has(last ?? "");
    const broadReturning = narrowReturned || evs.some((e) => RETURN_EVENTS.has(e?.destinationType ?? ""));
    const delivered = r.deliveryTime != null || r.cdCollectedTime != null || bg === "доставена" || last === "client";
    if (broadReturning || delivered) {
      const retEv = evs.find((e) => RETURN_EVENTS.has(e?.destinationType ?? ""));
      stuck.push({
        ref: x.order_ref, name: (x.name ?? "").split(" ")[0], tracking: x.tracking_number,
        systemStatus: "shipped", econtStatus: r.shortDeliveryStatus ?? null,
        reallyDelivered: delivered, reallyReturning: broadReturning,
        returnStartedAt: toISO(retEv?.time), lastEventType: last,
        detectedByCurrentCron: narrowReturned || delivered,
      });
    }
  }

  return NextResponse.json({ A_matching: sectionA, B_returnEventCode: sectionB, C_stuckShipped: { shippedChecked: orders.length, found: stuck.length, rows: stuck } });
}
