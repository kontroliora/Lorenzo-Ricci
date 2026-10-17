import type { SupabaseClient } from "@supabase/supabase-js";
import { createCardSession, createOrderCoupon, getStripe, type CardLine } from "./stripe";
import { PENDING_PAYMENT } from "./payments";
import { cancelToken } from "./payment-token";
import { SITE_URL } from "./site";
import { alertTeam, notifyPaidOnce } from "./payment-notify";

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

type Line = { slug?: unknown; quantity?: unknown; qty?: unknown; gift?: unknown };
type Reserve = { slug: string; qty: number }[];

const isGift = (l: Line): boolean => l.gift === true;
/** Lines -> one entry per slug (the stock RPC checks entries one by one, so duplicates must be merged first). */
function reserveItems(lines: Line[]): Reserve {
  const bySlug = new Map<string, number>();
  for (const it of lines) {
    const slug = String(it.slug ?? "");
    if (!slug) continue;
    bySlug.set(slug, (bySlug.get(slug) ?? 0) + Math.max(1, Number(it.quantity ?? it.qty ?? 1)));
  }
  return [...bySlug].map(([slug, qty]) => ({ slug, qty }));
}

/** Put units back. Never throws (the caller already moved the order), but a failure is loud: the stock would leak for good. */
async function restock(sb: SupabaseClient, items: Reserve, what: string): Promise<void> {
  if (!items.length) return;
  const { error } = await sb.rpc("restock_wallet_stock", { p_items: items });
  if (error) {
    console.error("[payment] restock failed:", error.message);
    await alertTeam(`Наличността НЕ се върна - ${what}`, `restock_wallet_stock даде грешка: ${error.message}\nБройки: ${JSON.stringify(items)}\nВърни ги ръчно.`);
  }
}

/** Put reserved units back (all lines of the order, gifts included). Never throws: the caller already moved the order. */
export async function restockLines(sb: SupabaseClient, items: unknown): Promise<void> {
  await restock(sb, reserveItems((Array.isArray(items) ? items : []) as Line[]), "поръчка с карта");
}

/** Single-use promo code of an open card order: true only for the ONE caller that flips it (atomic in the database). */
export async function claimPromo(sb: SupabaseClient, code: string): Promise<boolean> {
  const { data, error } = await sb.rpc("promo_mark_used", { p_code: code });
  if (error) throw new Error(`promo claim failed: ${error.message}`);
  return data === true;
}

/** The order that claimed the code did not get paid: the code is usable again. */
export async function releasePromo(sb: SupabaseClient, code: string): Promise<void> {
  const { error } = await sb.rpc("promo_release", { p_code: code });
  if (error) {
    console.error("[payment] promo release failed:", error.message);
    await alertTeam(`Промо кодът не се освободи - ${code}`, `promo_release даде грешка: ${error.message} (пусни supabase/stripe_payments.sql?). Кодът остава „използван" - върни го ръчно, ако клиентът не е платил.`);
  }
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
  discount?: number;          // major units, order-level (set + promo + card discount)
  discountLabel?: string;     // the name of that discount line on the Stripe page (default "Отстъпка" / "Reducere")
  customerEmail?: string;
  origin: string;
  metadata?: Record<string, string>;
  heldItems: unknown;         // order.items, for the restock on failure
}): Promise<StartCard> {
  const ro = args.market === "ro";
  const currency = ro ? "ron" : "eur";
  const ref = encodeURIComponent(args.orderRef);
  try {
    const couponId = args.discount && args.discount > 0 ? await createOrderCoupon(args.discount, currency, args.discountLabel ?? (ro ? "Reducere" : "Отстъпка")) : undefined;
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
  | { kind: "already"; order: OrderRow }                 // a duplicate delivery: nothing to move (the caller may still owe the notifications)
  | { kind: "refunded"; order: OrderRow }                // paid after the order had expired and the stock was gone: money returned
  | { kind: "mismatch"; order: OrderRow }                // the event's session is not the session of this order (reference collision)
  | { kind: "unknown" };                                 // no such order

const readOrder = async (sb: SupabaseClient, ref: string): Promise<OrderRow | null> => {
  const { data, error } = await sb.from("orders").select("*").eq("order_ref", ref).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as OrderRow | null) ?? null;
};

/**
 * Stripe says the money arrived. pending_payment -> confirmed + paid, once. A card order is paid in advance: nobody has to phone the
 * customer to confirm it, so it goes straight to "За изпълнение" (status confirmed, call_state confirmed), never to "За обаждане". A payment that arrives after the order expired
 * (stock already released) re-reserves the stock; if that is impossible the payment is refunded. A database error on the
 * way THROWS (the webhook answers 500 and Stripe retries): money is only ever refunded for a real shortfall.
 */
export async function markOrderPaid(sb: SupabaseClient, ref: string, info: { paymentIntent?: string | null; sessionId?: string | null }): Promise<PaidResult> {
  const first = await readOrder(sb, ref);
  if (!first) return { kind: "unknown" };
  // The event must belong to the session this order opened: a reference that collided with another order never flips it.
  if (info.sessionId && first.stripe_session_id && first.stripe_session_id !== info.sessionId) return { kind: "mismatch", order: first };

  const nowIso = new Date().toISOString();
  const patch = {
    status: "confirmed", call_state: "confirmed", payment_status: "paid", paid_at: nowIso,
    ...(info.paymentIntent ? { stripe_payment_intent: info.paymentIntent } : {}),
    ...(info.sessionId ? { stripe_session_id: info.sessionId } : {}),
  };
  const moved = await sb.from("orders").update(patch).eq("order_ref", ref).eq("status", PENDING_PAYMENT).select("*");
  if (moved.error) throw new Error(moved.error.message);
  if (moved.data?.length) return { kind: "paid", order: moved.data[0] as OrderRow };

  const row = (await readOrder(sb, ref)) ?? first;
  if (row.payment_status === "paid") return { kind: "already", order: row };

  if (row.status === "cancelled" && (row.payment_status === "expired" || row.payment_status === "failed")) {
    // The customer paid after we gave the stock back. Take the PAID lines again if they are still there, else return the money.
    const lines = (Array.isArray(row.items) ? row.items : []) as Line[];
    const paidItems = reserveItems(lines.filter((l) => !isGift(l)));
    const { data: res, error } = await sb.rpc("reserve_wallet_stock", { p_items: paidItems });
    if (error) throw new Error(`late payment ${ref}: stock check failed: ${error.message}`);

    if (res && (res as { ok?: boolean }).ok === false) {
      const now = (await readOrder(sb, ref)) ?? row;
      if (now.payment_status === "paid") return { kind: "already", order: now };          // another delivery has just paid it
      const pi = info.paymentIntent ?? now.stripe_payment_intent ?? null;
      if (!pi) return { kind: "already", order: now };
      await getStripe().refunds.create({ payment_intent: pi }, { idempotencyKey: `late-refund-${ref}-${pi}` });
      const done = await sb.from("orders").update({ payment_status: "refunded", stripe_payment_intent: pi })
        .eq("order_ref", ref).eq("status", "cancelled").in("payment_status", ["expired", "failed"]).select("*");
      return { kind: "refunded", order: (done.data?.[0] ?? now) as OrderRow };
    }

    const back = await sb.from("orders").update({ ...patch, cancel_category: null, cancel_reason: null })
      .eq("order_ref", ref).eq("status", "cancelled").in("payment_status", ["expired", "failed"]).select("*");
    if (!back.data?.length) {
      await restock(sb, paidItems, `късно плащане ${ref}`); // somebody else moved it meanwhile: do not hold the units twice
      return { kind: "already", order: (await readOrder(sb, ref)) ?? row };
    }
    let order = back.data[0] as OrderRow;

    // The gift is best effort: it never blocks (or refunds) paid goods. If it is gone, the line is dropped from the order.
    const gifts = reserveItems(lines.filter(isGift));
    if (gifts.length) {
      const g = await sb.rpc("reserve_wallet_stock", { p_items: gifts });
      if (g.error || (g.data && (g.data as { ok?: boolean }).ok === false)) {
        const kept = lines.filter((l) => !isGift(l));
        const upd = await sb.from("orders").update({ items: kept }).eq("order_ref", ref).select("*");
        if (upd.data?.length) order = upd.data[0] as OrderRow;
        await alertTeam(`Късно плащане: подаръкът свърши - ${ref}`, "Платените стоки са налични и поръчката е възстановена, но подаръкът вече го няма и е махнат от поръчката. Уведоми клиента.");
      }
    }
    // The single-use promo code was given back when the order expired: take it again (or tell the team it is gone).
    if (order.promo_code && order.payment_method === "card") {
      const ok = await claimPromo(sb, String(order.promo_code)).catch(() => false);
      if (!ok) await alertTeam(`Промо код вече е използван - ${ref}`, `Късното плащане върна поръчката, но кодът ${order.promo_code} вече е използван от друга поръчка.`);
    }
    return { kind: "paid", order, late: true };
  }
  return { kind: "already", order: row };
}

/**
 * The payment will not happen (session expired / failed): cancel the pending order and put the stock back (and the
 * single-use promo code it claimed). Returns the order only when THIS call did the cancelling.
 */
export async function expireOrder(sb: SupabaseClient, ref: string, status: "expired" | "failed" = "expired"): Promise<OrderRow | null> {
  const moved = await sb.from("orders")
    .update({ status: "cancelled", payment_status: status, cancel_category: "other", cancel_reason: "Плащането с карта не беше завършено" })
    .eq("order_ref", ref).eq("status", PENDING_PAYMENT).select("*");
  if (moved.error) { console.error("[payment] expire failed:", moved.error.message); return null; }
  const row = (moved.data?.[0] ?? null) as OrderRow | null;
  if (row) {
    await restockLines(sb, row.items);
    if (row.promo_code && row.payment_method === "card") await releasePromo(sb, String(row.promo_code));
  }
  return row;
}

/**
 * Stripe refunded the WHOLE payment. The order is marked refunded, and when it has not left the warehouse yet it is
 * cancelled and its stock goes back (once: the cancel is one conditional UPDATE). A shipped order only gets the mark.
 */
export async function markOrderRefunded(sb: SupabaseClient, paymentIntent: string): Promise<{ order: OrderRow; cancelled: boolean } | null> {
  const marked = await sb.from("orders").update({ payment_status: "refunded" }).eq("stripe_payment_intent", paymentIntent).neq("payment_status", "refunded").select("*");
  if (marked.error) throw new Error(marked.error.message);
  const row = (marked.data?.[0] ?? null) as OrderRow | null;
  if (!row) return null; // unknown payment, or this refund was already processed
  if (row.status === "new" || row.status === "confirmed") {
    const c = await sb.from("orders").update({ status: "cancelled", cancel_category: "other", cancel_reason: "Плащането е върнато в Stripe" })
      .eq("id", row.id).in("status", ["new", "confirmed"]).select("*");
    if (c.data?.length) { await restockLines(sb, row.items); return { order: c.data[0] as OrderRow, cancelled: true }; }
  }
  return { order: row, cancelled: false };
}

/**
 * An order is still pending_payment although its time is up (the cancel link, the sweep): ask Stripe what became of the
 * session and settle the order accordingly.
 *   paid            -> marked paid after all, notifications follow
 *   open            -> the session is expired at Stripe, the order is cancelled (stock back)
 *   complete+unpaid -> an asynchronous payment is still in flight: the order is left untouched
 *   not found       -> the session does not exist at Stripe (another account / key): the order is cancelled
 */
export type PendingSettled = { result: "paid" | "released" | "already-handled" | "in-flight"; released: boolean; paid: boolean };

export async function settlePending(sb: SupabaseClient, ref: string, sessionId: string | null | undefined, meta: Record<string, string> = {}): Promise<PendingSettled> {
  if (!sessionId) {
    const row = await expireOrder(sb, ref, "failed");
    return { result: row ? "released" : "already-handled", released: !!row, paid: false };
  }
  const stripe = getStripe();
  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch (e) {
    const err = e as { statusCode?: number; code?: string };
    if (err.statusCode === 404 || err.code === "resource_missing") {
      const row = await expireOrder(sb, ref, "expired");
      return { result: row ? "released" : "already-handled", released: !!row, paid: false };
    }
    throw e;
  }
  if (session.status === "open") session = await stripe.checkout.sessions.expire(sessionId);
  if (session.payment_status === "paid") {
    const pi = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;
    const r = await markOrderPaid(sb, ref, { paymentIntent: pi, sessionId: session.id });
    if (r.kind === "paid" || r.kind === "already") await notifyPaidOnce(sb, ref, { ...(session.metadata ?? {}), ...meta });
    return { result: "paid", released: false, paid: true };
  }
  if (session.status === "complete") return { result: "in-flight", released: false, paid: false };   // asynchronous payment pending
  const row = await expireOrder(sb, ref, "expired");
  return { result: row ? "released" : "already-handled", released: !!row, paid: false };
}
