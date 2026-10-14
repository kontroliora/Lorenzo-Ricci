import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "./supabase-admin";
import type { OrderRow } from "./payment-orders";
import { buildAdminEmail, buildCustomerEmail, sendAdminEmail, sendCustomerEmail, sendCapiPurchase } from "./order-notify";
import { buildRoAdminEmail, buildRoCustomerEmail, roPaidSubject, type RoOrderEmailData } from "./ro/emails";
import { RO_ADMIN_RECIPIENTS, sendMail, sendCapiPurchase as sendRoCapiPurchase } from "./ro/order-notify";

// What happens ONCE when a card order turns PAID (called only by the call that really moved the order): the customer's
// "paid by card" e-mail, the team e-mail, the Meta Purchase (event id = order reference, the browser sends the twin from
// the success page) and the bookkeeping the cash-on-delivery path does at order time (promo code used, cart converted).
// Every step is best effort: the order is already paid and saved. notifyPaidOnce() is the entry point: it claims the job
// in the database (so a repeated webhook, the sweep and the cancel route can never send twice) and marks it done.

type Line = { name?: string; sku?: string; slug?: string; quantity?: number; qty?: number; price?: number; currency?: string; gift?: boolean };

const STEP_TIMEOUT_MS = 10_000;
const within = <T,>(p: Promise<T>, name: string): Promise<T> =>
  Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`${name}: timeout after ${STEP_TIMEOUT_MS} ms`)), STEP_TIMEOUT_MS))]);

/** Runs every step; returns the names of the steps that FAILED (nothing is thrown: the order is already paid). */
export async function notifyPaid(order: OrderRow, meta: Record<string, string> = {}): Promise<string[]> {
  const items = (Array.isArray(order.items) ? order.items : []) as Line[];
  const paidLines = items.filter((i) => !i.gift);
  const ctx = { ip: meta.client_ip, userAgent: meta.client_ua, fbc: meta.fbc, fbp: meta.fbp };
  const name = String(order.name ?? "");
  const email = String(order.email ?? "");

  if (order.ship_country === "RO") {
    const data: RoOrderEmailData = {
      orderRef: order.order_ref,
      customer: { name, phone: String(order.phone ?? ""), email, city: String(order.city ?? ""), address: String(order.address ?? ""), postCode: String(order.post_code ?? ""), notes: String(order.notes ?? "") },
      items: items.map((i) => ({ name: i.name, sku: i.sku, quantity: i.quantity ?? i.qty ?? 1, price: i.price })),
      subtotal: Number(order.subtotal ?? 0),
      // the order stores goods AFTER the set discount; the discount itself is what the lines add up to above that
      discount: Math.max(0, items.reduce((s, i) => s + Number(i.price ?? 0) * Number(i.quantity ?? i.qty ?? 1), 0) - Number(order.subtotal ?? 0)),
      shippingCost: Number(order.shipping_cost ?? 0),
      total: Number(order.total ?? 0),
    };
    const names = ["team e-mail", ...(email ? ["customer e-mail"] : []), "Meta Purchase"];
    const r = await Promise.allSettled([
      within(sendMail({ from: "Lorenzo Ricci Orders <orders@lorenzo-ricci.com>", to: RO_ADMIN_RECIPIENTS, subject: `💳🇷🇴 Платена поръчка (Румъния) - ${name} - ${order.order_ref}`, html: buildRoAdminEmail(data, undefined, { paidByCard: true }) }), "team e-mail"),
      ...(email ? [within(sendMail({ from: "Lorenzo Ricci <info@lorenzo-ricci.com>", to: [email], subject: roPaidSubject, html: buildRoCustomerEmail(data, { paidByCard: true }) }), "customer e-mail")] : []),
      within(sendRoCapiPurchase({ ...data, skus: paidLines.map((i) => String(i.sku ?? "")).filter(Boolean) }, ctx), "Meta Purchase"),
    ]);
    const failed: string[] = [];
    r.forEach((x, i) => { if (x.status === "rejected") { console.error("[payment-notify] RO step failed:", x.reason); failed.push(names[i]); } });
    return failed;
  }

  // Bulgaria: rebuild the order object the e-mail builders expect from the saved row.
  const orderObj: Record<string, unknown> = {
    orderRef: order.order_ref,
    customer: { name, phone: order.phone, email, city: order.city, postCode: order.post_code, officeAddress: order.address, shippingMethod: order.shipping_method, courier: order.courier, notes: order.notes },
    shipping: { method: order.shipping_method, cost: Number(order.shipping_cost ?? 0) },
    items,
    total: Number(order.total ?? 0),
    subtotal: Number(order.subtotal ?? 0),
  };
  const names = ["team e-mail", ...(email ? ["customer e-mail"] : []), "Meta Purchase"];
  const r = await Promise.allSettled([
    within(sendAdminEmail(`💳 Платена поръчка - ${name}`, buildAdminEmail(orderObj, null, { paidByCard: true })), "team e-mail"),
    ...(email ? [within(sendCustomerEmail(email, buildCustomerEmail(orderObj, { paidByCard: true }), "Плащането е получено - Lorenzo Ricci"), "customer e-mail")] : []),
    within(sendCapiPurchase({ ...orderObj, items: paidLines }, order.order_ref, Number(order.total ?? 0), ctx), "Meta Purchase"),
  ]);
  const failed: string[] = [];
  r.forEach((x, i) => { if (x.status === "rejected") { console.error("[payment-notify] BG step failed:", x.reason); failed.push(names[i]); } });

  // The single-use promo code was claimed when the order was created (a card order holds it while it waits for the payment).
  if (meta.cart_session) {
    try {
      await supabaseAdmin().from("cart_sessions").update({ status: "converted", converted_at: new Date().toISOString() }).eq("session_id", meta.cart_session).eq("status", "pending");
    } catch { /* best effort */ }
  }
  return failed;
}

const LEASE_MINUTES = 10;

/**
 * Send the "paid" notifications of an order exactly once. The claim is one conditional UPDATE (notify_claimed_at), so the
 * webhook, its retries, the daily sweep and the cancel route can all call this safely; notified_at marks it done. A claim
 * older than LEASE_MINUTES (the function died mid-way) can be taken over. Throws only on a database error (the caller retries).
 */
export async function notifyPaidOnce(sb: SupabaseClient, ref: string, meta: Record<string, string> = {}): Promise<"sent" | "skipped"> {
  const lease = new Date(Date.now() - LEASE_MINUTES * 60_000).toISOString();
  const claimed = await sb.from("orders").update({ notify_claimed_at: new Date().toISOString() })
    .eq("order_ref", ref).eq("payment_status", "paid").is("notified_at", null)
    .or(`notify_claimed_at.is.null,notify_claimed_at.lt.${lease}`).select("*");
  if (claimed.error) throw new Error(`notify claim failed: ${claimed.error.message}`);
  const order = claimed.data?.[0] as OrderRow | undefined;
  if (!order) return "skipped";
  const failed = await notifyPaid(order, meta);
  const done = await sb.from("orders").update({ notified_at: new Date().toISOString() }).eq("order_ref", ref);
  if (done.error) console.error("[payment-notify] could not mark notified:", done.error.message);
  if (failed.length) await alertTeam(`Платено, но не всичко излезе - ${ref}`, `Не се изпратиха: ${failed.join(", ")}. Поръчката е платена и записана: прати ги ръчно (клиентски имейл, Meta).`);
  return "sent";
}

/** A short e-mail to the team when something about a payment needs a human (refund, amount mismatch ...). */
const escHtml = (t: string): string => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function alertTeam(subject: string, text: string): Promise<void> {
  try {
    await sendAdminEmail(`🚨 ${subject}`, `<div style="font-family:Arial,sans-serif;font-size:14px;padding:20px;color:#111"><h3 style="margin:0 0 10px">${escHtml(subject)}</h3><pre style="white-space:pre-wrap;font:13px/1.5 Menlo,monospace">${escHtml(text)}</pre></div>`);
  } catch (e) { console.error("[payment-notify] alert e-mail failed:", e); }
}
