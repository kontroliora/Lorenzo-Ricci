import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getRawStatuses, analyzeShipment } from "@/lib/econt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// TEMPORARY — show what the NEW Email-1 gate decides for every shipped parcel:
// send only while genuinely in transit (accepted, not returning/delivered, not
// yet at the final office). Order refs + first name only. Token-guarded; remove.
const TOKEN = "gt5m2k8x";
const clean = (s: unknown) => String(s ?? "").replace(/\s+/g, "");

type Row = { order_ref: string | null; name: string | null; tracking_number: string | null; email: string | null; ship_email_sent_at: string | null; excluded_from_stock: boolean; status: string };
type Gate = { send: boolean; reason: string };

function gate(a: ReturnType<typeof analyzeShipment>): Gate {
  if (!a.accepted) return { send: false, reason: "не е поета (sendTime null)" };
  if (a.returning) return { send: false, reason: "връща се към подател" };
  if (a.delivered) return { send: false, reason: "доставена" };
  if (a.arrivedAtFinalOfficeMs != null) return { send: false, reason: "вече в крайния офис (→ имейл 2)" };
  return { send: true, reason: "в транзит" };
}

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("k") !== TOKEN) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("orders")
    .select("order_ref, name, tracking_number, email, ship_email_sent_at, excluded_from_stock, status")
    .eq("status", "shipped")
    .not("tracking_number", "is", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = ((data ?? []) as Row[]).filter((r) => !r.excluded_from_stock);

  const statuses = await getRawStatuses(rows.map((r) => clean(r.tracking_number)));
  const reasonCounts: Record<string, number> = {};
  const pendingQueue: { ref: string | null; name: string; decision: string; reason: string }[] = [];

  for (const o of rows) {
    const raw = statuses.get(clean(o.tracking_number));
    if (!raw) { reasonCounts["няма Econt статус"] = (reasonCounts["няма Econt статус"] ?? 0) + 1; continue; }
    const g = gate(analyzeShipment(raw));
    const key = `${g.send ? "SEND" : "SKIP"} · ${g.reason}`;
    reasonCounts[key] = (reasonCounts[key] ?? 0) + 1;
    // The set the gate actually processes next run: not yet emailed + has email.
    if (!o.ship_email_sent_at && o.email) {
      pendingQueue.push({ ref: o.order_ref, name: (o.name || "").split(" ")[0], decision: g.send ? "ЩЕ ПРАТИ" : "ПРОПУСКА", reason: g.reason });
    }
  }

  return NextResponse.json({
    shippedWithTracking: rows.length,
    // Every shipped parcel, by what the new gate would decide:
    newGateDistribution: reasonCounts,
    // What actually happens on the next cron/scan (ship_email_sent_at still null):
    pendingQueueCount: pendingQueue.length,
    pendingQueue,
  });
}
