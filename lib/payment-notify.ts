import { supabaseAdmin } from "./supabase-admin";
import type { OrderRow } from "./payment-orders";
import { buildAdminEmail, buildCustomerEmail, sendAdminEmail, sendCustomerEmail, sendCapiPurchase } from "./order-notify";
import { buildRoAdminEmail, buildRoCustomerEmail, roPaidSubject, type RoOrderEmailData } from "./ro/emails";
import { RO_ADMIN_RECIPIENTS, sendMail, sendCapiPurchase as sendRoCapiPurchase } from "./ro/order-notify";

// What happens ONCE when a card order turns PAID (called only by the call that really moved the order): the customer's
// "paid by card" e-mail, the team e-mail, the Meta Purchase (event id = order reference, the browser sends the twin from
// the success page) and the bookkeeping the cash-on-delivery path does at order time (promo code used, cart converted).
// Every step is best effort: the order is already paid and saved.

type Line = { name?: string; sku?: string; slug?: string; quantity?: number; qty?: number; price?: number; currency?: string; gift?: boolean };

export async function notifyPaid(order: OrderRow, meta: Record<string, string> = {}): Promise<void> {
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
    const r = await Promise.allSettled([
      sendMail({ from: "Lorenzo Ricci Orders <orders@lorenzo-ricci.com>", to: RO_ADMIN_RECIPIENTS, subject: `💳🇷🇴 Платена поръчка (Румъния) - ${name} - ${order.order_ref}`, html: buildRoAdminEmail(data, undefined, { paidByCard: true }) }),
      ...(email ? [sendMail({ from: "Lorenzo Ricci <info@lorenzo-ricci.com>", to: [email], subject: roPaidSubject, html: buildRoCustomerEmail(data, { paidByCard: true }) })] : []),
      sendRoCapiPurchase({ ...data, skus: paidLines.map((i) => String(i.sku ?? "")).filter(Boolean) }, ctx),
    ]);
    r.forEach((x) => { if (x.status === "rejected") console.error("[payment-notify] RO step failed:", x.reason); });
    return;
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
  const r = await Promise.allSettled([
    sendAdminEmail(`💳 Платена поръчка - ${name}`, buildAdminEmail(orderObj, null, { paidByCard: true })),
    ...(email ? [sendCustomerEmail(email, buildCustomerEmail(orderObj, { paidByCard: true }), "Плащането е получено - Lorenzo Ricci")] : []),
    sendCapiPurchase({ ...orderObj, items: paidLines }, order.order_ref, Number(order.total ?? 0), ctx),
  ]);
  r.forEach((x) => { if (x.status === "rejected") console.error("[payment-notify] BG step failed:", x.reason); });

  const sb = supabaseAdmin();
  if (order.promo_code) {
    try { await sb.rpc("promo_mark_used", { p_code: order.promo_code }); } catch (e) { console.error("[payment-notify] promo redeem failed:", e); }
  }
  if (meta.cart_session) {
    try {
      await sb.from("cart_sessions").update({ status: "converted", converted_at: new Date().toISOString() }).eq("session_id", meta.cart_session).eq("status", "pending");
    } catch { /* best effort */ }
  }
}

/** A short e-mail to the team when something about a payment needs a human (refund, amount mismatch ...). */
export async function alertTeam(subject: string, text: string): Promise<void> {
  try {
    await sendAdminEmail(`🚨 ${subject}`, `<div style="font-family:Arial,sans-serif;font-size:14px;padding:20px;color:#111"><h3 style="margin:0 0 10px">${subject}</h3><pre style="white-space:pre-wrap;font:13px/1.5 Menlo,monospace">${text.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</pre></div>`);
  } catch (e) { console.error("[payment-notify] alert e-mail failed:", e); }
}
