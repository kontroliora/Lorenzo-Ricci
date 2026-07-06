// ⚠️ TEMPORARY DEBUG ROUTE — Econt connection probe (STEP 1).
// Runs server-side on Vercel so ECONT_USER/ECONT_PASS never leave the secrets
// store. Token-gated. DELETE this file after the one-time test.
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOKEN = "e7probe_Kx9zQ2wL8vRt5nJ";

const ENDPOINTS: Record<string, string> = {
  prod: "https://ee.econt.com/services/Shipments/ShipmentService.getShipmentStatuses.json",
  demo: "https://demo.econt.com/ee/services/Shipments/ShipmentService.getShipmentStatuses.json",
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("key") !== TOKEN) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const user = process.env.ECONT_USER ?? "";
  const pass = process.env.ECONT_PASS ?? "";
  const awb = (searchParams.get("awb") ?? "105138004477").replace(/\s+/g, "");
  const which = searchParams.get("env") === "demo" ? "demo" : "prod";
  const url = ENDPOINTS[which];

  const out: Record<string, unknown> = {
    marker: "econt-test-v1",
    // booleans + lengths only — never the secret values themselves
    credsPresent: { user: user.length > 0, pass: pass.length > 0, userLen: user.length, passLen: pass.length },
    endpoint: url,
    awb,
  };

  if (!user || !pass) {
    out.error = "Missing ECONT_USER or ECONT_PASS in environment";
    return NextResponse.json(out, { status: 200 });
  }

  const auth = "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
  const body = JSON.stringify({ shipmentNumbers: [awb] });

  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: auth },
      body,
      cache: "no-store",
    });
    const text = await r.text();
    out.httpStatus = r.status;
    try {
      out.econtResponse = JSON.parse(text);
    } catch {
      out.econtRawText = text.slice(0, 8000);
    }
  } catch (e) {
    out.error = String(e);
  }

  return NextResponse.json(out, { status: 200 });
}
