import { NextResponse } from "next/server";
import { getMyAWB, getShipmentStatusesRaw } from "@/lib/econt";

// ── TEMPORARY debug endpoint (Stage 1 research only) ─────────────────────────
// Pulls recent shipments straight from Econt (getMyAWB), then returns the FULL
// raw getShipmentStatuses payload for a status-varied sample, so we can inspect
// every structured field. Read-only: no DB writes, no emails. Token-guarded.
// Delete once the discriminating fields are identified.
const TOKEN = "lr-econt-debug-8x2k";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (new URL(req.url).searchParams.get("token") !== TOKEN) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  if (!process.env.ECONT_USER || !process.env.ECONT_PASS) {
    return NextResponse.json({ ok: false, error: "ECONT_USER/ECONT_PASS not set" }, { status: 500 });
  }

  const now = Date.now();
  const day = (d: number) => new Date(d).toISOString().slice(0, 10);

  // Recent sender shipments — 45 days back covers fresh, transit, at-office,
  // delivered and the older backlog.
  const awbs = await getMyAWB(day(now - 45 * 86_400_000), day(now + 86_400_000), "sender");

  // Stage 1.5: ?awaiting=1 → only "generated tracking, not physically handed
  // over" shipments, to confirm sendTime is null / trackingEvents is empty.
  if (new URL(req.url).searchParams.get("awaiting") === "1") {
    const match = awbs.filter((a) => (a.status || "").includes("Очаква предаване"));
    const picked = match.slice(0, 5).map((a) => a.shipmentNumber);
    const raw = await getShipmentStatusesRaw(picked);
    return NextResponse.json({ ok: true, matchedFromMyAWB: match.slice(0, 5), sampledAwbCount: picked.length, raw });
  }

  // Group by Econt's own getMyAWB status, keep true counts, sample up to 2 per
  // distinct status so every status kind is represented without a huge payload.
  const byStatus = new Map<string, string[]>();
  for (const a of awbs) {
    const arr = byStatus.get(a.status) ?? [];
    arr.push(a.shipmentNumber);
    byStatus.set(a.status, arr);
  }
  const counts = Object.fromEntries([...byStatus].map(([s, arr]) => [s || "(празен)", arr.length]));
  const picked = [...byStatus.values()].flatMap((arr) => arr.slice(0, 2)).slice(0, 20);

  const raw = await getShipmentStatusesRaw(picked);

  return NextResponse.json({
    ok: true,
    totalRecentShipments: awbs.length,
    myAwbStatusCounts: counts,
    sampledAwbCount: picked.length,
    raw,
  });
}
