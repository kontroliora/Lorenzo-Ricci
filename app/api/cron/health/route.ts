import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { runHealth, sendTelegram } from "@/lib/health";
import { cronAuthorized } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Health checks every 15 minutes (GitHub Actions, .github/workflows/health.yml) -> health_status (the panel's top bar) + Telegram
// (lib/health.ts: at most one message per problem per hour). ?test=1 only sends a test message to the Telegram chat.
export async function GET(req: NextRequest) {
  if (!cronAuthorized(req.headers.get("authorization"))) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (req.nextUrl.searchParams.get("test") === "1") {
    const t = await sendTelegram("✅ <b>Lorenzo Ricci</b>: тестово известие. Проверките на системата са включени (на всеки 15 мин), проблемите идват тук най-много веднъж на час.");
    return NextResponse.json({ ok: t.ok, telegram: t });
  }
  try {
    const r = await runHealth(supabaseAdmin());
    console.log("[health]", JSON.stringify(r));
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    console.error("[health] failed:", e);
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
