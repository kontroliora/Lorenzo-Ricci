import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/checkout-event - a customer's checkout stopped (the form refused to submit, the server refused the order, the network
// failed). Field NAMES and generic codes only, no personal data. Written to the Vercel logs ("[checkout-fail]") and, once
// supabase/checkout_events.sql has been run, to the table checkout_events (shown in the panel). Always answers 204 so the browser
// never waits for it; a broken log can never affect an order.
const KEY = /^[A-Za-z0-9_-]{1,30}$/;
const word = (v: unknown, n = 40) => String(v ?? "").replace(/[^A-Za-z0-9_ .:\/-]/g, "").slice(0, n);

export async function POST(req: NextRequest) {
  try {
    const raw = await req.text();
    if (raw.length > 2000) return new NextResponse(null, { status: 204 });
    const b = JSON.parse(raw) as Record<string, unknown>;
    const market = b.market === "ro" ? "ro" : b.market === "bg" ? "bg" : null;
    const kind = b.kind === "validation" || b.kind === "server" || b.kind === "network" ? b.kind : null;
    if (!market || !kind) return new NextResponse(null, { status: 204 });
    const fields = (Array.isArray(b.fields) ? b.fields : []).map(String).filter((f) => KEY.test(f)).slice(0, 10);
    const row = {
      market, kind, fields,
      code: word(b.code) || null,
      status: Number.isFinite(Number(b.status)) ? Math.trunc(Number(b.status)) : null,
      delivery: word(b.delivery, 20) || null,
      picker: word(b.picker, 20) || null,
      width: Number.isFinite(Number(b.w)) ? Math.trunc(Number(b.w)) : null,
      session_id: word(b.sessionId, 64) || null,
      ua: (req.headers.get("user-agent") ?? "").slice(0, 160),
    };
    console.warn("[checkout-fail]", JSON.stringify(row));
    const { error } = await supabaseAdmin().from("checkout_events").insert(row);
    if (error && !/checkout_events|relation|schema cache/i.test(error.message)) console.error("[checkout-fail] insert failed:", error.message);
  } catch { /* malformed beacon: ignore */ }
  return new NextResponse(null, { status: 204 });
}
