// Card payments (Stripe Checkout) next to cash on delivery. Pure constants and helpers, safe to import anywhere.
//
// CONTRACT (the order routes, the webhook, the checkout forms and the panel all rely on it):
//
// 1. Order request: POST /api/order (Bulgaria, EUR) and POST /api/order-ro (Romania, lei) accept an extra field
//      "paymentMethod": "cod" | "card"        (missing = "cod", behaviour unchanged)
//    Card orders pay the same delivery as cash on delivery (BG lib/shipping-rules.ts, RO lib/ro/pricing.ts) and get 5% off the goods
//    (lib/card-discount.ts): the client sends shipping.cost, cardDiscount and total, the server recomputes all three and refuses any other number.
// 2. Card response: 200 { success: true, paymentMethod: "card", orderRef, checkoutUrl }  -> the browser must NOT clear the
//    cart or fire Purchase; it stores sessionStorage "lr_pending_order" = orderRef and goes to checkoutUrl
//    (window.location.assign). Errors keep the existing shape { success: false, code?, error } (409 price/stock, 503 ...).
// 3. Return pages (Stripe success_url / cancel_url):
//      Bulgaria:  /poruchka/uspeh?ref=<orderRef>&session_id=<id>      /poruchka/otkazana?ref=<orderRef>
//      Romania:   /ro/comanda/finalizata?ref=<orderRef>&session_id=<id>   /ro/comanda/anulata?ref=<orderRef>
//    The success page polls GET /api/order-payment?ref=<orderRef>&session_id=<id> every 2 s (max 60 s):
//      -> { status: "paid" | "pending" | "expired" | "unknown",
//           // only when paid:
//           total: number, currency: "EUR" | "RON", items: [{ sku, quantity }] }
//    On "paid" it clears the cart and fires the browser Purchase ONCE (sessionStorage guard per ref), with
//    event id = orderRef (the webhook sends the matching server-side CAPI Purchase). "pending" after 60 s: tell the customer
//    the payment is being confirmed and that an e-mail follows. "expired": the payment was not completed.
// 4. Database (supabase/stripe_payments.sql): orders.payment_method 'cod'|'card', orders.payment_status
//    'unpaid'|'pending'|'paid'|'expired'|'failed'|'refunded', orders.paid_at, orders.status 'pending_payment' while a card
//    payment is open (stock reserved, order hidden from the fulfilment board and from every Econt flow). When the money arrives the
//    order becomes 'confirmed' + 'paid' (no call needed: it shows under "За изпълнение" with the "Карта · платено" badge, never under "За обаждане").
// 5. Courier: a paid card order is collected as 0 (nothing is collected on delivery).

/**
 * The card option is switched on with NEXT_PUBLIC_CARD_PAYMENTS=1 (Vercel env, then redeploy). Until then the checkout
 * shows cash on delivery only and the order routes refuse card requests, so this code can be deployed "dark" and
 * enabled once Stripe and supabase/stripe_payments.sql are in place.
 */
export const CARD_PAYMENTS_ENABLED = process.env.NEXT_PUBLIC_CARD_PAYMENTS === "1";

export type PaymentMethod = "cod" | "card";
export type PaymentStatus = "unpaid" | "pending" | "paid" | "expired" | "failed" | "refunded";

/** orders.status while a card payment is open (stock reserved, not yet a real order). */
export const PENDING_PAYMENT = "pending_payment";

/** How long stock is held for an unpaid card order. Stripe's minimum session lifetime is 30 min; we add 2 minutes of slack (clock skew). */
export const CARD_HOLD_MINUTES = 30;
export const STRIPE_SESSION_TTL_SECONDS = (CARD_HOLD_MINUTES + 2) * 60;

export const isCard = (o: { payment_method?: string | null }): boolean => o.payment_method === "card";
export const isPaidCard = (o: { payment_method?: string | null; payment_status?: string | null }): boolean => isCard(o) && o.payment_status === "paid";
/** Money already taken by Stripe: paid card order, or ANY order with a paid Stripe payment on it. The courier must collect 0. */
export const hasCardMoney = (o: { payment_method?: string | null; payment_status?: string | null; stripe_payment_intent?: string | null }): boolean =>
  isPaidCard(o) || (o.payment_status === "paid" && !!o.stripe_payment_intent);
/** Inconsistent: a card order that is live (new / confirmed / shipped / completed) but has no paid card payment. Never ship it as COD. */
export const cardMoneyMissing = (o: { status?: string | null; payment_method?: string | null; payment_status?: string | null; stripe_payment_intent?: string | null }): boolean =>
  isCard(o) && !hasCardMoney(o) && ["new", "confirmed", "shipped", "completed"].includes(String(o.status ?? ""));

/** Money to Stripe's smallest unit (cents / bani). All amounts in this shop have at most 2 decimals. */
export const toMinor = (amount: number): number => Math.round(amount * 100);

export const PENDING_ORDER_KEY = "lr_pending_order";
