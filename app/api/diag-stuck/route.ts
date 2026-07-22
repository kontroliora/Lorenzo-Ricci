import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getRawStatuses } from "@/lib/econt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// TEMPORARY read-only check: orders the system still holds at 'shipped' while
// Econt already reports them delivered/returned. ZERO writes. Token-guarded.
const TOKEN = "stk7k2m9x";
const clean = (s: unknown) => String(s ?? "").replace(/\s+/g, "");
const NOW = Date.now();
const toISO = (n: unknown) => { const v = Number(n) || 0; return v ? new Date(v < 1e12 ? v * 1000 : v).toISOString() : null; };
const RETURN_EVENTS = new Set(["returned_to_sender", "is_returning_to_sender"]);

type Ev = { destinationType?: string };
type Raw = { shortDeliveryStatus?: string | null; deliveryTime?: number | null; cdCollectedTime?: number | null; trackingEvents?: Ev[] };

// exact replica of rawVerdict() in lib/econt.ts:182
function verdict(raw: Raw): string {
  const bg = String(raw.shortDeliveryStatus ?? "").toLowerCase();
  const events = Array.isArray(raw.trackingEvents) ? raw.trackingEvents : [];
  const lastType = events.length ? events[events.length - 1]?.destinationType : null;
  if (bg.includes("върната") || RETURN_EVENTS.has(lastType ?? "")) return "returned";
  if (raw.deliveryTime != null || raw.cdCollectedTime != null || bg === "доставена" || lastType === "client") return "delivered";
  if (raw.shortDeliveryStatus) return "in_transit";
  return "unknown";
}

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("k") !== TOKEN) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = supabaseAdmin();

  const od = await sb
    .from("orders")
    .select("id, order_ref, name, total, tracking_number, shipped_at, ship_email_sent_at, created_at, excluded_from_stock")
    .eq("status", "shipped");
  if (od.error) return NextResponse.json({ error: od.error.message }, { status: 500 });
  type O = { id: number; order_ref: string | null; name: string | null; total: number | null; tracking_number: string | null; shipped_at: string | null; ship_email_sent_at: string | null; created_at: string; excluded_from_stock: boolean };
  const orders = ((od.data ?? []) as O[]).filter((o) => !o.excluded_from_stock);

  const withTrack = orders.filter((o) => o.tracking_number);
  const raws = await getRawStatuses(withTrack.map((o) => o.tracking_number as string));

  const rows = orders.map((o) => {
    const raw = o.tracking_number ? (raws.get(clean(o.tracking_number)) as Raw | undefined) : undefined;
    if (!raw) {
      return { ref: o.order_ref, name: (o.name ?? "").split(" ")[0], tracking: o.tracking_number, systemStatus: "shipped", econt: "(НЯМА отговор от Econt)", verdict: "unknown", deliveredAt: null, hoursSinceDelivery: null, cronWouldClose: false };
    }
    const v = verdict(raw);
    const dMs = Number(raw.deliveryTime ?? raw.cdCollectedTime ?? 0) || 0;
    const dIso = toISO(dMs);
    return {
      ref: o.order_ref,
      name: (o.name ?? "").split(" ")[0],
      tracking: o.tracking_number,
      systemStatus: "shipped",
      econt: raw.shortDeliveryStatus ?? null,
      verdict: v,
      deliveredAt: dIso,
      hoursSinceDelivery: dMs ? Math.round((NOW - (dMs < 1e12 ? dMs * 1000 : dMs)) / 3.6e5) : null,
      cronWouldClose: v === "delivered" || v === "returned",
    };
  });

  const mismatched = rows.filter((r) => r.cronWouldClose);
  const noEcont = rows.filter((r) => r.verdict === "unknown");
  return NextResponse.json({
    shippedTotal: orders.length,
    withoutTracking: orders.length - withTrack.length,
    mismatchCount: mismatched.length,
    noEcontResponse: noEcont.length,
    MISMATCHED_shippedButFinished: mismatched,
    allShipped: rows,
  });
}
