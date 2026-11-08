// mail-policy: internal
import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { buildPartnerEmail, partnerFromRow, sendPartnerEmail } from "@/lib/partner-email";

// ONE-OFF backfill (owner, 08.11.2026): the partner e-mail (lib/partner-email.ts) for every order of 08.11.2026 (Sofia time, BG + RO)
// that holds a women's-collection piece and was placed BEFORE the partner e-mail went live. Only the partner e-mail: no customer
// or team e-mail is sent here. The e-mails are queued at Resend (scheduledAt) with irregular gaps of 1-10 minutes, so the queue
// runs on its own. Vercel Cron calls this every 5 minutes; a KV flag makes it do the job once, every later call is a no-op.
// Remove this route and its vercel.json entry once the queue has gone out.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DAY_START = "2026-11-07T22:00:00.000Z";   // 08.11.2026 00:00 Sofia (EET, UTC+2)
const LIVE_SINCE = "2026-11-08T17:00:32.000Z";  // partner e-mail deployed: later orders got theirs live
const DONE_KEY = "partner-backfill:2026-11-08";
const sentKey = (ref: string) => `partner-backfill:sent:${ref}`;

const sameSecret = (a: string, b: string): boolean => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/** Irregular gaps between 1 and 10 minutes: about a third short (1-2.5 min, so 2-3 land close together), the rest 3-10 min. */
const gapMs = (): number => (Math.random() < 0.35 ? 60 + Math.random() * 90 : 180 + Math.random() * 420) * 1000;

export async function GET(req: NextRequest) {
  const cronSecret = (process.env.CRON_SECRET ?? "").trim();
  const auth = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!cronSecret || !sameSecret(auth, cronSecret)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const done = await kv.get(DONE_KEY);
  if (done) return NextResponse.json({ ok: true, skipped: "already done", done });
  if (!(await kv.set(`${DONE_KEY}:lock`, Date.now(), { nx: true, ex: 300 }))) return NextResponse.json({ ok: true, skipped: "running" });

  try {
    const { data, error } = await supabaseAdmin().from("orders").select("*")
      .gte("created_at", DAY_START).lt("created_at", LIVE_SINCE).order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const rows = (data ?? []).filter((o: Record<string, unknown>) => {
      if (o.is_international === true) return false;
      if (!["new", "confirmed", "shipped", "completed"].includes(String(o.status))) return false;   // no open / dead card attempts, no cancelled
      if (o.payment_method === "card") {
        // a card order's e-mails go out when it is paid: only those paid (notified) before the partner e-mail went live
        if (o.payment_status !== "paid") return false;
        if (o.notified_at && String(o.notified_at) >= LIVE_SINCE) return false;
      }
      return buildPartnerEmail(partnerFromRow(o)) !== null;   // holds a women's-collection piece
    });

    let at = Date.now() + 60_000 + Math.random() * 120_000;   // the first one in 1-3 minutes
    const queued: { ref: string; at: string }[] = [];
    const failed: { ref: string; error: string }[] = [];
    for (const o of rows) {
      const ref = String(o.order_ref);
      if (await kv.get(sentKey(ref))) continue;
      const when = new Date(at).toISOString();
      try {
        if (await sendPartnerEmail(partnerFromRow(o), { scheduledAt: when })) {
          await kv.set(sentKey(ref), when, { ex: 60 * 60 * 24 * 30 });
          queued.push({ ref, at: when });
          at += gapMs();
        }
      } catch (e) { failed.push({ ref, error: e instanceof Error ? e.message : String(e) }); }
    }

    const summary = { qualifying: rows.length, queued: queued.length, failed, first: queued[0]?.at ?? null, last: queued.at(-1)?.at ?? null, queue: queued };
    console.log("[partner-backfill]", JSON.stringify(summary));
    if (!failed.length) await kv.set(DONE_KEY, { at: new Date().toISOString(), queued: queued.length, last: summary.last });
    return NextResponse.json({ ok: true, ...summary });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[partner-backfill] failed:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  } finally {
    await kv.del(`${DONE_KEY}:lock`).catch(() => {});
  }
}
