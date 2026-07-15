import { NextRequest, NextResponse } from "next/server";
import { computeRoasCore } from "@/lib/roas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// TEMPORARY — verify the ROAS computation against real data (aggregate only,
// no customer data). Wide window to capture all orders. Token-guarded; remove.
const TOKEN = "rv7k2m9x";

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("k") !== TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const start = "2026-01-01T00:00:00.000Z";
  const end = new Date().toISOString();
  const d = await computeRoasCore(start, end);
  // Prove the ROAS ratio math with a hypothetical €500 spend (real spend table
  // may not be migrated yet → d.spend is 0).
  const hypo = 500;
  return NextResponse.json({
    range: d.range,
    totalOrders: d.totalOrders,
    gross: d.gross,
    real: d.real,
    inMotion: d.inMotion,
    pending: d.pending,
    byStatus: d.byStatus,
    cancelled: d.cancelled,
    returned: d.returned,
    uncollected: d.uncollected,
    exaggerationPct: d.exaggerationPct,
    cancelRate: d.cancelRate,
    spendFromTable: d.spend,
    hypotheticalAt500: { metaRoas: Math.round((d.gross / hypo) * 100) / 100, realRoas: Math.round((d.real / hypo) * 100) / 100 },
  });
}
