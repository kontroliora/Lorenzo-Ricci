import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { runHealth, sendTelegram } from "@/lib/health";
import { syncMeta } from "@/lib/meta-ads";
import { cronAuthorized, opsAuthorized } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;   // the first run pulls 30 days of Meta history

// Every 15 minutes (Vercel Cron, vercel.json): 1) Meta ads sync for yesterday + today (active ads only, ~2 s), so "spent > €15
// today" is fresh; 2) the health checks -> health_status (the panel's top bar) + Telegram (lib/health.ts: at most one message per
// problem per hour). The very first run also sends a short "data is in" summary to Telegram.
// ?test=1 only sends a test message. ?ping=1 only answers 200 (the GitHub watchdog: .github/workflows/health.yml).
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  // Operator calls (lib/cron-auth.ts opsAuthorized): run history + a fake problem to test the Telegram alert end to end.
  if ((sp.has("status") || sp.has("simulate")) && opsAuthorized(req.headers.get("authorization"))) {
    const sb = supabaseAdmin();
    if (sp.get("simulate") === "on" || sp.get("simulate") === "off") {
      const extra = sp.get("simulate") === "on"
        ? [{ key: "test:simulated", ok: false, title: "ТЕСТ: симулиран проблем (не е истински)", detail: "пуснат ръчно за проверка на известията; изчиства се със simulate=off" }]
        : [];
      const r = await runHealth(sb, { extra, source: `simulate-${sp.get("simulate")}` });
      return NextResponse.json({ ok: true, ...r });
    }
    const q = await sb.from("health_status").select("key, ok, title, detail, since, checked_at, last_alerted_at").order("checked_at", { ascending: false });
    const rows = q.data ?? [];
    return NextResponse.json({
      ok: !q.error, error: q.error?.message,
      runs: rows.filter((r) => r.key.startsWith("_run")).map((r) => ({ key: r.key, at: r.checked_at, summary: r.detail })),
      problems: rows.filter((r) => !r.ok).map((r) => ({ key: r.key, title: r.title, since: r.since, last_alerted_at: r.last_alerted_at })),
      checks: rows.filter((r) => !r.key.startsWith("_run")).map((r) => ({ key: r.key, ok: r.ok, detail: r.detail })),
    });
  }
  if (!cronAuthorized(req.headers.get("authorization"))) return NextResponse.json({ ok: false, error: "unauthorized", build: "health-v4" }, { status: 401 });
  if (sp.get("ping") === "1") return NextResponse.json({ ok: true });
  if (sp.get("test") === "1") {
    const t = await sendTelegram("✅ <b>Lorenzo Ricci</b>: тестово известие. Проверките на системата са включени (на всеки 15 мин), проблемите идват тук най-много веднъж на час.");
    return NextResponse.json({ ok: t.ok, telegram: t });
  }
  const sb = supabaseAdmin();
  try {
    const first = !(await sb.from("health_status").select("key").eq("key", "_run").maybeSingle()).data;
    let meta: Awaited<ReturnType<typeof syncMeta>> | { error: string };
    try { meta = await syncMeta(sb, first ? 30 : 2, first); }   // first run: 30 days of history + every live ad
    catch (e) { meta = { error: e instanceof Error ? e.message : String(e) }; }
    const r = await runHealth(sb, { source: req.headers.get("user-agent")?.includes("vercel-cron") ? "vercel-cron" : "manual" });
    console.log("[health]", JSON.stringify({ meta, ...r }));
    if (first) {
      const m = "error" in meta ? `Meta: грешка (${meta.error.slice(0, 120)})` : `Meta: ${meta.ads} реклами, ${meta.rows} реда за ${meta.since} – ${meta.until}, €${meta.spend.toFixed(2)} разход`;
      await sendTelegram(`📊 <b>Lorenzo Ricci</b>: първата проверка мина, данните са в панела.\n${m}\nПроверки: ${r.checks}, проблеми: ${r.problems.length}${r.problems.length ? ` (${r.problems.join(", ")})` : ""}`);
    }
    return NextResponse.json({ ok: true, meta, ...r });
  } catch (e) {
    console.error("[health] failed:", e);
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
