import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sofiaDay, sofiaMidnight } from "@/lib/sofia-time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/client-error - a browser JS error (components/analytics/ClientErrorReporter.tsx). Stored in client_errors
// (supabase/monitoring_v2.sql); lib/health.ts alerts on it. Always answers 204: a broken log can never affect a page.
// Usage cap: at most DAY_FULL rows per Sofia day; after that 1 in SAMPLE_EVERY is stored with weight SAMPLE_EVERY, never more than DAY_MAX.
// Only our own pages (Origin / Sec-Fetch-Site) and real browsers (no bots / the uptime monitor) are accepted.
const DAY_FULL = 1000;
const SAMPLE_EVERY = 20;
const DAY_MAX = 1500;
const BOT = /bot|crawl|spider|slurp|headless|lighthouse|facebookexternalhit|lr-health|preview|curl|python|node-fetch/i;
const HOSTS = /^https:\/\/(www\.)?lorenzo-ricci\.com$/;
const txt = (v: unknown, n: number) => String(v ?? "").replace(/[\u0000-\u001f]/g, " ").slice(0, n).trim();

function browserOf(ua: string): { browser: string; device: string } {
  const os = /iPhone|iPad|iPod/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "?";
  const inApp = /FBAN|FBAV|FB_IAB/.test(ua) ? "Facebook app" : /Instagram/.test(ua) ? "Instagram app" : null;
  const m = ua.match(/(Edg|OPR|SamsungBrowser|Firefox|FxiOS|CriOS|Chrome|Version)\/(\d+)/);
  const name = m ? ({ Edg: "Edge", OPR: "Opera", SamsungBrowser: "Samsung", FxiOS: "Firefox", CriOS: "Chrome", Version: "Safari" } as Record<string, string>)[m[1]] ?? m[1] : "?";
  return { browser: `${inApp ?? `${name} ${m?.[2] ?? ""}`.trim()} / ${os}`.slice(0, 40), device: /Mobi|iPhone|Android/.test(ua) ? "mobile" : "desktop" };
}

export async function POST(req: NextRequest) {
  try {
    const ua = req.headers.get("user-agent") ?? "";
    const origin = req.headers.get("origin") ?? "";
    const site = req.headers.get("sec-fetch-site");
    if (!ua || BOT.test(ua) || (origin ? !HOSTS.test(origin) : site !== "same-origin")) return new NextResponse(null, { status: 204 });
    const raw = await req.text();
    if (raw.length > 3000) return new NextResponse(null, { status: 204 });
    const b = JSON.parse(raw) as Record<string, unknown>;
    const kind = b.kind === "rejection" ? "rejection" : b.kind === "error" ? "error" : null;
    const message = txt(b.message, 300);
    const page = txt(b.page, 120).replace(/\?.*$/, "");
    if (!kind || !message || !page.startsWith("/")) return new NextResponse(null, { status: 204 });
    const source = txt(b.source, 120) || null;
    const area = b.area === "checkout" || b.area === "cart" ? b.area : "page";
    const market = b.market === "ro" ? "ro" : "bg";
    // "The same error": kind + message with numbers flattened + file name (not line, which moves with each deploy).
    const sig = createHash("sha1").update(`${kind}|${message.replace(/\d+/g, "#")}|${(source ?? "").split(":")[0]}`).digest("hex").slice(0, 12);

    const sb = supabaseAdmin();
    const today = await sb.from("client_errors").select("id", { count: "exact", head: true }).gte("created_at", sofiaMidnight(sofiaDay()).toISOString());
    const n = today.count ?? 0;
    if (today.error || n >= DAY_MAX) return new NextResponse(null, { status: 204 });
    let weight = 1;
    if (n >= DAY_FULL) { if (Math.random() * SAMPLE_EVERY >= 1) return new NextResponse(null, { status: 204 }); weight = SAMPLE_EVERY; }
    const { error } = await sb.from("client_errors").insert({ sig, kind, message, source, page, area, market, weight, ...browserOf(ua) });
    if (error) console.error("[client-error] insert failed:", error.message);
  } catch { /* malformed beacon: ignore */ }
  return new NextResponse(null, { status: 204 });
}
