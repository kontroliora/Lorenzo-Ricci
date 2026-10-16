import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getStripe } from "@/lib/stripe";
import { toMinor } from "@/lib/payments";
import { modeOfKey } from "@/lib/stripe-mode";
import { ANY_ORDER_REF_RE } from "@/lib/order-ref";
import { markOrderPaid, markOrderRefunded, expireOrder } from "@/lib/payment-orders";
import { notifyPaidOnce, alertTeam } from "@/lib/payment-notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Stripe webhook: the ONLY thing that turns a card order into a paid one.
//   - the signature is verified against STRIPE_WEBHOOK_SECRET on the RAW body (anything else is rejected with 400);
//   - checkout.session.completed (paid) / checkout.session.async_payment_succeeded
//       -> pending_payment becomes confirmed + paid (no call needed: it goes to "За изпълнение"), ONCE (one conditional UPDATE); then the notifications (e-mails, Meta
//          Purchase) are claimed and sent ONCE (notifyPaidOnce: a retry or the sweep finishes them if this call dies);
//   - checkout.session.expired / async_payment_failed -> the order is cancelled and its stock (and promo code) goes back;
//   - charge.refunded -> a full refund cancels an order that has not shipped (stock back); partial refunds alert the team;
//   - a repeated delivery of any event finds the order already moved and does nothing (200);
//   - a failure here answers 500 so Stripe retries: every step above is safe to repeat.
// Configure in Stripe: endpoint https://www.lorenzo-ricci.com/api/stripe/webhook with exactly these five events:
//   checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.async_payment_failed,
//   checkout.session.expired, charge.refunded.

const piOf = (v: string | Stripe.PaymentIntent | null | undefined): string | null => (typeof v === "string" ? v : v?.id ?? null);
const refOf = (s: Stripe.Checkout.Session): string | null => {
  const ref = s.metadata?.order_ref ?? s.client_reference_id ?? null;
  return ref && ANY_ORDER_REF_RE.test(ref) ? ref : null; // events of other sites on the same Stripe account carry other references
};

async function handlePaid(sb: ReturnType<typeof supabaseAdmin>, ref: string, s: Stripe.Checkout.Session): Promise<string> {
  const r = await markOrderPaid(sb, ref, { paymentIntent: piOf(s.payment_intent), sessionId: s.id });
  if (r.kind === "unknown") return "unknown order";
  if (r.kind === "mismatch") {
    await alertTeam(`Плащане за друга сесия - ${ref}`, `Stripe сесия ${s.id} не е сесията на поръчка ${ref} (${r.order.stripe_session_id}). Поръчката НЕ е променена. Провери в Stripe.`);
    return "session mismatch (ignored)";
  }
  if (r.kind === "refunded") {
    await alertTeam(`Платено, но няма наличност - върнахме парите - ${ref}`, "Плащането дойде след изтичането на сесията, наличността вече я няма и сумата е върната автоматично през Stripe. Свържи се с клиента.");
    return "refunded (stock gone)";
  }

  const order = r.order;
  if (r.kind === "paid") {
    // Amount and currency are what the server expected (they cannot differ: the session total is checked when it is created).
    if (typeof s.amount_total === "number" && s.amount_total !== toMinor(Number(order.total ?? 0))) {
      await alertTeam(`Сума на плащане не съвпада - ${ref}`, `Stripe взе ${s.amount_total} (най-малка единица), поръчката е ${toMinor(Number(order.total ?? 0))}. Провери в Stripe.`);
    }
    const expectedCurrency = String(order.payment_currency ?? "").toLowerCase();
    if (expectedCurrency && s.currency && s.currency.toLowerCase() !== expectedCurrency) {
      await alertTeam(`Валута на плащане не съвпада - ${ref}`, `Stripe взе в ${s.currency.toUpperCase()}, поръчката е в ${expectedCurrency.toUpperCase()}. Провери в Stripe.`);
    }
    if (r.late) await alertTeam(`Късно плащане прието - ${ref}`, "Плащането дойде след изтичането на 30-те минути, но наличността още имаше и поръчката беше възстановена.");
  }
  // Also for "already": an earlier delivery may have died after the order was marked paid but before the e-mails went out.
  const sent = await notifyPaidOnce(sb, ref, s.metadata ?? {});
  if (r.kind === "paid") return r.late ? "paid (late, stock re-reserved)" : "paid";
  return sent === "sent" ? "already paid (notifications completed)" : "already paid";
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

  // A test-mode event must never touch a live shop (or the other way round).
  // sk_live_ (secret key) AND rk_live_ (restricted key) are live keys: checking only "sk_live_" would ignore every live event of a restricted key.
  const liveKey = modeOfKey(process.env.STRIPE_SECRET_KEY) === "live";
  if (event.livemode !== liveKey) {
    console.warn(`[stripe-webhook] ignoring ${event.type}: event livemode=${event.livemode} but the key is ${liveKey ? "live" : "test"}`);
    return NextResponse.json({ received: true, result: "ignored (livemode mismatch)" });
  }

  const sb = supabaseAdmin();
  let result = "ignored";
  let ref: string | null = null;
  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const s = event.data.object as Stripe.Checkout.Session;
        ref = refOf(s);
        if (!ref) break;
        if (event.type === "checkout.session.completed" && s.payment_status !== "paid") { result = "waiting for the asynchronous payment"; break; }
        result = await handlePaid(sb, ref, s);
        break;
      }
      case "checkout.session.expired":
      case "checkout.session.async_payment_failed": {
        const s = event.data.object as Stripe.Checkout.Session;
        ref = refOf(s);
        if (!ref) break;
        const row = await expireOrder(sb, ref, event.type === "checkout.session.expired" ? "expired" : "failed");
        result = row ? "expired (stock released)" : "already handled";
        break;
      }
      case "charge.refunded": {
        const c = event.data.object as Stripe.Charge;
        const pi = piOf(c.payment_intent);
        if (!pi) break;
        if (c.amount_refunded < c.amount) {
          const { data } = await sb.from("orders").select("order_ref").eq("stripe_payment_intent", pi).limit(1);
          ref = data?.[0]?.order_ref ?? null;
          if (ref) { result = "partial refund (team alerted)"; await alertTeam(`Частично върнато плащане - ${ref}`, `Върнати ${c.amount_refunded} от ${c.amount} (най-малка единица). Поръчката не е променена - реши ръчно.`); }
          break;
        }
        const r = await markOrderRefunded(sb, pi);
        if (!r) break;
        ref = r.order.order_ref;
        result = r.cancelled ? "refunded: order cancelled, stock released" : "refunded: order already shipped";
        await alertTeam(`Върнато плащане - ${ref}`, r.cancelled
          ? "Плащането е върнато изцяло в Stripe. Поръчката още не беше изпратена: отказана е и наличността е върната."
          : `Плащането е върнато изцяло в Stripe, но поръчката е със статус „${r.order.status}" - реши ръчно дали да се връща пратката.`);
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
