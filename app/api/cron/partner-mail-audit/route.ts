import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { cronAuthorized } from "@/lib/cron-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { isCollectionLine } from "@/lib/partner/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ONE-OFF (owner, 09.11.2026): which partner e-mails went out for orders WITHOUT a women's-collection piece. The Resend key is
// send-only (no log access), so from our own data:
//   A. the only unfiltered sender: 88c291f, live 08.11 ~17:01-17:17 UTC (deploys 17:00 -> 17:16). Every order placed then, and
//      every card order paid then, got a partner e-mail.
//   B. every order the new path sent (orders.partner_email_sent_at).
// The old filtered sender (7b6c2e6, until the rebuild) and the backfill skipped orders without a collection piece (by slug).
const RUN = "partner-mail-audit:2026-11-09-b";
const A_FROM = "2026-11-08T16:59:00.000Z", A_TO = "2026-11-08T17:20:00.000Z";

type O = Record<string, unknown>;
const view = (o: O, path: string) => {
  const lines = Array.isArray(o.items) ? (o.items as O[]) : [];
  const coll = lines.some(isCollectionLine);
  return {
    path, ref: o.order_ref, created: o.created_at, paid: o.paid_at ?? null, pay: `${o.payment_method}/${o.payment_status}`, status: o.status,
    hasCollection: coll, mixed: coll && lines.some((l) => !l.gift && !isCollectionLine(l)),
    lines: lines.map((l) => `${l.slug}${l.gift ? "(gift)" : ""}`),
  };
};

export async function GET(req: NextRequest) {
  if (!cronAuthorized(req.headers.get("authorization"))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (await kv.get(RUN)) return NextResponse.json({ ok: true, skipped: "done" });
  const sb = supabaseAdmin();
  const cols = "order_ref, created_at, paid_at, items, payment_method, payment_status, status, partner_email_sent_at";
  const [placed, paid, sent] = await Promise.all([
    sb.from("orders").select(cols).gte("created_at", A_FROM).lt("created_at", A_TO).order("created_at"),
    sb.from("orders").select(cols).gte("paid_at", A_FROM).lt("paid_at", A_TO).order("paid_at"),
    sb.from("orders").select(cols).not("partner_email_sent_at", "is", null).order("partner_email_sent_at"),
  ]);
  const err = placed.error?.message ?? paid.error?.message ?? sent.error?.message;
  // A: COD orders placed in the window (sent at once); card orders only when PAID in the window (the e-mail went out on payment)
  const a = [
    ...((placed.data ?? []) as O[]).filter((o) => o.payment_method !== "card").map((o) => view(o, "A: unfiltered 08.11 (new order)")),
    ...((paid.data ?? []) as O[]).filter((o) => o.payment_method === "card").map((o) => view(o, "A: unfiltered 08.11 (card paid)")),
  ];
  const b = ((sent.data ?? []) as O[]).map((o) => ({ ...view(o, "B: new path"), sentAt: o.partner_email_sent_at }));
  const out = { error: err, windowA: [A_FROM, A_TO], a, b, wrong: [...a, ...b].filter((r) => !r.hasCollection).map((r) => `${r.ref} (${r.path})`) };
  console.log("[partner-mail-audit]", JSON.stringify(out));
  if (!err) await kv.set(RUN, 1, { ex: 60 * 60 * 24 * 7 });
  return NextResponse.json(out);
}
