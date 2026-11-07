import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/resend-webhook - Resend tells us an e-mail bounced / failed / was marked as spam / is delayed. Stored in email_events
// (supabase/monitoring_v2.sql); lib/health.ts alerts on it. Signed by Resend (Svix): RESEND_WEBHOOK_SECRET = the webhook's
// "Signing secret" (whsec_...). Without the secret nothing is accepted. Delivered / opened / clicked events are ignored.
// Resend dashboard -> Webhooks -> Add endpoint: https://www.lorenzo-ricci.com/api/resend-webhook,
// events: email.bounced, email.failed, email.complained, email.delivery_delayed.
const KEEP = new Set(["email.bounced", "email.failed", "email.complained", "email.delivery_delayed"]);
const TOLERANCE_S = 5 * 60;

function verified(secret: string, id: string, ts: string, body: string, header: string): boolean {
  const t = Number(ts);
  if (!id || !Number.isFinite(t) || Math.abs(Date.now() / 1000 - t) > TOLERANCE_S) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const want = createHmac("sha256", key).update(`${id}.${ts}.${body}`).digest();
  return header.split(" ").some((part) => {
    const [ver, sig] = part.split(",");
    if (ver !== "v1" || !sig) return false;
    const got = Buffer.from(sig, "base64");
    return got.length === want.length && timingSafeEqual(got, want);
  });
}

const mask = (email: string) => email.replace(/^([^@])[^@]*@/, "$1***@").slice(0, 80);

export async function POST(req: NextRequest) {
  const secret = (process.env.RESEND_WEBHOOK_SECRET ?? "").trim();
  if (!secret) return NextResponse.json({ ok: false, error: "RESEND_WEBHOOK_SECRET not set" }, { status: 503 });
  const body = await req.text();
  const id = req.headers.get("svix-id") ?? "";
  if (!verified(secret, id, req.headers.get("svix-timestamp") ?? "", body, req.headers.get("svix-signature") ?? ""))
    return NextResponse.json({ ok: false, error: "bad signature" }, { status: 401 });
  try {
    const ev = JSON.parse(body) as { type?: string; data?: { email_id?: string; to?: string[] | string; subject?: string; bounce?: { message?: string; subType?: string }; failed?: { reason?: string } } };
    if (!ev.type || !KEEP.has(ev.type)) return NextResponse.json({ ok: true, ignored: ev.type ?? null });
    const d = ev.data ?? {};
    const to = Array.isArray(d.to) ? d.to[0] : d.to;
    const row = {
      svix_id: id, type: ev.type, email_id: d.email_id ?? null,
      recipient: to ? mask(String(to)) : null, subject: d.subject ? String(d.subject).slice(0, 160) : null,
      reason: (d.bounce?.message ?? d.bounce?.subType ?? d.failed?.reason ?? null)?.toString().slice(0, 200) ?? null,
    };
    console.warn("[resend-webhook]", JSON.stringify(row));
    const { error } = await supabaseAdmin().from("email_events").upsert(row, { onConflict: "svix_id", ignoreDuplicates: true });
    if (error) console.error("[resend-webhook] insert failed:", error.message);
  } catch (e) {
    console.error("[resend-webhook] bad body:", e instanceof Error ? e.message : e);
  }
  return NextResponse.json({ ok: true });
}
