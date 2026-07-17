import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getRawStatuses } from "@/lib/econt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// TEMPORARY recon — dump the REAL Econt tracking data for returned orders so we
// can see the exact signal for "parcel received back by the sender (us)". No
// customer PII beyond order_ref. Token-guarded; remove after use.
const TOKEN = "rr8k2m3x";
const clean = (s: unknown) => String(s ?? "").replace(/\s+/g, "");
const toISO = (n: unknown) => {
  const v = Number(n) || 0;
  if (!v) return null;
  return new Date(v < 1e12 ? v * 1000 : v).toISOString();
};

type Ev = { destinationType?: string; officeCode?: string | null; time?: number; officeName?: string };
type Raw = {
  shortDeliveryStatus?: string | null;
  shortDeliveryStatusEn?: string | null;
  deliveryTime?: number | null;
  cdCollectedTime?: number | null;
  receiverName?: string | null;
  receiverOfficeCode?: string | number | null;
  trackingEvents?: Ev[];
};

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("k") !== TOKEN) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("orders")
    .select("order_ref, tracking_number, status, return_kind")
    .eq("status", "returned")
    .not("tracking_number", "is", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = (data ?? []) as { order_ref: string | null; tracking_number: string; status: string; return_kind: string | null }[];
  if (!rows.length) return NextResponse.json({ note: "no returned orders with tracking", count: 0 });

  const rawMap = await getRawStatuses(rows.map((r) => r.tracking_number));

  // Aggregate the distinct destinationType values across ALL returns' events,
  // so we can see the full vocabulary Econt uses (esp. the return leg).
  const allDestTypes: Record<string, number> = {};

  const out = rows.map((r) => {
    const raw = rawMap.get(clean(r.tracking_number)) as Raw | undefined;
    if (!raw) return { ref: r.order_ref, tracking: r.tracking_number, hasStatus: false };
    const events = Array.isArray(raw.trackingEvents) ? raw.trackingEvents : [];
    for (const e of events) allDestTypes[e?.destinationType ?? "?"] = (allDestTypes[e?.destinationType ?? "?"] ?? 0) + 1;
    const last = events[events.length - 1];
    return {
      ref: r.order_ref,
      return_kind: r.return_kind,
      shortDeliveryStatus: raw.shortDeliveryStatus ?? null,
      shortDeliveryStatusEn: raw.shortDeliveryStatusEn ?? null,
      deliveryTime: toISO(raw.deliveryTime),
      cdCollectedTime: toISO(raw.cdCollectedTime),
      receiverName: raw.receiverName ?? null,
      receiverOfficeCode: raw.receiverOfficeCode ?? null,
      lastEvent: last ? { type: last.destinationType, office: last.officeName, officeCode: last.officeCode, time: toISO(last.time) } : null,
      events: events.map((e) => ({ type: e?.destinationType, office: e?.officeName, officeCode: e?.officeCode, time: toISO(e?.time) })),
    };
  });

  return NextResponse.json({ count: rows.length, destinationTypeVocabulary: allDestTypes, returns: out });
}
