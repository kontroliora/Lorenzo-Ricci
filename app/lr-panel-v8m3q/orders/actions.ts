"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminDb, getAdminSession } from "@/lib/supabase/admin-db";
import { applyOfMark } from "@/lib/partner/marks";
import { reconcileShippedOrders, matchTrackingNumbers, classifyExistingReturns, markRestocked as markRestockedTx, econtCodAmount, type MatchResult } from "@/lib/econt";
import { sendShipConfirmations } from "@/lib/shipment-notify";
import { RESERVING_STATUSES, isReturn, type OrderItem } from "@/lib/orders";
import { isRoOrder } from "@/lib/market";
import { sendRoPanelMail, type RoPanelMail } from "@/lib/ro/panel-mail";
import { getStripe } from "@/lib/stripe";
import { isPaidCard, hasCardMoney, cardMoneyMissing } from "@/lib/payments";
import { refundPlan, isMissingStripeObject } from "@/lib/stripe-mode";
import { fmtRON, roTrackUrl } from "@/lib/ro/config";
import { refreshStockPages } from "@/lib/stock-pages";
import { CONFIRM_REQUEST_AUTO, sendConfirmRequest } from "@/lib/confirm-request";
import { allProducts } from "@/lib/products";
import { getPriceOverrides, applyOverrides } from "@/lib/price-overrides";
import { calcBundleDiscount } from "@/lib/bundles";
import { fulfillmentVisible } from "@/lib/fulfillment-filter";
import { createEcontLabel, cancelEcontLabel, labelMode, promoteAcceptedLabels } from "@/lib/econt-shipping";
import { lockCheck, CHANGED_JUST_NOW } from "@/lib/order-conflict";

const ORDERS_PATH = "/lr-panel-v8m3q/orders";

// Fulfillment role: an order hidden from the board (jewelry-only, lib/fulfillment-filter.ts) is "not found" for every action too.
async function fulfillmentBlock(ids: number[]): Promise<string | null> {
  const session = await getAdminSession();
  if (session?.role !== "fulfillment") return null;
  const want = [...new Set(ids)];
  if (!want.length) return null;
  const { data, error } = await (await adminDb()).from("orders").select("id, items, source_site").in("id", want);
  if (error) return "Поръчката не е намерена.";
  const rows = (data ?? []) as { items: OrderItem[] | null; source_site: string | null }[];
  return rows.length === want.length && rows.every(fulfillmentVisible) ? null : "Поръчката не е намерена.";
}

// token: the row's updated_at from lockCheck - the write only lands while nobody changed the order since (optimistic lock).
async function patchOrder(id: number, patch: Record<string, unknown>, token?: string | null): Promise<string | null> {
  const supabase = await adminDb();
  let q = supabase.from("orders").update(patch).eq("id", id);
  if (token) q = q.eq("updated_at", token);
  const { data, error } = await q.select("id");
  if (error) {
    console.error("[orders] update error:", error.message);
    return error.message;
  }
  if (token && !data?.length) return CHANGED_JUST_NOW;
  revalidatePath(ORDERS_PATH);
  return null;
}

// ── Optimistic lock (lib/order-conflict.ts): `expected` = the updated_at the board showed. ──
async function guard(id: number, expected?: string | null): Promise<{ token: string | null; conflict: string | null }> {
  if (!expected) return { token: null, conflict: null };
  const me = await getAdminSession();
  return lockCheck(await adminDb(), id, expected, me?.email ?? null);
}

// ── Econt labels (lib/econt-shipping.ts) ──
// Confirmed -> the label is made right after the answer goes back (the board's polling shows it a few seconds later).
function autoLabels(supabase: SupabaseClient, ids: number[]): void {
  if (labelMode() === "off" || !ids.length) return;
  after(async () => {
    for (const id of ids) {
      const r = await createEcontLabel(supabase, id).catch((e) => ({ ok: false as const, error: String(e) }));
      if (!r.ok) console.warn("[orders] auto label", id, r.error);
    }
  });
}
// Cancelled -> its label is deleted in Econt (only while Econt has not taken the parcel). Returns a line for the card, or null.
async function cancelLabels(supabase: SupabaseClient, ids: number[]): Promise<string | null> {
  const msgs: string[] = [];
  for (const id of ids) {
    const r = await cancelEcontLabel(supabase, id).catch((e) => ({ ok: false, message: String(e), state: "error" as const }));
    if (r.message) msgs.push(r.message);
  }
  return msgs.length ? msgs.join(" ") : null;
}
const joinMsgs = (...m: (string | null | undefined)[]): string | null => m.filter(Boolean).join(" ") || null;

// Unified model: EVERY item is decremented from wallet_inventory at order time,
// so a cancel/return must put the units back — else the counter only drifts down.
// Called only when the order was actually holding stock (HOLDS_STOCK guard →
// prevents a double-restock on re-cancel). restock_wallet_stock skips any slug
// not present in wallet_inventory.
async function restockOrderItems(
  supabase: SupabaseClient,
  items: OrderItem[] | null | undefined,
): Promise<void> {
  const restock = (items ?? [])
    .map((it) => ({ slug: String(it.slug ?? ""), qty: Math.max(1, Number(it.quantity ?? it.qty ?? 1)) }))
    .filter((x) => x.slug);
  if (!restock.length) return;
  const { error } = await supabase.rpc("restock_wallet_stock", { p_items: restock });
  if (error) console.error("[orders] restock_wallet_stock error:", error.message);
  else await refreshStockPages(restock, "restocked");
}

const HOLDS_STOCK = (status: string) => (RESERVING_STATUSES as readonly string[]).includes(status);

// ── Romanian orders share this board with the Bulgarian ones. Every action that changes a Romanian order also sends the customer a
// Romanian e-mail (lib/ro/panel-mail.ts), but only when the order really moves into that state (a repeated click mails nobody) and
// never for a Bulgarian order. A mail problem never undoes the status change: it is returned as a warning text for the card. ─────
type Snap = {
  id: number; status: string; items: OrderItem[]; ship_country: string | null; order_ref: string | null; total?: number | null;
  payment_method?: string | null; payment_status?: string | null; stripe_payment_intent?: string | null; stripe_session_id?: string | null;
  created_at?: string | null;
};

async function snapshot(supabase: SupabaseClient, ids: number[]): Promise<Snap[]> {
  if (!ids.length) return [];
  const { data } = await supabase.from("orders").select("*").in("id", ids); // * : the payment columns exist only after stripe_payments.sql
  return (data ?? []) as Snap[];
}

// A card payment that was refunded in Stripe: the order must not be confirmed or shipped (the webhook already cancels an
// unshipped one; this stops a stale screen). Never blocks on a read problem.
function refundedBlock(snaps: Snap[]): string | null {
  const bad = snaps.filter((o) => o.payment_status === "refunded");
  return bad.length ? `Плащането е върнато в Stripe (${bad.map((o) => o.order_ref).join(", ")}): поръчката не може да се потвърди или изпрати.` : null;
}

// Romania is card only (25.10.2026): a Romanian order goes to "За изпълнение" or out to the courier ONLY with a succeeded card
// payment (Stripe). An unpaid one (an old ramburs order, or a card order whose payment never arrived) is refused here.
function roUnpaidBlock(snaps: Snap[]): string | null {
  const bad = snaps.filter((o) => isRoOrder(o) && !hasCardMoney(o));
  return bad.length ? `СТОП: румънска поръчка ${bad.map((o) => o.order_ref ?? `#${o.id}`).join(", ")} е НЕПЛАТЕНА (няма успешно плащане с карта). Не потвърждавай и не изпращай.` : null;
}

async function notifyRo(
  supabase: SupabaseClient, before: Snap[], alreadyThere: (status: string) => boolean, mail: RoPanelMail,
): Promise<string | null> {
  const warnings: string[] = [];
  for (const o of before) {
    if (!isRoOrder(o) || alreadyThere(o.status)) continue;   // a Bulgarian order, or it was in this state already: no e-mail
    const w = await sendRoPanelMail(supabase, o.id, mail);
    if (w) warnings.push(before.length > 1 ? `${o.order_ref ?? o.id}: ${w}` : w);
  }
  return warnings.length ? warnings.join(" ") : null;
}

// Потвърждава / big ПОТВЪРДИ button → confirmed (stock stays reserved).
export async function confirmOrder(id: number, expected?: string | null): Promise<string | null> {
  { const denied = await fulfillmentBlock([id]); if (denied) return denied; }
  const supabase = await adminDb();
  const lock = await guard(id, expected);
  if (lock.conflict) return lock.conflict;
  const before = await snapshot(supabase, [id]);
  const blocked = refundedBlock(before) ?? roUnpaidBlock(before);
  if (blocked) return blocked;
  const err = await patchOrder(id, { status: "confirmed", call_state: "confirmed" }, lock.token);
  if (err) return err;
  autoLabels(supabase, [id]);
  return notifyRo(supabase, before, (st) => st === "confirmed", { kind: "order_confirmed" });
}

// Отказва → cancelled, with a structured reason so an ACTIVE refusal (lost sale)
// is distinguishable from UNREACHABLE contact (logistics) in the stats.
// category: refused | unreachable | wrong_number | other. Only a genuine phone
// refusal counts as call_state='refused' (the customer-history badge).
export async function cancelOrder(id: number, category: string, reason: string, expected?: string | null): Promise<string | null> {
  { const denied = await fulfillmentBlock([id]); if (denied) return denied; }
  const lock = await guard(id, expected);
  if (lock.conflict) return lock.conflict;
  // Only a genuine phone refusal touches call_state (it feeds the customer-
  // history "отказал" badge). Other reasons keep their detail in cancel_category
  // and leave call_state alone — the enum call_state_t only allows
  // pending/confirmed/no_answer/refused, so writing the raw category throws.
  const patch: Record<string, unknown> = { status: "cancelled", cancel_category: category, cancel_reason: reason || null };
  if (category === "refused") patch.call_state = "refused";
  const supabase = await adminDb();
  const [b] = await snapshot(supabase, [id]);
  if (b && isPaidCard(b)) return cancelPaidCardOrder(supabase, b, patch, category);
  let q = supabase.from("orders").update(patch).eq("id", id);
  if (lock.token) q = q.eq("updated_at", lock.token);
  const { data: hit, error } = await q.select("id");
  if (error) { console.error("[orders] cancel error:", error.message); return error.message; }
  if (lock.token && !hit?.length) return CHANGED_JUST_NOW;
  if (b && HOLDS_STOCK(b.status)) await restockOrderItems(supabase, b.items);
  revalidatePath(ORDERS_PATH);
  const labelMsg = await cancelLabels(supabase, [id]);
  // Romanian customer: cancellation e-mail (wording by category).
  return joinMsgs(labelMsg, await notifyRo(supabase, b ? [b] : [], (st) => st === "cancelled", { kind: "order_cancelled", category }));
}

// A PAID card order is cancelled together with its refund. Order of events matters:
//   1. refund in Stripe FIRST (idempotent per order + payment): if Stripe refuses, nothing else changes and staff are told;
//   2. mark payment_status = refunded (so the charge.refunded webhook finds nothing left to do);
//   3. cancel with ONE conditional UPDATE (only while new/confirmed) and put the stock back only if THIS call did the cancelling,
//      so a webhook that got there first can never cause a second restock.
// A Romanian customer then gets the Romanian cancellation e-mail that says the card payment is being refunded.
async function cancelPaidCardOrder(
  supabase: SupabaseClient, b: Snap, patchIn: Record<string, unknown>, category: string,
): Promise<string | null> {
  let patch = patchIn;
  // A TEST payment (Stripe test mode: session id cs_test_..., or no Stripe key on this site, or a live key that cannot see a test payment)
  // has no money to give back: it is cancelled without asking Stripe and WITHOUT an e-mail to the customer. A LIVE payment that cannot be
  // refunded from here is never cancelled silently (lib/stripe-mode.ts).
  let testPayment = false;
  if (b.payment_status !== "refunded") {
    const plan = refundPlan(b.stripe_session_id, process.env.STRIPE_SECRET_KEY);
    if (plan.action === "refuse") return plan.message;
    if (plan.action === "skip") testPayment = true;
    else {
      const pi = String(b.stripe_payment_intent ?? "");
      if (!pi) return "Платена с карта, но липсва номер на плащането в Stripe: върни сумата ръчно от Stripe и после откажи поръчката.";
      try {
        await getStripe().refunds.create({ payment_intent: pi }, { idempotencyKey: `panel-refund-${b.order_ref ?? b.id}-${pi}` });
      } catch (e) {
        if (isMissingStripeObject(e)) testPayment = true;   // Stripe has no such payment for this key: it was a test payment
        else {
          console.error("[orders] Stripe refund failed:", e instanceof Error ? e.message : e);
          return `Връщането на парите през Stripe не успя (${e instanceof Error ? e.message : "грешка"}): поръчката НЕ е отказана. Опитай пак или върни сумата от Stripe.`;
        }
      }
      if (!testPayment) {
        const marked = await supabase.from("orders").update({ payment_status: "refunded" }).eq("id", b.id).neq("payment_status", "refunded");
        if (marked.error) console.error("[orders] refund mark failed (the refund itself went through):", marked.error.message);
      }
    }
  }
  if (testPayment) patch = { ...patch, cancel_reason: [patch.cancel_reason, "тестово плащане: без връщане на пари, без имейл"].filter(Boolean).join(" · ") };
  const done = await supabase.from("orders").update(patch).eq("id", b.id).in("status", ["new", "confirmed"]).select("id, items");
  if (done.error) { console.error("[orders] cancel after refund failed:", done.error.message); return `Сумата е върната, но отказът не се записа (${done.error.message}). Натисни Откажи отново.`; }
  if (done.data?.length) await restockOrderItems(supabase, (done.data[0] as { items: OrderItem[] }).items);
  revalidatePath(ORDERS_PATH);
  const labelMsg = await cancelLabels(supabase, [b.id]);
  if (testPayment) return labelMsg;   // a test order: the customer (a Romanian test address too) gets no e-mail
  return joinMsgs(labelMsg, await notifyRo(supabase, [b], (st) => st === "cancelled", { kind: "order_cancelled", category, refundLabel: fmtRON(Number(b.total ?? 0)) }));
}

// "Потвърдете поръчката си" e-mail at "не вдига (1)" / "не вдига (2)" (lib/confirm-request.ts): once per order, only while the
// automatic mode is on. sendConfirmRequest re-checks everything (attempt 1/2, still new, has e-mail, not mailed yet) and never throws;
// a mail problem never blocks the "не вдига" press.
async function autoConfirmRequest(supabase: SupabaseClient, id: number): Promise<void> {
  if (!CONFIRM_REQUEST_AUTO) return;
  const r = await sendConfirmRequest(supabase, id);
  if (!r.ok && r.reason !== "вече изпратен" && r.reason !== "няма имейл" && r.reason !== "не е „не вдига (1/2)“") console.warn("[orders] confirm e-mail not sent", id, r.reason);
}

// „Не вдига" → never locks. Atomic server-side increment (no race on rapid
// presses); the audit trigger logs each attempt with the exact time + who.
export async function markNoAnswer(id: number, expected?: string | null): Promise<string | null> {
  { const denied = await fulfillmentBlock([id]); if (denied) return denied; }
  { const lock = await guard(id, expected); if (lock.conflict) return lock.conflict; }
  try {
    const supabase = await adminDb();
    const { error } = await supabase.rpc("mark_no_answer", { p_id: id });
    if (error) {
      console.error("[orders] no-answer error:", error.message);
      return error.message;
    }
    await autoConfirmRequest(supabase, id);
    revalidatePath(ORDERS_PATH);
    return null;
  } catch (e) {
    console.error("[orders] no-answer exception:", e);
    return e instanceof Error ? e.message : "Грешка при 'не вдига'";
  }
}

// ── Bulk actions on a visually-grouped set of orders (same customer, identical
// address). Each row is updated individually so the audit trigger fires (and
// logs) once per order — a group action leaves one audit entry per order. ──────
export async function confirmOrders(ids: number[]): Promise<string | null> {
  { const denied = await fulfillmentBlock(ids); if (denied) return denied; }
  if (!ids.length) return null;
  const supabase = await adminDb();
  const before = await snapshot(supabase, ids);
  const blocked = refundedBlock(before) ?? roUnpaidBlock(before);
  if (blocked) return blocked;
  const { error } = await supabase.from("orders")
    .update({ status: "confirmed", call_state: "confirmed" })
    .in("id", ids);
  if (error) { console.error("[orders] bulk confirm error:", error.message); return error.message; }
  revalidatePath(ORDERS_PATH);
  autoLabels(supabase, ids);
  return notifyRo(supabase, before, (st) => st === "confirmed", { kind: "order_confirmed" });
}

export async function cancelOrders(ids: number[], category: string, reason: string): Promise<string | null> {
  { const denied = await fulfillmentBlock(ids); if (denied) return denied; }
  if (!ids.length) return null;
  const patch: Record<string, unknown> = { status: "cancelled", cancel_category: category, cancel_reason: reason || null };
  if (category === "refused") patch.call_state = "refused";
  const supabase = await adminDb();
  const before = await snapshot(supabase, ids);
  if (before.some(isPaidCard)) return "В групата има поръчка, платена с карта: откажи я отделно (връща се и сумата през Stripe).";
  const { error } = await supabase.from("orders").update(patch).in("id", ids);
  if (error) { console.error("[orders] bulk cancel error:", error.message); return error.message; }
  for (const o of before) {
    if (HOLDS_STOCK(o.status)) await restockOrderItems(supabase, o.items);
  }
  revalidatePath(ORDERS_PATH);
  const labelMsg = await cancelLabels(supabase, ids);
  return joinMsgs(labelMsg, await notifyRo(supabase, before, (st) => st === "cancelled", { kind: "order_cancelled", category }));
}

// ── Повторни поръчки (lib/duplicate-orders.ts) ─────────────────────────────────────────────────────────────────────────────────
// "Отмени като дубликат": cancelled, cancel_category/cancel_reason "duplicate", the stock goes back, and NO e-mail to the customer
// (the customer meant one order; a cancellation mail would only confuse - not even a Romanian one, so notifyRo is deliberately not called).
// call_state is left alone, so the customer's "отказал" history is not touched. Only an order still holding stock and not yet shipped.
export async function cancelAsDuplicate(id: number): Promise<string | null> {
  { const denied = await fulfillmentBlock([id]); if (denied) return denied; }
  const supabase = await adminDb();
  const [b] = await snapshot(supabase, [id]);
  if (!b) return "Поръчката не е намерена.";
  if (b.status === "cancelled") return null;
  if (isPaidCard(b)) return "Платена с карта: откажи я от „Откажи“ (връща се и сумата през Stripe), не като дубликат.";
  if (b.status !== "new" && b.status !== "confirmed") return "Поръчката вече е изпратена или приключена: не може да се откаже като дубликат.";
  // ONE conditional UPDATE: only while it is still new/confirmed, and the stock is put back only if THIS call did the cancelling.
  const done = await supabase.from("orders")
    .update({ status: "cancelled", cancel_category: "duplicate", cancel_reason: "duplicate" })
    .eq("id", id).in("status", ["new", "confirmed"]).select("id, items");
  if (done.error) { console.error("[orders] cancel-as-duplicate error:", done.error.message); return done.error.message; }
  if (done.data?.length) await restockOrderItems(supabase, (done.data[0] as { items: OrderItem[] }).items);
  revalidatePath(ORDERS_PATH);
  return cancelLabels(supabase, [id]);
}

// "Не е дубликат": the owner says these orders are legitimate. They stop counting for duplicate detection (also for any later order).
export async function dismissDuplicateGroup(ids: number[]): Promise<string | null> {
  { const denied = await fulfillmentBlock(ids); if (denied) return denied; }
  if (!ids.length) return null;
  const supabase = await adminDb();
  const { error } = await supabase.from("orders").update({ duplicate_dismissed_at: new Date().toISOString() }).in("id", ids);
  if (error) {
    console.error("[orders] dismiss-duplicate error:", error.message);
    return /duplicate_dismissed_at|schema cache|column/i.test(error.message)
      ? "Липсва колоната в базата: пусни supabase/orders_duplicates.sql в Supabase и опитай пак."
      : error.message;
  }
  revalidatePath(ORDERS_PATH);
  return null;
}

export async function markNoAnswerOrders(ids: number[]): Promise<string | null> {
  { const denied = await fulfillmentBlock(ids); if (denied) return denied; }
  if (!ids.length) return null;
  try {
    const supabase = await adminDb();
    for (const id of ids) {
      const { error } = await supabase.rpc("mark_no_answer", { p_id: id });
      if (error) { console.error("[orders] bulk no-answer error:", error.message); return error.message; }
      await autoConfirmRequest(supabase, id);
    }
    revalidatePath(ORDERS_PATH);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : "Грешка при 'не вдига'";
  }
}

// HARD GUARD (24.10.2026): money already taken by Stripe must never be collected a second time by Econt.
//   - a card order with no paid card payment (inconsistent) is never shipped from here;
//   - an order with a paid card payment is shipped only on a waybill whose cash-on-delivery amount Econt reports as 0;
//     a waybill Econt cannot find (or Econt unreachable) blocks too - "not verified" is not "0".
async function codGuard(snap: Snap | undefined, awb: string): Promise<string | null> {
  if (!snap) return null;
  const ref = snap.order_ref ?? `#${snap.id}`;
  if (cardMoneyMissing(snap)) return `СТОП: поръчка ${ref} е с плащане с карта, но плащане няма. Не изпращай - провери в Stripe.`;
  if (!hasCardMoney(snap)) return null;
  const cod = await econtCodAmount(awb, snap.created_at ? new Date(snap.created_at).getTime() : Date.now() - 14 * 86_400_000, (snap as { source_site?: string | null }).source_site);
  if (cod === null) return `СТОП: поръчка ${ref} е ПЛАТЕНА С КАРТА, а не намирам товарителница ${awb} в Еконт и не мога да проверя, че наложеният платеж е 0. Провери номера и опитай пак след минута.`;
  if (cod > 0.01) return `СТОП: товарителница ${awb} е с наложен платеж ${cod.toFixed(2)}, а поръчка ${ref} е ПЛАТЕНА С КАРТА. Анулирай товарителницата в Еконт и направи нова с наложен платеж 0.`;
  return null;
}

// Ship → tracking required. The DB trigger also blocks 'shipped' without it.
export async function shipOrder(id: number, tracking: string, expected?: string | null): Promise<string | null> {
  { const denied = await fulfillmentBlock([id]); if (denied) return denied; }
  const lock = await guard(id, expected);
  if (lock.conflict) return lock.conflict;
  const t = (tracking ?? "").trim();
  const [snap] = await snapshot(await adminDb(), [id]);
  if (snap && isRoOrder(snap)) return shipRoOrder(id, t, ""); // a Romanian order has an AWB of its own courier, never an Econt waybill
  if (!t) return "Въведи тракинг номер от Еконт първо";
  const blocked = refundedBlock(snap ? [snap] : []);
  if (blocked) return blocked;
  const codBlocked = await codGuard(snap, t);
  if (codBlocked) return codBlocked;
  return patchOrder(id, { tracking_number: t, status: "shipped" }, lock.token);
}

// Ship a Romanian order: AWB of the Romanian courier (typed in by hand) + optional tracking link, then the customer's Romanian
// "colet expediat" e-mail (once: ship_email_sent_at). The Bulgarian shipped e-mail is driven by Econt tracking and never fires
// for a Romanian order (is_international = true, see lib/market.ts).
export async function shipRoOrder(id: number, awb: string, trackUrl: string): Promise<string | null> {
  { const denied = await fulfillmentBlock([id]); if (denied) return denied; }
  const tracking = (awb ?? "").trim();
  if (!tracking) return "Въведи AWB номер на куриера първо";
  const typed = (trackUrl ?? "").trim();
  if (typed && !/^https:\/\//i.test(typed)) return "Линкът за проследяване трябва да започва с https://";
  const url = typed || roTrackUrl(tracking);                                   // empty field: Speedy's tracking page for this AWB

  const supabase = await adminDb();
  const { data: order, error: readErr } = await supabase.from("orders").select("*").eq("id", id).single();
  if (readErr || !order) return readErr?.message ?? "Поръчката не е намерена";
  if (!isRoOrder(order)) return "Това не е румънска поръчка.";
  const blocked = refundedBlock([order as Snap]) ?? roUnpaidBlock([order as Snap]);
  if (blocked) return blocked;

  const now = new Date().toISOString();
  const { error } = await supabase.from("orders").update({ tracking_number: tracking, status: "shipped", shipped_at: now }).eq("id", id);
  if (error) { console.error("[orders] ship RO error:", error.message); return error.message; }
  revalidatePath(ORDERS_PATH);

  // Claim first (only while ship_email_sent_at is still empty), then send: two clicks can never both mail the customer.
  const { data: claimed, error: claimErr } = await supabase.from("orders").update({ ship_email_sent_at: now })
    .eq("id", id).is("ship_email_sent_at", null).select("id");
  if (claimErr) return `Статусът е променен, но имейлът не е изпратен (${claimErr.message}).`;
  if (!claimed?.length) return null;                                           // the customer already has the shipped e-mail
  const warning = await sendRoPanelMail(supabase, id, { kind: "shipment_shipped", awb: tracking, trackUrl: url });
  if (warning) {
    const { error: relErr } = await supabase.from("orders").update({ ship_email_sent_at: null }).eq("id", id).eq("ship_email_sent_at", now);
    if (relErr) console.error("[orders] RO ship: could not release the e-mail claim", id, relErr.message);
  }
  return warning;
}

// Append a timestamped comment to the order's note history. Append-only —
// stored as newline-separated lines inside call_notes (no schema change) so a
// note a caller wrote is NEVER overwritten/lost. Time stamped in Europe/Sofia.
export async function addOrderNote(id: number, text: string): Promise<string | null> {
  { const denied = await fulfillmentBlock([id]); if (denied) return denied; }
  const t = (text ?? "").trim();
  if (!t) return null;
  const supabase = await adminDb();
  const { data, error: readErr } = await supabase
    .from("orders").select("call_notes").eq("id", id).single();
  if (readErr) {
    console.error("[orders] note read error:", readErr.message);
    return readErr.message;
  }
  const stamp = new Date().toLocaleString("bg-BG", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Sofia",
  });
  const line = `[${stamp}] ${t}`;
  const prev = (data?.call_notes ?? "").trim();
  return patchOrder(id, { call_notes: prev ? `${prev}\n${line}` : line });
}

// Shipped → completed. Manual fallback until the Econt auto-close is built.
// Tagged 'manual' so completions closed by hand stay distinguishable from the
// ones Econt confirmed (those set completed_source='econt').
export async function markCompleted(id: number, expected?: string | null): Promise<string | null> {
  { const denied = await fulfillmentBlock([id]); if (denied) return denied; }
  const lock = await guard(id, expected);
  if (lock.conflict) return lock.conflict;
  const supabase = await adminDb();
  const before = await snapshot(supabase, [id]);
  const err = await patchOrder(id, {
    status: "completed",
    completed_at: new Date().toISOString(),
    completed_source: "manual",
  }, lock.token);
  if (err) return err;
  return notifyRo(supabase, before, (st) => st === "completed", { kind: "order_delivered" });
}

// Shipment came back / customer never took it → status 'returning'. Leather is
// NOT restocked here — that happens only on the confirmed 'restocked' transition
// (the cron's Econt receipt, or the "Взех пратката" button), never in transit.
// Sets returning_at so the cron may auto-restock it once Econt confirms receipt.
export async function markReturned(id: number, expected?: string | null): Promise<string | null> {
  { const denied = await fulfillmentBlock([id]); if (denied) return denied; }
  { const lock = await guard(id, expected); if (lock.conflict) return lock.conflict; }
  const supabase = await adminDb();
  const before = await snapshot(supabase, [id]);
  const nowIso = new Date().toISOString();
  let { error } = await supabase.from("orders").update({ status: "returning", returning_at: nowIso }).eq("id", id);
  if (error && /returning|returning_at|column|schema cache|enum|invalid input/i.test(error.message)) {
    ({ error } = await supabase.from("orders").update({ status: "returned" }).eq("id", id)); // pre-migration
  }
  if (error) { console.error("[orders] return error:", error.message); return error.message; }
  revalidatePath(ORDERS_PATH);
  const mailWarning = await notifyRo(supabase, before, isReturn, { kind: "order_returned" });
  // The panel never refunds a SHIPPED card order by itself: the money is returned by hand in Stripe. Say so right here.
  const paid = before.find((o) => hasCardMoney(o) && o.payment_status !== "refunded");
  // Only the Romanian customer gets a "returned parcel" e-mail (which promises the refund); a Bulgarian one is not mailed here.
  const refundNote = paid ? `Платена с карта: върни сумата в Stripe (Payments → плащането → Refund).${isRoOrder(paid) ? " Клиентът е уведомен, че ще получи парите обратно." : ""}` : null;
  return [refundNote, mailWarning].filter(Boolean).join(" ") || null;
}

// "Взех пратката" — Koko confirms the returning parcel is physically in hand →
// status 'restocked' + leather +1. Idempotent (blocked if already restocked, so
// a later cron pass can't double-count). Uses the admin's own session so the
// audit trigger records WHO pressed it (restocked_source also records 'button').
export async function markRestocked(id: number): Promise<string | null> {
  { const denied = await fulfillmentBlock([id]); if (denied) return denied; }
  const supabase = await adminDb();
  const res = await markRestockedTx(supabase, id, "button", new Date().toISOString());
  if (res === "already") return "Вече е получена — наличността не се вдига втори път.";
  revalidatePath(ORDERS_PATH);
  return null;
}

// Returned goods physically inspected and put back on the shelf. (Legacy flag —
// superseded by the 'restocked' status; kept so old data/routes don't break.)
export async function markReturnReviewed(id: number): Promise<string | null> {
  { const denied = await fulfillmentBlock([id]); if (denied) return denied; }
  return patchOrder(id, { return_reviewed: true });
}

// ── Рекламации (supabase/orders_complaints.sql) ──────────────────────────────
// A parcel that WAS delivered and comes back afterwards (defect / 14 days). The
// order's status is deliberately left alone - it was delivered, and Econt/Stripe
// say so - and the claim is written on top of it. The amount is what leaves the
// turnover (lib/revenue.ts subtracts it by complaint_at).

const COMPLAINT_MIGRATION_MISSING =
  "Рекламациите още не са включени в базата: пусни supabase/orders_complaints.sql в Supabase → SQL Editor.";

// True when the update failed only because the complaint columns do not exist yet.
const isMissingComplaintColumn = (msg: string): boolean =>
  /complaint/i.test(msg) && /column|schema cache|does not exist/i.test(msg);

/**
 * Open (or correct) a рекламация. `amount` is the money given back in the
 * order's own currency - left empty it becomes the goods part of the order
 * (total − доставка), which is exactly what the turnover had counted.
 */
export type ComplaintOutcome = "open" | "resolved" | "replaced" | "rejected";

export async function openComplaint(
  id: number,
  amount: number | null,
  reason: string,
  restock: boolean,
  outcome?: ComplaintOutcome,
): Promise<string | null> {
  { const denied = await fulfillmentBlock([id]); if (denied) return denied; }
  const supabase = await adminDb();
  const [before] = await snapshot(supabase, [id]);
  if (!before) return "Поръчката не е намерена.";

  const goods = Math.max(0, (Number(before.total) || 0) - (Number((before as { shipping_cost?: number | null }).shipping_cost) || 0));
  // A typed 0 is a real answer ("нищо не връщаме" - замяна, жест): keep it. Only an
  // empty field means "the goods part of the order".
  const amt = amount != null && Number.isFinite(amount) && amount >= 0 ? Math.round(Math.max(0, amount) * 100) / 100 : goods;
  const nowIso = new Date().toISOString();
  const already = (before as { complaint_at?: string | null }).complaint_at ?? null;
  const alreadyRestocked = (before as { complaint_restocked_at?: string | null }).complaint_restocked_at ?? null;

  const patch: Record<string, unknown> = {
    complaint_at: already ?? nowIso,        // keep the original date when only correcting
    complaint_amount: amt,
    complaint_reason: reason.trim() || null,
    complaint_state: outcome ?? (before as { complaint_state?: string | null }).complaint_state ?? "open",
  };
  if (outcome && outcome !== "open") patch.complaint_resolved_at = nowIso;
  if (outcome === "open") patch.complaint_resolved_at = null;
  // Stock goes back up only once, the first time we are told the goods are here.
  if (restock && !alreadyRestocked) patch.complaint_restocked_at = nowIso;

  const { error } = await supabase.from("orders").update(patch).eq("id", id);
  if (error) {
    console.error("[orders] complaint error:", error.message);
    return isMissingComplaintColumn(error.message) ? COMPLAINT_MIGRATION_MISSING : error.message;
  }
  // wallet_inventory +1 — only on the transition that just set complaint_restocked_at,
  // so a repeated press (or a later edit of the claim) can never double-count.
  if (patch.complaint_restocked_at) await restockOrderItems(supabase, before.items);
  revalidatePath(ORDERS_PATH);

  // A card order is refunded by hand in Stripe, exactly like a returned parcel.
  const givingMoneyBack = (patch.complaint_state as string) !== "rejected" && (patch.complaint_state as string) !== "replaced" && (amt as number) > 0;
  const paid = givingMoneyBack && hasCardMoney(before) && before.payment_status !== "refunded";
  return paid ? "Платена с карта: върни сумата в Stripe (Payments → плащането → Refund)." : null;
}

/**
 * Close a рекламация: 'resolved' (money given back), 'replaced' (a new piece sent
 * instead - the money stays with us) or 'rejected' (not accepted - turnover keeps it).
 */
export async function setComplaintState(id: number, state: "open" | "resolved" | "replaced" | "rejected"): Promise<string | null> {
  { const denied = await fulfillmentBlock([id]); if (denied) return denied; }
  const supabase = await adminDb();
  const { error } = await supabase
    .from("orders")
    .update({ complaint_state: state, complaint_resolved_at: state === "open" ? null : new Date().toISOString() })
    .eq("id", id);
  if (error) {
    console.error("[orders] complaint state error:", error.message);
    return isMissingComplaintColumn(error.message) ? COMPLAINT_MIGRATION_MISSING : error.message;
  }
  revalidatePath(ORDERS_PATH);
  return null;
}

/**
 * Entered by mistake → wipe the claim. The turnover gets the money back on the
 * next load. Stock is NOT taken down again: if the goods were restocked they are
 * physically on the shelf, and correcting the count there is the inventory tab's job.
 */
export async function clearComplaint(id: number): Promise<string | null> {
  { const denied = await fulfillmentBlock([id]); if (denied) return denied; }
  const supabase = await adminDb();
  const [before] = await snapshot(supabase, [id]);
  const { error } = await supabase
    .from("orders")
    .update({ complaint_at: null, complaint_amount: null, complaint_reason: null, complaint_state: null, complaint_resolved_at: null })
    .eq("id", id);
  if (error) {
    console.error("[orders] complaint clear error:", error.message);
    return isMissingComplaintColumn(error.message) ? COMPLAINT_MIGRATION_MISSING : error.message;
  }
  revalidatePath(ORDERS_PATH);
  return (before as { complaint_restocked_at?: string | null } | undefined)?.complaint_restocked_at
    ? "Рекламацията е махната. Наличността НЕ е върната назад — стоката беше вкарана в склад, оправи броя от Инвентар, ако трябва."
    : null;
}

// Manual "check for new tracking numbers" — pulls getMyAWB and matches confirmed
// orders. Sure matches (unique phone + amount + date) are auto-filled; uncertain
// ones are returned for one-click confirmation. Uses the admin's own session.
export async function matchTracking(): Promise<{ ok: boolean; message: string; result?: MatchResult }> {
  const supabase = await adminDb();
  try {
    const promoted = await promoteAcceptedLabels(supabase).catch(() => 0);   // panel labels Econt has taken -> shipped
    const r = await matchTrackingNumbers(supabase);
    // Instant Email 1 for parcels Econt has just physically accepted (sendTime
    // != null); dedup via ship_email_sent_at. Non-fatal — a mail/Econt/DB hiccup
    // (or the migration not yet run) must never fail the tracking match itself.
    let shipMsg = "";
    try {
      const s = await sendShipConfirmations(supabase);
      if (s.sent > 0) shipMsg = ` · изпратени ${s.sent} имейла „изпратена"`;
    } catch (e) {
      console.error("[orders] ship-confirm emails failed:", e);
    }
    revalidatePath(ORDERS_PATH);
    return {
      ok: true,
      message: `${promoted ? `Приети от Еконт ${promoted} · ` : ""}Сканирани ${r.scanned} · попълнени ${r.autoFilled.length} · за потвърждение ${r.pending.length} · без товарителница ${r.unmatched.length}${shipMsg}`,
      result: r,
    };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

// Confirm a suggested (uncertain) match → fill the tracking number + mark shipped.
export async function confirmMatch(orderId: number, awb: string): Promise<string | null> {
  { const denied = await fulfillmentBlock([orderId]); if (denied) return denied; }
  const supabase = await adminDb();
  const [snap] = await snapshot(supabase, [orderId]);
  const blocked = refundedBlock(snap ? [snap] : []) ?? roUnpaidBlock(snap ? [snap] : []) ?? (await codGuard(snap, awb));
  if (blocked) return blocked;
  const err = await patchOrder(orderId, { tracking_number: awb, status: "shipped" });
  if (err) return err;
  // Same instant Email 1 as the match button (sent only once Econt has accepted the parcel; once per order). Non-fatal.
  try {
    await sendShipConfirmations(supabase);
  } catch (e) {
    console.error("[orders] ship-confirm emails after confirmMatch failed:", e);
  }
  return null;
}

// Manual "check Econt now" — reconciles shipped orders against Econt using the
// admin's own session (works without the service-role key). Only completes
// orders Econt actually reports delivered, so it's still tamper-proof.
export async function checkEcontStatuses(): Promise<{ ok: boolean; message: string }> {
  const supabase = await adminDb();
  try {
    const r = await reconcileShippedOrders(supabase);
    const backfilled = await classifyExistingReturns(supabase);
    revalidatePath(ORDERS_PATH);
    return { ok: true, message: `Проверени ${r.checked} · завършени ${r.completed} · върнати ${r.returned}${r.restocked ? ` · получени обратно ${r.restocked}` : ""}${backfilled ? ` · класифицирани ${backfilled}` : ""}` };
  } catch (e) {
    return { ok: false, message: String(e) };
  }
}

// Discrete "mark as fake / test" toggle — excludes the order from stock entirely.
export async function setFake(id: number, fake: boolean): Promise<string | null> {
  { const denied = await fulfillmentBlock([id]); if (denied) return denied; }
  return patchOrder(id, { excluded_from_stock: fake });
}

// "Върни" (owner, 16.11.2026): takes a wrongly marked order out of "Фалшиви". Marking only sets the flag - the status is never touched -
// so the order comes back in exactly the status it had. The database trigger writes the history row (маркиране -> върната в реални,
// with the admin's e-mail); should it not have (trigger missing), the row is written here, so an undo is never unlogged.
export async function restoreFake(id: number): Promise<string | null> {
  { const denied = await fulfillmentBlock([id]); if (denied) return denied; }
  const supabase = await adminDb();
  const logRows = async () => (await supabase.from("order_status_log").select("order_id", { count: "exact", head: true }).eq("order_id", id)).count ?? 0;
  const before = await logRows();
  const { data, error } = await supabase.from("orders").update({ excluded_from_stock: false }).eq("id", id).eq("excluded_from_stock", true).select("id");
  if (error) {
    console.error("[orders] restoreFake error:", error.message);
    return error.message;
  }
  let warning: string | null = null;
  if (data?.length && (await logRows()) <= before) {
    const who = await getAdminSession();
    const { error: logErr } = await supabase.from("order_status_log").insert({
      order_id: id, old_status: "маркиране", new_status: "върната в реални",
      changed_by: who?.userId ?? null, changed_by_email: who?.email ?? null, change_number: before + 1,
    });
    if (logErr) {
      console.error("[orders] restoreFake log error:", logErr.message);
      warning = `Поръчката е върната, но записът в историята не успя: ${logErr.message}`;
    }
  }
  revalidatePath(ORDERS_PATH);
  return warning;
}

// ── Manual order creation ("Създай поръчка" — from Viber/Instagram/chat) ──────
export type ManualItemInput = { slug: string; name: string; sku: string; price: number; currency: string; quantity: number };
export type ManualOrderInput = {
  name: string;
  phone: string;
  city: string;
  courier: "econt" | "home";   // office vs personal address
  address: string;             // office name OR personal address
  items: ManualItemInput[];
  /** COD amount the owner typed, or null to let the server price the basket (catalogue + live promotions). */
  total: number | null;
  /**
   * Замяна по рекламация: the order reference of the parcel this one replaces. The
   * customer pays nothing (COD 0) and the piece still leaves the stock, because a real
   * piece is really being shipped. Turnover is untouched: €0 adds nothing, and the
   * рекламация on the old order is the one that decides whether money went back.
   */
  replacementFor?: string | null;
  notes: string;
  status: "new" | "confirmed";
};

export async function createManualOrder(input: ManualOrderInput): Promise<{ ok: boolean; message: string; ref?: string }> {
  const name = input.name.trim();
  const phone = input.phone.trim();
  if (name.length < 2)                      return { ok: false, message: "Въведи две имена" };
  if (phone.replace(/\D/g, "").length < 9)  return { ok: false, message: "Въведи валиден телефон" };
  if (!input.city.trim())                   return { ok: false, message: "Въведи град" };
  if (!input.address.trim())                return { ok: false, message: input.courier === "home" ? "Въведи адрес" : "Въведи офис на Еконт" };
  if (!input.items.length)                  return { ok: false, message: "Добави поне един продукт" };

  const supabase = await adminDb();
  const ref = `LR-${Date.now().toString(36).slice(-6).toUpperCase()}`;
  const shippingMethod = input.courier === "home" ? "Доставка чрез Еконт до адрес" : "Доставка чрез Еконт до офис";

  // Price the basket HERE, exactly as the shop prices it: the catalogue (which already
  // carries the 1+1 fixed prices) + the live sale overrides, then the same set / 1+1
  // discounts the checkout takes. The browser's numbers are never trusted — a modal left
  // open since yesterday, or a stale tab, would otherwise write last week's prices onto a
  // real order. A line whose slug is unknown (shouldn't happen: the picker only offers
  // catalogue products) keeps what it was sent, so nothing can silently become free.
  const overrides = await getPriceOverrides();
  const priced = new Map(applyOverrides(allProducts, overrides).map((p) => [p.slug, p]));
  const lines = input.items.map((i) => {
    const quantity = Math.max(1, Math.floor(Number(i.quantity ?? 1)) || 1);
    const p = i.slug ? priced.get(String(i.slug)) : undefined;
    return p
      ? { name: p.name, sku: p.sku, slug: p.slug, price: p.price, currency: p.currency, quantity, product: p }
      : { name: i.name, sku: i.sku, slug: i.slug, price: Number(i.price) || 0, currency: i.currency, quantity, product: undefined };
  });
  const gross = lines.reduce((s, l) => s + l.price * l.quantity, 0);
  const { totalDiscount } = calcBundleDiscount(
    lines.filter((l) => l.product).map((l) => ({ product: l.product!, quantity: l.quantity }))
  );
  // `goods` is the goods AFTER the discounts — that is what `subtotal` means on every
  // other order, and what the card's breakdown (and onePlusOneOfOrder) reads back.
  const goods = Math.round(Math.max(0, gross - totalDiscount) * 100) / 100;

  // Замяна: nothing is collected. The note carries the old order's number so the two
  // can always be read together on the card.
  const replaces = (input.replacementFor ?? "").trim();
  const freeReplacement = replaces.length > 0;
  const notes = [freeReplacement ? `Замяна по рекламация · за ${replaces} · без плащане` : "", input.notes.trim()]
    .filter(Boolean).join(" · ");

  // Unified model: a manual order decrements stock too. Reserve atomically BEFORE
  // insert (fail-closed — no overselling); if the insert then fails, restock to
  // undo, so a retry doesn't double-decrement.
  const reserveItems = input.items
    .filter((i) => i.slug)
    .map((i) => ({ slug: String(i.slug), qty: Math.max(1, Number(i.quantity ?? 1)) }));
  if (reserveItems.length) {
    const { data: res, error: resErr } = await supabase.rpc("reserve_wallet_stock", { p_items: reserveItems });
    if (resErr) { console.error("[orders] manual reserve error:", resErr.message); return { ok: false, message: "Проблем с проверката на наличността, опитай пак." }; }
    if (res && (res as { ok?: boolean }).ok === false) {
      const sf = (res as { shortfall?: { slug: string; available: number }[] }).shortfall ?? [];
      const names = sf.map((s) => `${input.items.find((i) => i.slug === s.slug)?.name ?? s.slug} (налични ${s.available})`).join(", ");
      return { ok: false, message: `Няма достатъчно наличност: ${names}` };
    }
    await refreshStockPages(reserveItems, "reserved");
  }

  const { error } = await supabase.from("orders").insert({
    order_ref:       ref,
    name,
    phone,
    city:            input.city.trim(),
    address:         input.address.trim(),
    shipping_method: shippingMethod,
    courier:         input.courier,
    items:           lines.map((l) => ({ name: l.name, sku: l.sku, slug: l.slug, price: l.price, currency: l.currency, quantity: l.quantity, qty: l.quantity })),
    subtotal:        freeReplacement ? 0 : goods,
    shipping_cost:   0,
    // null = auto (the priced basket). A number = the owner typed it in the form.
    total:           freeReplacement ? 0 : (typeof input.total === "number" && Number.isFinite(input.total) ? input.total : goods),
    notes:           notes || null,
    status:          input.status === "confirmed" ? "confirmed" : "new",
    call_state:      input.status === "confirmed" ? "confirmed" : "pending",
    is_manual:       true,
  });
  if (error) {
    console.error("[orders] manual create error:", error.message);
    if (reserveItems.length) await restockOrderItems(supabase, lines); // undo the reserve
    return { ok: false, message: error.message };
  }
  revalidatePath(ORDERS_PATH);
  return { ok: true, message: `Създадена ${ref}`, ref };
}

/**
 * "Приложи" on the partner's badge: turns his latest mark into the real status with the panel's own action (stock, refunds and
 * e-mails exactly as when you press the button yourself), logged as you. Обадено has no panel equivalent.
 */
export async function applyPartnerMark(id: number): Promise<string | null> {
  { const denied = await fulfillmentBlock([id]); if (denied) return denied; }
  const supabase = await adminDb();
  const { data: o, error } = await supabase.from("orders").select("order_ref, status").eq("id", id).single();
  if (error || !o) return error?.message ?? "Поръчката липсва";
  const { data: m } = await supabase.from("partner_order_state").select("status, note").eq("order_ref", o.order_ref).maybeSingle();
  if (!m) return "Няма отметка от партньора";
  const what = applyOfMark(String(o.status), String(m.status));
  if (what === "confirm") return confirmOrder(id);
  if (what === "no_answer") return markNoAnswer(id);
  if (what === "cancel") return cancelOrder(id, "refused", `Отказано (отметка на партньора)${m.note ? ` · ${String(m.note).slice(0, 200)}` : ""}`);
  return "Няма какво да се приложи за този статус";
}
