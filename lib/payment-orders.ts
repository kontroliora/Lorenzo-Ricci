import type { SupabaseClient } from "@supabase/supabase-js";
import { createCardSession, createOrderCoupon, getStripe, type CardLine } from "./stripe";
import { PENDING_PAYMENT } from "./payments";
import { cancelToken } from "./payment-token";
import { SITE_URL } from "./site";

// Server-side life of a card order: start the Stripe session, move the order to paid, or expire it and give the stock
// back. Every state change is ONE conditional UPDATE (status must still be what we expect), so a repeated webhook, a
// webhook racing the cron, or a double click can never apply twice: only the call that actually moved the row gets it back.

export type OrderRow = Record<string, unknown> & {
  id: number; order_ref: string; status: string; payment_status?: string; payment_method?: string; items?: unknown;
  email?: string | null; name?: string | null; phone?: string | null; city?: string | null; post_code?: string | null; address?: string | null;
  total?: number; subtotal?: number; shipping_cost?: number; shipping_method?: string | null; courier?: string | null; notes?: string | null;
  ship_country?: string | null; promo_code?: string | null; stripe_payment_intent?: string | null; stripe_session_id?: string | null;
  email_marketing_consent?: boolean; sms_marketing_consent?: boolean;
};

type Line = { slug?: unknown; quantity?: unknown; qty?: unknown };

/** Put reserved units back (all lines of the order, gifts included). Never throws: the caller already moved the order. */
export async function restockLines(sb: SupabaseClient, items: unknown): Promise<void> {
  const bySlug = new Map<string, number>();
  for (const it of (Array.isArray(items) ? items : []) as Line[]) {
    const slug = String(it.slug ?? "");
    if (!slug) continue;
    bySlug.set(slug, (bySlug.get(slug) ?? 0) + Math.max(1, Number(it.quantity ?? it.qty ?? 1)));
  }
  if (!bySlug.size) return;
  const { error } = await sb.rpc("restock_wallet_stock", { p_items: [...bySlug].map(([slug, qty]) => ({ slug, qty })) });
  if (error) console.error("[payment] restock failed:", error.message);
}

/** localhost and Vercel previews stay where they are (tests, dev, preview testing in Stripe test mode); every real request uses the canonical public origin. */
export function returnOrigin(requestOrigin: string): string {
  if (process.env.VERCEL_ENV === "preview") return requestOrigin;
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(requestOrigin) ? requestOrigin : SITE_URL;
}

export type StartCard =
  | { ok: true; url: string; sessionId: string }
  | { ok: false; error: string };

/**
 * Open the Stripe Checkout Session of an order that is ALREADY saved as pending_payment with its stock reserved.
 * On any failure the order is cancelled (payment_status 'failed') and the stock is put back, so nothing stays held.
 */
export async function startCardPayment(args: {
  sb: SupabaseClient;
  orderRef: string;
  market: "bg" | "ro";
  lines: CardLine[];
  expectedTotal: number;      // major units, = what the server computed for the order
  discount?: number;          // major units, order-level (bundle + promo)
  customerEmail?: string;
  origin: string;
  metadata?: Record<string, string>;
  heldItems: unknown;         // order.items, for the restock on failure
}): Promise<StartCard> {
  const ro = args.market === "ro";
  const currency = ro ? "ron" : "eur";
  const ref = encodeURIComponent(args.orderRef);
  try {
    const couponId = args.discount && args.discount > 0 ? await createOrderCoupon(args.discount, currency, ro ? "Reducere" : "Отстъпка") : undefined;
    const session = await createCardSession({
      orderRef: args.orderRef,
      currency,
      lines: args.lines,
      customerEmail: args.customerEmail,
      successUrl: `${args.origin}${ro ? "/ro/comanda/finalizata" : "/poruchka/uspeh"}?ref=${ref}&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${args.origin}${ro ? "/ro/comanda/anulata" : "/poruchka/otkazana"}?ref=${ref}&ct=${cancelToken(args.orderRef)}`,
      locale: ro ? "ro" : "bg",
      couponId,
      metadata: args.metadata,
      expectedTotal: args.expectedTotal,
    });
    const { error } = await args.sb.from("orders").update({ stripe_session_id: session.id }).eq("order_ref", args.orderRef);
    if (error) throw new Error(`could not save the session id: ${error.message}`);
    return { ok: true, url: session.url, sessionId: session.id };
  } catch (e) {
    console.error("[payment] could not start the card payment:", e instanceof Error ? e.message : e);
    await expireOrder(args.sb, args.orderRef, "failed");
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export type PaidResult =
  | { kind: "paid"; order: OrderRow; late?: boolean }   // THIS call moved the order to paid: do the side effects now
  | { kind: "already"; order: OrderRow }                 // a duplicate delivery: nothing to do
  | { kind: "refunded"; order: OrderRow }                // paid after the order had expired and the stock was gone: money returned
  | { kind: "unknown" };                                 // no such order

/**
 * Stripe says the money arrived. pending_payment -> new + paid, once. A payment that arrives after the order expired
 * (stock already released) re-reserves the stock; if that is impossible the payment is refunded.
 */
export async function markOrderPaid(sb: SupabaseClient, ref: string, info: { paymentIntent?: string | null; sessionId?: string | null }): Promise<PaidResult> {
  const nowIso = new Date().toISOString();
  const patch = {
    status: "new", payment_status: "paid", paid_at: nowIso,
    ...(info.paymentIntent ? { stripe_payment_intent: info.paymentIntent } : {}),
    ...(info.sessionId ? { stripe_session_id: info.sessionId } : {}),
  };
  const moved = await sb.from("orders").update(patch).eq("order_ref", ref).eq("status", PENDING_PAYMENT).select("*");
  if (moved.error) throw new Error(moved.error.message);
  if (moved.data?.length) return { kind: "paid", order: moved.data[0] as OrderRow };

  const cur = await sb.from("orders").select("*").eq("order_ref", ref).maybeSingle();
  if (cur.error) throw new Error(cur.error.message);
  const row = cur.data as OrderRow | null;
  if (!row) return { kind: "unknown" };
  if (row.payment_status === "paid") return { kind: "already", order: row };

  if (row.status === "cancelled" && (row.payment_status === "expired" || row.payment_status === "failed")) {
    // The customer paid after we gave the stock back. Take it again if it is still there, else return the money.
    const lines = (Array.isArray(row.items) ? row.items : []) as Line[];
    const items = lines.filter((l) => l.slug).map((l) => ({ slug: String(l.slug), qty: Math.max(1, Number(l.quantity ?? l.qty ?? 1)) }));
    const { data: res, error } = await sb.rpc("reserve_wallet_stock", { p_items: items });
    if (!error && !(res && (res as { ok?: boolean }).ok === false)) {
      const back = await sb.from("orders").update({ ...patch, cancel_category: null, cancel_reason: null }).eq("order_ref", ref).eq("status", "cancelled").select("*");
      if (back.data?.length) return { kind: "paid", order: back.data[0] as OrderRow, late: true };
      await restockLines(sb, row.items); // somebody else moved it meanwhile: do not hold the units twice
      return { kind: "already", order: row };
    }
    if (info.paymentIntent) {
      await getStripe().refunds.create({ payment_intent: info.paymentIntent });
      const done = await sb.from("orders").update({ payment_status: "refunded", stripe_payment_intent: info.paymentIntent }).eq("order_ref", ref).select("*");
      return { kind: "refunded", order: (done.data?.[0] ?? row) as OrderRow };
    }
  }
  return { kind: "already", order: row };
}

/**
 * The payment will not happen (session expired / failed): cancel the pending order and put the stock back. Returns the
 * order only when THIS call did the cancelling.
 */
export async function expireOrder(sb: SupabaseClient, ref: string, status: "expired" | "failed" = "expired"): Promise<OrderRow | null> {
  const moved = await sb.from("orders")
    .update({ status: "cancelled", payment_status: status, cancel_category: "other", cancel_reason: "Плащането с карта не беше завършено" })
    .eq("order_ref", ref).eq("status", PENDING_PAYMENT).select("*");
  if (moved.error) { console.error("[payment] expire failed:", moved.error.message); return null; }
  const row = (moved.data?.[0] ?? null) as OrderRow | null;
  if (row) await restockLines(sb, row.items);
  return row;
}
