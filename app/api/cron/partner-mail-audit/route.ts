import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { cronAuthorized } from "@/lib/cron-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { isCollectionLine } from "@/lib/partner/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// ONE-OFF (owner, 09.11.2026): every e-mail Resend sent to the partner since 08.11.2026 00:00 Sofia, with the order it was about
// and whether that order holds a women's-collection piece (by product id). Logged once as [partner-mail-audit], then removed.
const RUN = "partner-mail-audit:2026-11-09-a";
const PARTNER = "dejvidvisev99@gmail.com";
const SINCE = "2026-11-07T22:00:00.000Z";

type Mail = { id: string; to: string[] | string; subject: string; created_at: string; last_event?: string; scheduled_at?: string | null };

export async function GET(req: NextRequest) {
  if (!cronAuthorized(req.headers.get("authorization"))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (await kv.get(RUN)) return NextResponse.json({ ok: true, skipped: "done" });
  const key = process.env.RESEND_API_KEY;
  if (!key) return NextResponse.json({ ok: false, error: "RESEND_API_KEY not set" });

  const mails: Mail[] = [];
  let after: string | undefined;
  let pages = 0, error: string | undefined;
  while (pages < 60) {
    const r = await fetch(`https://api.resend.com/emails?limit=100${after ? `&after=${after}` : ""}`, { headers: { Authorization: `Bearer ${key}` }, cache: "no-store" });
    if (!r.ok) { error = `Resend list HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`; break; }
    const j = (await r.json()) as { data?: Mail[]; has_more?: boolean };
    const data = j.data ?? [];
    pages++;
    mails.push(...data);
    if (!j.has_more || !data.length || data[data.length - 1].created_at < SINCE) break;
    after = data[data.length - 1].id;
  }
  const mine = mails.filter((m) => m.created_at >= SINCE && (Array.isArray(m.to) ? m.to : [m.to]).some((t) => String(t).toLowerCase().includes(PARTNER)));

  const refs = [...new Set(mine.map((m) => m.subject.match(/LR(?:RO)?-[A-Z0-9]+/)?.[0]).filter(Boolean) as string[])];
  const orders = new Map<string, Record<string, unknown>>();
  if (refs.length) {
    const q = await supabaseAdmin().from("orders").select("order_ref, created_at, items, payment_method, payment_status, status").in("order_ref", refs);
    for (const o of q.data ?? []) orders.set(String(o.order_ref), o);
  }
  const rows = mine.sort((a, b) => a.created_at.localeCompare(b.created_at)).map((m) => {
    const ref = m.subject.match(/LR(?:RO)?-[A-Z0-9]+/)?.[0] ?? null;
    const o = ref ? orders.get(ref) : undefined;
    const lines = Array.isArray(o?.items) ? (o!.items as Record<string, unknown>[]) : [];
    return {
      sent: m.created_at, scheduled: m.scheduled_at ?? null, status: m.last_event ?? null, subject: m.subject, ref,
      orderAt: o?.created_at ?? null, pay: o ? `${o.payment_method}/${o.payment_status}` : null,
      slugs: lines.map((l) => `${l.slug}${l.gift ? "(gift)" : ""}`),
      hasCollection: o ? lines.some(isCollectionLine) : null,
    };
  });
  const out = { scanned: mails.length, pages, error, toPartner: rows.length, wrong: rows.filter((r) => r.hasCollection === false).map((r) => r.ref), rows };
  console.log("[partner-mail-audit]", JSON.stringify(out));
  if (!error) await kv.set(RUN, 1, { ex: 60 * 60 * 24 * 7 });
  return NextResponse.json(out);
}
