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
// ?ping=1 only answers 200 (the GitHub watchdog: .github/workflows/health.yml).
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  // Operator calls (lib/cron-auth.ts opsAuthorized): run history + a fake problem to test the Telegram alert end to end.
  if ((sp.has("status") || sp.has("sync")) && opsAuthorized(req.headers.get("authorization"))) {
    const sb = supabaseAdmin();
    if (sp.get("sync") === "1") {
      try { return NextResponse.json({ ok: true, meta: await syncMeta(sb, 30, true) }); }
      catch (e) { return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }); }
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
  if (!cronAuthorized(req.headers.get("authorization"))) return NextResponse.json({ ok: false, error: "unauthorized", build: "health-v5" }, { status: 401 });
  if (sp.get("ping") === "1") return NextResponse.json({ ok: true });
  const sb = supabaseAdmin();
  try {
    const first = !(await sb.from("health_status").select("key").eq("key", "_run").maybeSingle()).data;
    // 30 days of Meta history + every live ad, once: on the very first run, and once more for the accounts whose first run
    // happened before the Meta keys were set (marker '_meta_backfill'; written only when the pull succeeded, so it retries).
    const backfill = first || !(await sb.from("health_status").select("key").eq("key", "_meta_backfill").maybeSingle()).data;
    let meta: Awaited<ReturnType<typeof syncMeta>> | { error: string };
    try { meta = await syncMeta(sb, backfill ? 30 : 2, backfill); }
    catch (e) { meta = { error: e instanceof Error ? e.message : String(e) }; }
    if (backfill && !("error" in meta)) {
      await sb.from("health_status").upsert({ key: "_meta_backfill", ok: true, title: "meta backfill 30d", detail: JSON.stringify(meta).slice(0, 300), checked_at: new Date().toISOString() }, { onConflict: "key" });
      if (!first) await sendTelegram(`📊 <b>Lorenzo Ricci</b>: Meta историята е изтеглена: ${meta.ads} реклами, ${meta.rows} реда за ${meta.since} – ${meta.until}, €${meta.spend.toFixed(2)} разход.`);
    }
    // A failing Meta pull is a problem of its own (bar + Telegram), with Meta's error message.
    const metaCheck = { key: "meta_api", ok: !("error" in meta), title: "Meta синхронизацията не работи", detail: "error" in meta ? meta.error.slice(0, 200) : undefined };
    const r = await runHealth(sb, { extra: [metaCheck], source: req.headers.get("user-agent")?.includes("vercel-cron") ? "vercel-cron" : "manual" });
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
