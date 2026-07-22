import { NextRequest, NextResponse } from "next/server";
import { getRawStatuses } from "@/lib/econt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// TEMPORARY read-only investigation of the Econt account itself: which login is
// configured, which client profiles/numbers it owns, what getMyAWB actually
// returns (raw), and how the 5300… parcel's sender block compares to a 1080… one.
// Shows the USERNAME only — never the password. Token-guarded; remove after use.
const TOKEN = "acct7k2m9x";
const SHIP = "https://ee.econt.com/services/Shipments/ShipmentService";
const PROFILE = "https://ee.econt.com/services/Profile/ProfileService";
const A_AWB = "5300779561555"; // the one that never matches
const B_AWB = "1080116328358"; // a known-good shop parcel

const auth = () => "Basic " + Buffer.from(`${process.env.ECONT_USER ?? ""}:${process.env.ECONT_PASS ?? ""}`).toString("base64");
const post = async (url: string, body: unknown) => {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: auth() }, body: JSON.stringify(body), cache: "no-store" });
  const text = await r.text();
  try { return { status: r.status, json: JSON.parse(text) as Record<string, unknown> }; }
  catch { return { status: r.status, raw: text.slice(0, 400) }; }
};
const day = (d: number) => new Date(d).toISOString().slice(0, 10);

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("k") !== TOKEN) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const now = Date.now();

  // 1) which login is configured (username only)
  const configured = { ECONT_USER: process.env.ECONT_USER ?? "(not set)", ECONT_PASS_set: !!process.env.ECONT_PASS };

  // 2) the account's client profiles / client numbers
  const profiles = await post(`${PROFILE}.getClientProfiles.json`, {});

  // 3) raw getMyAWB — every field of the first row + the full series census
  const from = day(now - 60 * 86_400_000), to = day(now + 86_400_000);
  const firstPage = await post(`${SHIP}.getMyAWB.json`, { dateFrom: from, dateTo: to, page: 1, side: "sender" });
  const fp = firstPage.json as { results?: Array<Record<string, unknown>>; totalPages?: number } | undefined;
  const sampleRow = fp?.results?.[0] ?? null;

  const seriesCount: Record<string, number> = {};
  const clientNumbers: Record<string, number> = {};
  let total = 0; let foundTarget: Record<string, unknown> | null = null;
  for (let page = 1; page <= 20; page++) {
    const r = await post(`${SHIP}.getMyAWB.json`, { dateFrom: from, dateTo: to, page, side: "sender" });
    const d = r.json as { results?: Array<Record<string, unknown>>; totalPages?: number } | undefined;
    for (const x of d?.results ?? []) {
      total++;
      const n = String(x.shipmentNumber ?? "");
      seriesCount[n.slice(0, 4)] = (seriesCount[n.slice(0, 4)] ?? 0) + 1;
      const cn = String((x.senderClientNumber ?? x.clientNumber ?? x.senderClient ?? "") || "—");
      clientNumbers[cn] = (clientNumbers[cn] ?? 0) + 1;
      if (n === A_AWB) foundTarget = x;
    }
    if (page >= (d?.totalPages ?? 1)) break;
  }

  // 4) sender block of the two parcels, straight from tracking
  const raws = await getRawStatuses([A_AWB, B_AWB]);
  const senderOf = (awb: string) => {
    const r = raws.get(awb) as {
      senderClient?: Record<string, unknown> | null; senderAgent?: Record<string, unknown> | null;
      senderOfficeCode?: unknown; senderAddress?: Record<string, unknown> | null;
      senderDeliveryType?: unknown; shipmentType?: unknown; services?: unknown; createdTime?: number | null;
    } | undefined;
    const s = r?.senderClient ?? null;
    const ag = r?.senderAgent ?? null;
    return {
      client: s ? { name: s.name ?? null, clientNumber: s.clientNumber ?? null, ein: s.ein ?? null, id: s.id ?? null } : null,
      // who/where actually booked it — the lead for tracing an off-account parcel
      agent: ag ? { name: ag.name ?? null, id: ag.id ?? null } : null,
      senderOfficeCode: r?.senderOfficeCode ?? null,
      senderDeliveryType: r?.senderDeliveryType ?? null,
      senderCity: (r?.senderAddress as { city?: { name?: string } } | null)?.city?.name ?? null,
      shipmentType: r?.shipmentType ?? null,
    };
  };

  return NextResponse.json({
    configuredLogin: configured,
    clientProfiles: profiles.status === 200 ? profiles.json : profiles,
    getMyAWB: {
      window: `${from} → ${to}`,
      side: "sender",
      totalShipments: total,
      seriesCensus: seriesCount,
      senderClientNumberCensus: clientNumbers,
      targetFoundInList: !!foundTarget,
      targetRow: foundTarget,
      allFieldsOfOneRow: sampleRow,
    },
    senderComparison: { [`${A_AWB} (unmatched)`]: senderOf(A_AWB), [`${B_AWB} (shop parcel)`]: senderOf(B_AWB) },
  });
}
