// ⚠️ TEMPORARY DEBUG ROUTE — Econt connection probe (STEP 1).
// Runs server-side on Vercel so ECONT_USER/ECONT_PASS never leave the secrets
// store. Token-gated. DELETE this file after the test.
//   ?method=getmyawb&from=YYYY-MM-DD&to=YYYY-MM-DD  → list my shipments
//   (default)                                        → getShipmentStatuses(awb)
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOKEN = "e7probe_Kx9zQ2wL8vRt5nJ";
const BASE = "https://ee.econt.com/services/Shipments/ShipmentService";

function authHeader(user: string, pass: string) {
  return "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
}

async function post(url: string, auth: string, payload: unknown) {
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: auth },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    const text = await r.text();
    let body: unknown;
    try { body = JSON.parse(text); } catch { body = text.slice(0, 6000); }
    return { httpStatus: r.status, body };
  } catch (e) {
    return { fetchError: String(e) };
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("key") !== TOKEN) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const user = process.env.ECONT_USER ?? "";
  const pass = process.env.ECONT_PASS ?? "";
  const out: Record<string, unknown> = {
    marker: "econt-test-v4",
    credsPresent: { user: user.length > 0, pass: pass.length > 0 },
  };
  if (!user || !pass) {
    out.error = "Missing ECONT_USER or ECONT_PASS";
    return NextResponse.json(out, { status: 200 });
  }
  const auth = authHeader(user, pass);

  // ── getMyAWB — list my shipments for a date range ─────────────────────────
  if (searchParams.get("method") === "getmyawb") {
    const dateFrom = searchParams.get("from") ?? "2026-07-01";
    const dateTo = searchParams.get("to") ?? "2026-07-08";
    const side = searchParams.get("side") ?? "sender";
    out.request = { method: "getMyAWB", dateFrom, dateTo, page: 1, side };
    out.result = await post(`${BASE}.getMyAWB.json`, auth, { dateFrom, dateTo, page: 1, side });
    return NextResponse.json(out, { status: 200 });
  }

  // ── default: getShipmentStatuses(awb) ─────────────────────────────────────
  const awb = (searchParams.get("awb") ?? "105138004477").replace(/\s+/g, "");
  out.request = { method: "getShipmentStatuses", awb };
  out.result = await post(`${BASE}.getShipmentStatuses.json`, auth, { shipmentNumbers: [awb] });
  return NextResponse.json(out, { status: 200 });
}
