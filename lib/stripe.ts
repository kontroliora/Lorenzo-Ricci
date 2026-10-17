import Stripe from "stripe";
import { STRIPE_SESSION_TTL_SECONDS, toMinor } from "./payments";

// Server-only Stripe client + the one place that builds a Checkout Session.
// Env: STRIPE_SECRET_KEY (sk_test_... while testing; sk_live_... or a restricted rk_live_... later), STRIPE_WEBHOOK_SECRET (whsec_...).
// A restricted key needs: Checkout Sessions (write), Coupons (write), Refunds (write), PaymentIntents (read), Charges (read).
// Hosted Stripe Checkout: card, Apple Pay and Google Pay are offered automatically on devices that support them (switch
// them on in Dashboard -> Settings -> Payment methods); 3-D Secure is handled by Stripe.

let client: Stripe | null = null;

export function getStripe(): Stripe {
  const key = (process.env.STRIPE_SECRET_KEY ?? "").trim();
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  if (!client) {
    // STRIPE_API_BASE points the SDK at a local fake Stripe for automated tests. It is honoured ONLY with a test key, so
    // a live key can never be redirected.
    const base = process.env.STRIPE_API_BASE;
    if (base && key.startsWith("sk_test_")) {
      const u = new URL(base);
      client = new Stripe(key, { apiVersion: Stripe.API_VERSION, host: u.hostname, port: u.port, protocol: u.protocol.replace(":", "") as "http" | "https", telemetry: false });
    } else {
      client = new Stripe(key, { apiVersion: Stripe.API_VERSION, telemetry: false });
    }
  }
  return client;
}

export type CardLine = { name: string; sku: string; quantity: number; unitPrice: number; image?: string };

/**
 * One Checkout Session for one order. `lines` and their sum are the SERVER-derived amounts of the order (delivery is a line of its own
 * when it is not free, the same price as for cash on delivery); the caller has already reserved the stock and saved the order as pending_payment.
 */
export async function createCardSession(args: {
  orderRef: string;
  currency: "eur" | "ron";
  lines: CardLine[];
  customerEmail?: string;
  successUrl: string;
  cancelUrl: string;
  locale: "bg" | "ro";
  /** Order-level discount (bundle / promo) as a one-off Stripe coupon, so the lines can stay at catalog prices. */
  couponId?: string;
  /** Extra metadata read back by the webhook (cart session id, Meta matching data ...). Values are strings, 500 chars max. */
  metadata?: Record<string, string>;
  /** The amount the server expects Stripe to charge, in major units: checked against Stripe's own total. */
  expectedTotal: number;
}): Promise<{ id: string; url: string }> {
  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    // Cards only (Apple Pay and Google Pay are part of "card"): an asynchronous / offline method enabled in the Dashboard would
    // leave orders "complete but unpaid" for days. (This API version filters with allowed_payment_method_types.)
    allowed_payment_method_types: ["card"],
    // Prices are the shop's own (EUR for Bulgaria, lei for Romania): no "pay in your currency" switcher with Stripe's exchange rate.
    adaptive_pricing: { enabled: false },
    client_reference_id: args.orderRef,
    ...(args.customerEmail ? { customer_email: args.customerEmail } : {}),
    line_items: args.lines.map((l) => ({
      quantity: l.quantity,
      price_data: {
        currency: args.currency,
        unit_amount: toMinor(l.unitPrice),
        product_data: { name: l.name, metadata: { sku: l.sku }, ...(l.image ? { images: [l.image] } : {}) },
      },
    })),
    payment_intent_data: { description: `Lorenzo Ricci ${args.orderRef}`, metadata: { order_ref: args.orderRef } },
    ...(args.couponId ? { discounts: [{ coupon: args.couponId }] } : {}),
    metadata: { order_ref: args.orderRef, ...(args.metadata ?? {}) },
    success_url: args.successUrl,
    cancel_url: args.cancelUrl,
    locale: args.locale,
    expires_at: Math.floor(Date.now() / 1000) + STRIPE_SESSION_TTL_SECONDS,
  });
  if (!session.url) throw new Error("Stripe returned no checkout url");
  // The one invariant that matters: what Stripe will charge is what the server computed. If they differ (rounding, a
  // discount that did not apply) the session is closed and the order is not taken.
  if (session.amount_total !== toMinor(args.expectedTotal)) {
    await getStripe().checkout.sessions.expire(session.id).catch(() => {});
    throw new Error(`Stripe total ${session.amount_total} != expected ${toMinor(args.expectedTotal)}`);
  }
  return { id: session.id, url: session.url };
}

/** A one-off coupon for an order-level discount (amount in major units); returns its id. */
export async function createOrderCoupon(amountOff: number, currency: "eur" | "ron", name: string): Promise<string> {
  const c = await getStripe().coupons.create({ amount_off: toMinor(amountOff), currency, duration: "once", max_redemptions: 1, name: name.slice(0, 40) });
  return c.id;
}
