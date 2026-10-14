import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getStripe } from "@/lib/stripe";
import { toMinor } from "@/lib/payments";
import { markOrderPaid, expireOrder, type OrderRow } from "@/lib/payment-orders";
import { notifyPaid, alertTeam } from "@/lib/payment-notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Stripe webhook: the ONLY thing that turns a card order into a paid one.
//   - the signature is verified against STRIPE_WEBHOOK_SECRET on the RAW body (anything else is rejected with 400);
//   - checkout.session.completed (paid) / checkout.session.async_payment_succeeded / payment_intent.succeeded
//       -> pending_payment becomes new + paid, ONCE (one conditional UPDATE): e-mails, Meta Purchase, bookkeeping follow;
//   - checkout.session.expired / async_payment_failed -> the order is cancelled and its stock goes back;
//   - a repeated delivery of any event finds the order already moved and does nothing (200);
//   - a failure here answers 500 so Stripe retries: every step above is safe to repeat.
// Configure in Stripe: endpoint https://www.lorenzo-ricci.com/api/stripe/webhook with exactly these events.

const piOf = (v: string | Stripe.PaymentIntent | null | undefined): string | null => (typeof v === "string" ? v : v?.id ?? null);

async function handlePaid(sb: ReturnType<typeof supabaseAdmin>, ref: string, info: { paymentIntent: string | null; sessionId: string | null; amountTotal?: number | null; meta: Record<string, string> }): Promise<string> {
  const r = await markOrderPaid(sb, ref, { paymentIntent: info.paymentIntent, sessionId: info.sessionId });
  if (r.kind === "paid") {
    const order: OrderRow = r.order;
    if (typeof info.amountTotal === "number" && info.amountTotal !== toMinor(Number(order.total ?? 0))) {
      await alertTeam(`Сума на плащане не съвпада - ${ref}`, `Stripe взе ${info.amountTotal} (най-малка единица), поръчката е ${toMinor(Number(order.total ?? 0))}. Провери в Stripe.`);
    }
    await notifyPaid(order, info.meta);
    if (r.late) await alertTeam(`Късно плащане прието - ${ref}`, "Плащането дойде след изтичането на 30-те минути, но наличността още имаше и поръчката беше възстановена.");
    return r.late ? "paid (late, stock re-reserved)" : "paid";
  }
  if (r.kind === "refunded") {
    await alertTeam(`Платено, но няма наличност - върнахме парите - ${ref}`, "Плащането дойде след изтичането на сесията, наличността вече я няма и сумата е върната автоматично през Stripe. Свържи се с клиента.");
    return "refunded (stock gone)";
  }
  return r.kind === "unknown" ? "unknown order" : "already paid";
}

export async function POST(req: NextRequest) {
  const secret = (process.env.STRIPE_WEBHOOK_SECRET ?? "").trim();
  if (!secret) { console.error("[stripe-webhook] STRIPE_WEBHOOK_SECRET is not set"); return NextResponse.json({ error: "not configured" }, { status: 500 }); }
  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "missing signature" }, { status: 400 });

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(raw, signature, secret);
  } catch (e) {
    console.warn("[stripe-webhook] bad signature:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  const sb = supabaseAdmin();
  let result = "ignored";
  let ref: string | null = null;
  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const s = event.data.object as Stripe.Checkout.Session;
        ref = s.metadata?.order_ref ?? s.client_reference_id ?? null;
        if (!ref) break;
        if (event.type === "checkout.session.completed" && s.payment_status !== "paid") { result = "waiting for the asynchronous payment"; break; }
        result = await handlePaid(sb, ref, { paymentIntent: piOf(s.payment_intent), sessionId: s.id, amountTotal: s.amount_total, meta: s.metadata ?? {} });
        break;
      }
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        ref = pi.metadata?.order_ref ?? null;
        if (!ref) break;
        result = await handlePaid(sb, ref, { paymentIntent: pi.id, sessionId: null, amountTotal: pi.amount_received, meta: {} });
        break;
      }
      case "checkout.session.expired":
      case "checkout.session.async_payment_failed": {
        const s = event.data.object as Stripe.Checkout.Session;
        ref = s.metadata?.order_ref ?? s.client_reference_id ?? null;
        if (!ref) break;
        const row = await expireOrder(sb, ref, event.type === "checkout.session.expired" ? "expired" : "failed");
        result = row ? "expired (stock released)" : "already handled";
        break;
      }
      case "charge.refunded": {
        const c = event.data.object as Stripe.Charge;
        const pi = piOf(c.payment_intent);
        if (!pi || !c.refunded) break;
        const { data } = await sb.from("orders").update({ payment_status: "refunded" }).eq("stripe_payment_intent", pi).neq("payment_status", "refunded").select("order_ref");
        ref = data?.[0]?.order_ref ?? null;
        if (ref) { result = "marked refunded"; await alertTeam(`Върнато плащане - ${ref}`, "Плащането е върнато изцяло в Stripe. Провери дали поръчката трябва да се откаже и наличността да се върне."); }
        break;
      }
    }
  } catch (e) {
    console.error(`[stripe-webhook] ${event.type} ${event.id} failed:`, e);
    return NextResponse.json({ error: "processing failed" }, { status: 500 }); // Stripe retries; every step is idempotent
  }

  // Audit trail only (the order's own status is what guarantees "once"); a failure here is not worth a retry.
  const { error: logErr } = await sb.from("stripe_events").upsert({ event_id: event.id, type: event.type, order_ref: ref, result }, { onConflict: "event_id", ignoreDuplicates: true });
  if (logErr) console.warn("[stripe-webhook] audit insert failed:", logErr.message);
  return NextResponse.json({ received: true, result });
}
