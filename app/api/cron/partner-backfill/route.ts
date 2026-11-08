// mail-policy: internal
import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { Resend } from "resend";
import { PARTNER_RECIPIENTS, buildPartnerEmail, partnerFromRow, sendPartnerEmail } from "@/lib/partner-email";

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

// The 16 orders the run of 08.11.2026 17:21 UTC queued (its log line).
const QUEUED_REFS = ["LR-GAQGGDGG", "LR-AP5YYZFT", "LR-UFS3HW3G", "LR-LAPUGYQ3", "LR-N92UUQPS", "LR-WVNEMLCT", "LR-DGAQ8FBK", "LR-ZK48JCYU",
  "LR-QZY7QKT8", "LR-53AXTVBV", "LR-6987EMCN", "LR-8M6X9C4V", "LR-UK5MT7LR", "LR-VS5MHCEY", "LR-6HN7VT9C", "LR-UT3L7A44"];
const CHECK_KEY = `${DONE_KEY}:check`;

/** Once the last queued e-mail is due (+3 min): Resend's last event of each queued partner e-mail, logged. Stops when all are delivered or after 6 tries. */
async function deliveryCheck(last: string | null): Promise<unknown> {
  const prev = await kv.get<{ final?: boolean; tries?: number }>(CHECK_KEY);
  if (prev?.final) return prev;
  if (!last || Date.now() < new Date(last).getTime() + 3 * 60_000) return { waiting: "until the last e-mail is due" };
  const key = process.env.RESEND_API_KEY;
  if (!key) return { error: "RESEND_API_KEY not set" };
  const resend = new Resend(key);
  const seen = new Map<string, { last_event: string; scheduled_at?: string | null; id: string }>();
  let after: string | undefined;
  for (let page = 0; page < 5; page++) {
    const { data, error } = await resend.emails.list({ limit: 100, ...(after ? { after } : {}) });
    if (error || !data) return { error: error?.message ?? "no data" };
    for (const e of data.data) {
      const to = Array.isArray(e.to) ? e.to : [e.to];
      if (!to.some((t) => PARTNER_RECIPIENTS.includes(String(t)))) continue;
      const ref = QUEUED_REFS.find((r) => String(e.subject ?? "").includes(`Поръчка ${r} `));
      if (ref && !seen.has(ref)) seen.set(ref, { last_event: String(e.last_event), scheduled_at: e.scheduled_at ?? null, id: e.id });
    }
    if (!data.has_more || !data.data.length) break;
    after = data.data[data.data.length - 1].id;
  }
  const DELIVERED = new Set(["delivered", "opened", "clicked"]);
  const byRef = QUEUED_REFS.map((ref) => ({ ref, event: seen.get(ref)?.last_event ?? "not found" }));
  const delivered = byRef.filter((x) => DELIVERED.has(x.event)).length;
  const tries = (prev?.tries ?? 0) + 1;
  const result = { at: new Date().toISOString(), queued: QUEUED_REFS.length, delivered, notDelivered: byRef.filter((x) => !DELIVERED.has(x.event)), tries, final: delivered === QUEUED_REFS.length || tries >= 6 };
  console.log("[partner-backfill-check]", JSON.stringify(result));
  await kv.set(CHECK_KEY, result, { ex: 60 * 60 * 24 * 7 });
  return result;
}

/** Irregular gaps between 1 and 10 minutes: about a third short (1-2.5 min, so 2-3 land close together), the rest 3-10 min. */
const gapMs = (): number => (Math.random() < 0.35 ? 60 + Math.random() * 90 : 180 + Math.random() * 420) * 1000;

export async function GET(req: NextRequest) {
  const cronSecret = (process.env.CRON_SECRET ?? "").trim();
  const auth = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!cronSecret || !sameSecret(auth, cronSecret)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const done = await kv.get<{ last?: string | null }>(DONE_KEY);
  if (done) return NextResponse.json({ ok: true, skipped: "already done", done, check: await deliveryCheck(done.last ?? null) });
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
