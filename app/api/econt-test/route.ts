// ⚠️ TEMPORARY DEBUG ROUTE — Econt connection probe (STEP 1).
// Runs server-side on Vercel so ECONT_USER/ECONT_PASS never leave the secrets
// store. Token-gated. Runs the real creds AND a wrong-password control so we can
// tell whether auth is actually enforced/accepted. DELETE after the test.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOKEN = "e7probe_Kx9zQ2wL8vRt5nJ";

const ENDPOINTS: Record<string, string> = {
  prod: "https://ee.econt.com/services/Shipments/ShipmentService.getShipmentStatuses.json",
  demo: "https://demo.econt.com/ee/services/Shipments/ShipmentService.getShipmentStatuses.json",
};

async function callEcont(endpoint: string, user: string, pass: string, awb: string) {
  const auth = "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
  try {
    const r = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: auth },
      body: JSON.stringify({ shipmentNumbers: [awb] }),
      cache: "no-store",
    });
    const text = await r.text();
    let body: unknown;
    try { body = JSON.parse(text); } catch { body = text.slice(0, 4000); }
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

  const out: Record<string, unknown> = { marker: "econt-test-v3" };

  // ── 1. Try to find a REAL tracking number from a shipped order ────────────
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE ?? "";
  const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const dbKey = serviceKey || anonKey;

  const db: Record<string, unknown> = {
    hasServiceKey: serviceKey.length > 0,
    hasAnonKey: anonKey.length > 0,
    usedKey: serviceKey ? "service_role" : anonKey ? "anon" : "none",
  };

  let dbTracking: string[] = [];
  if (url && dbKey) {
    try {
      const sb = createClient(url, dbKey, { auth: { persistSession: false } });
      const { data, error } = await sb
        .from("orders")
        .select("id, name, tracking_number, status, created_at")
        .not("tracking_number", "is", null)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) db.error = error.message;
      else {
        db.rows = data;
        dbTracking = (data ?? [])
          .map((r) => String((r as { tracking_number: unknown }).tracking_number).replace(/\s+/g, ""))
          .filter(Boolean);
      }
    } catch (e) {
      db.exception = String(e);
    }
  }
  out.db = db;

  // ── 2. Econt getShipmentStatuses: real creds vs. wrong-password control ────
  const user = process.env.ECONT_USER ?? "";
  const pass = process.env.ECONT_PASS ?? "";
  const which = searchParams.get("env") === "demo" ? "demo" : "prod";
  const endpoint = ENDPOINTS[which];
  const paramAwb = (searchParams.get("awb") ?? "").replace(/\s+/g, "");
  // Fall back to the known-fake number so the auth control still runs without a real AWB.
  const awb = paramAwb || dbTracking[0] || "105138004477";

  const econt: Record<string, unknown> = {
    credsPresent: { user: user.length > 0, pass: pass.length > 0, userLen: user.length, passLen: pass.length },
    endpoint,
    awbUsed: awb,
    awbSource: paramAwb ? "query" : dbTracking[0] ? "database" : "fallback-fake",
    dbTrackingFound: dbTracking,
  };
  out.econt = econt;

  if (!user || !pass) {
    econt.error = "Missing ECONT_USER or ECONT_PASS in environment";
    return NextResponse.json(out, { status: 200 });
  }

  const [realCreds, controlBadPass] = await Promise.all([
    callEcont(endpoint, user, pass, awb),
    callEcont(endpoint, user, pass + "_WRONG", awb),
  ]);
  econt.realCreds = realCreds;
  econt.controlBadPass = controlBadPass;

  return NextResponse.json(out, { status: 200 });
}
