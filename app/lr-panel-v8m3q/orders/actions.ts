"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { reconcileShippedOrders, matchTrackingNumbers, classifyExistingReturns, markRestocked as markRestockedTx, type MatchResult } from "@/lib/econt";
import { sendShipConfirmations } from "@/lib/shipment-notify";
import { RESERVING_STATUSES, isReturn, type OrderItem } from "@/lib/orders";
import { isRoOrder } from "@/lib/market";
import { sendRoPanelMail, type RoPanelMail } from "@/lib/ro/panel-mail";
import { getStripe } from "@/lib/stripe";
import { isPaidCard } from "@/lib/payments";
import { refundPlan, isMissingStripeObject } from "@/lib/stripe-mode";
import { fmtRON } from "@/lib/ro/config";

const ORDERS_PATH = "/lr-panel-v8m3q/orders";

async function patchOrder(id: number, patch: Record<string, unknown>): Promise<string | null> {
  const supabase = await createClient();
  const { error } = await supabase.from("orders").update(patch).eq("id", id);
  if (error) {
    console.error("[orders] update error:", error.message);
    return error.message;
  }
  revalidatePath(ORDERS_PATH);
  return null;
}

// Unified model: EVERY item is decremented from wallet_inventory at order time,
// so a cancel/return must put the units back — else the counter only drifts down.
// Called only when the order was actually holding stock (HOLDS_STOCK guard →
// prevents a double-restock on re-cancel). restock_wallet_stock skips any slug
// not present in wallet_inventory.
async function restockOrderItems(
  supabase: Awaited<ReturnType<typeof createClient>>,
  items: OrderItem[] | null | undefined,
): Promise<void> {
  const restock = (items ?? [])
    .map((it) => ({ slug: String(it.slug ?? ""), qty: Math.max(1, Number(it.quantity ?? it.qty ?? 1)) }))
    .filter((x) => x.slug);
  if (!restock.length) return;
  const { error } = await supabase.rpc("restock_wallet_stock", { p_items: restock });
  if (error) console.error("[orders] restock_wallet_stock error:", error.message);
}

const HOLDS_STOCK = (status: string) => (RESERVING_STATUSES as readonly string[]).includes(status);

// ── Romanian orders share this board with the Bulgarian ones. Every action that changes a Romanian order also sends the customer a
// Romanian e-mail (lib/ro/panel-mail.ts), but only when the order really moves into that state (a repeated click mails nobody) and
// never for a Bulgarian order. A mail problem never undoes the status change: it is returned as a warning text for the card. ─────
type Snap = {
  id: number; status: string; items: OrderItem[]; ship_country: string | null; order_ref: string | null; total?: number | null;
  payment_method?: string | null; payment_status?: string | null; stripe_payment_intent?: string | null; stripe_session_id?: string | null;
};

async function snapshot(supabase: Awaited<ReturnType<typeof createClient>>, ids: number[]): Promise<Snap[]> {
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

async function notifyRo(
  supabase: Awaited<ReturnType<typeof createClient>>, before: Snap[], alreadyThere: (status: string) => boolean, mail: RoPanelMail,
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
export async function confirmOrder(id: number): Promise<string | null> {
  const supabase = await createClient();
  const before = await snapshot(supabase, [id]);
  const blocked = refundedBlock(before);
  if (blocked) return blocked;
  const err = await patchOrder(id, { status: "confirmed", call_state: "confirmed" });
  if (err) return err;
  return notifyRo(supabase, before, (st) => st === "confirmed", { kind: "order_confirmed" });
}

// Отказва → cancelled, with a structured reason so an ACTIVE refusal (lost sale)
// is distinguishable from UNREACHABLE contact (logistics) in the stats.
// category: refused | unreachable | wrong_number | other. Only a genuine phone
// refusal counts as call_state='refused' (the customer-history badge).
export async function cancelOrder(id: number, category: string, reason: string): Promise<string | null> {
  // Only a genuine phone refusal touches call_state (it feeds the customer-
  // history "отказал" badge). Other reasons keep their detail in cancel_category
  // and leave call_state alone — the enum call_state_t only allows
  // pending/confirmed/no_answer/refused, so writing the raw category throws.
  const patch: Record<string, unknown> = { status: "cancelled", cancel_category: category, cancel_reason: reason || null };
  if (category === "refused") patch.call_state = "refused";
  const supabase = await createClient();
  const [b] = await snapshot(supabase, [id]);
  if (b && isPaidCard(b)) return cancelPaidCardOrder(supabase, b, patch, category);
  const { error } = await supabase.from("orders").update(patch).eq("id", id);
  if (error) { console.error("[orders] cancel error:", error.message); return error.message; }
  if (b && HOLDS_STOCK(b.status)) await restockOrderItems(supabase, b.items);
  revalidatePath(ORDERS_PATH);
  // Romanian customer: cancellation e-mail (wording by category).
  return notifyRo(supabase, b ? [b] : [], (st) => st === "cancelled", { kind: "order_cancelled", category });
}

// A PAID card order is cancelled together with its refund. Order of events matters:
//   1. refund in Stripe FIRST (idempotent per order + payment): if Stripe refuses, nothing else changes and staff are told;
//   2. mark payment_status = refunded (so the charge.refunded webhook finds nothing left to do);
//   3. cancel with ONE conditional UPDATE (only while new/confirmed) and put the stock back only if THIS call did the cancelling,
//      so a webhook that got there first can never cause a second restock.
// A Romanian customer then gets the Romanian cancellation e-mail that says the card payment is being refunded.
async function cancelPaidCardOrder(
  supabase: Awaited<ReturnType<typeof createClient>>, b: Snap, patchIn: Record<string, unknown>, category: string,
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
  if (testPayment) return null;   // a test order: the customer (a Romanian test address too) gets no e-mail
  return notifyRo(supabase, [b], (st) => st === "cancelled", { kind: "order_cancelled", category, refundLabel: fmtRON(Number(b.total ?? 0)) });
}

// „Не вдига" → never locks. Atomic server-side increment (no race on rapid
// presses); the audit trigger logs each attempt with the exact time + who.
export async function markNoAnswer(id: number): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("mark_no_answer", { p_id: id });
    if (error) {
      console.error("[orders] no-answer error:", error.message);
      return error.message;
    }
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
  if (!ids.length) return null;
  const supabase = await createClient();
  const before = await snapshot(supabase, ids);
  const blocked = refundedBlock(before);
  if (blocked) return blocked;
  const { error } = await supabase.from("orders")
    .update({ status: "confirmed", call_state: "confirmed" })
    .in("id", ids);
  if (error) { console.error("[orders] bulk confirm error:", error.message); return error.message; }
  revalidatePath(ORDERS_PATH);
  return notifyRo(supabase, before, (st) => st === "confirmed", { kind: "order_confirmed" });
}

export async function cancelOrders(ids: number[], category: string, reason: string): Promise<string | null> {
  if (!ids.length) return null;
  const patch: Record<string, unknown> = { status: "cancelled", cancel_category: category, cancel_reason: reason || null };
  if (category === "refused") patch.call_state = "refused";
  const supabase = await createClient();
  const before = await snapshot(supabase, ids);
  if (before.some(isPaidCard)) return "В групата има поръчка, платена с карта: откажи я отделно (връща се и сумата през Stripe).";
  const { error } = await supabase.from("orders").update(patch).in("id", ids);
  if (error) { console.error("[orders] bulk cancel error:", error.message); return error.message; }
  for (const o of before) {
    if (HOLDS_STOCK(o.status)) await restockOrderItems(supabase, o.items);
  }
  revalidatePath(ORDERS_PATH);
  return notifyRo(supabase, before, (st) => st === "cancelled", { kind: "order_cancelled", category });
}

export async function markNoAnswerOrders(ids: number[]): Promise<string | null> {
  if (!ids.length) return null;
  try {
    const supabase = await createClient();
    for (const id of ids) {
      const { error } = await supabase.rpc("mark_no_answer", { p_id: id });
      if (error) { console.error("[orders] bulk no-answer error:", error.message); return error.message; }
    }
    revalidatePath(ORDERS_PATH);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : "Грешка при 'не вдига'";
  }
}

// Ship → tracking required. The DB trigger also blocks 'shipped' without it.
export async function shipOrder(id: number, tracking: string): Promise<string | null> {
  const t = (tracking ?? "").trim();
  const [snap] = await snapshot(await createClient(), [id]);
  if (snap && isRoOrder(snap)) return shipRoOrder(id, t, ""); // a Romanian order has an AWB of its own courier, never an Econt waybill
  if (!t) return "Въведи тракинг номер от Еконт първо";
  const blocked = refundedBlock(snap ? [snap] : []);
  if (blocked) return blocked;
  return patchOrder(id, { tracking_number: t, status: "shipped" });
}

// Ship a Romanian order: AWB of the Romanian courier (typed in by hand) + optional tracking link, then the customer's Romanian
// "colet expediat" e-mail (once: ship_email_sent_at). The Bulgarian shipped e-mail is driven by Econt tracking and never fires
// for a Romanian order (is_international = true, see lib/market.ts).
export async function shipRoOrder(id: number, awb: string, trackUrl: string): Promise<string | null> {
  const tracking = (awb ?? "").trim();
  if (!tracking) return "Въведи AWB номер на куриера първо";
  const url = (trackUrl ?? "").trim();
  if (url && !/^https:\/\//i.test(url)) return "Линкът за проследяване трябва да започва с https://";

  const supabase = await createClient();
  const { data: order, error: readErr } = await supabase.from("orders").select("*").eq("id", id).single();
  if (readErr || !order) return readErr?.message ?? "Поръчката не е намерена";
  if (!isRoOrder(order)) return "Това не е румънска поръчка.";
  const blocked = refundedBlock([order as Snap]);
  if (blocked) return blocked;

  const now = new Date().toISOString();
  const { error } = await supabase.from("orders").update({ tracking_number: tracking, status: "shipped", shipped_at: now }).eq("id", id);
  if (error) { console.error("[orders] ship RO error:", error.message); return error.message; }
  revalidatePath(ORDERS_PATH);

  if (order.ship_email_sent_at) return null;                                   // the customer already has the shipped e-mail
  const warning = await sendRoPanelMail(supabase, id, { kind: "shipment_shipped", awb: tracking, trackUrl: url || undefined });
  if (!warning) await supabase.from("orders").update({ ship_email_sent_at: now }).eq("id", id);
  return warning;
}

// Append a timestamped comment to the order's note history. Append-only —
// stored as newline-separated lines inside call_notes (no schema change) so a
// note a caller wrote is NEVER overwritten/lost. Time stamped in Europe/Sofia.
export async function addOrderNote(id: number, text: string): Promise<string | null> {
  const t = (text ?? "").trim();
  if (!t) return null;
  const supabase = await createClient();
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
export async function markCompleted(id: number): Promise<string | null> {
  const supabase = await createClient();
  const before = await snapshot(supabase, [id]);
  const err = await patchOrder(id, {
    status: "completed",
    completed_at: new Date().toISOString(),
    completed_source: "manual",
  });
  if (err) return err;
  return notifyRo(supabase, before, (st) => st === "completed", { kind: "order_delivered" });
}

// Shipment came back / customer never took it → status 'returning'. Leather is
// NOT restocked here — that happens only on the confirmed 'restocked' transition
// (the cron's Econt receipt, or the "Взех пратката" button), never in transit.
// Sets returning_at so the cron may auto-restock it once Econt confirms receipt.
export async function markReturned(id: number): Promise<string | null> {
  const supabase = await createClient();
  const before = await snapshot(supabase, [id]);
  const nowIso = new Date().toISOString();
  let { error } = await supabase.from("orders").update({ status: "returning", returning_at: nowIso }).eq("id", id);
  if (error && /returning|returning_at|column|schema cache|enum|invalid input/i.test(error.message)) {
    ({ error } = await supabase.from("orders").update({ status: "returned" }).eq("id", id)); // pre-migration
  }
  if (error) { console.error("[orders] return error:", error.message); return error.message; }
  revalidatePath(ORDERS_PATH);
  return notifyRo(supabase, before, isReturn, { kind: "order_returned" });
}

// "Взех пратката" — Koko confirms the returning parcel is physically in hand →
// status 'restocked' + leather +1. Idempotent (blocked if already restocked, so
// a later cron pass can't double-count). Uses the admin's own session so the
// audit trigger records WHO pressed it (restocked_source also records 'button').
export async function markRestocked(id: number): Promise<string | null> {
  const supabase = await createClient();
  const res = await markRestockedTx(supabase, id, "button", new Date().toISOString());
  if (res === "already") return "Вече е получена — наличността не се вдига втори път.";
  revalidatePath(ORDERS_PATH);
  return null;
}

// Returned goods physically inspected and put back on the shelf. (Legacy flag —
// superseded by the 'restocked' status; kept so old data/routes don't break.)
export async function markReturnReviewed(id: number): Promise<string | null> {
  return patchOrder(id, { return_reviewed: true });
}

// Manual "check for new tracking numbers" — pulls getMyAWB and matches confirmed
// orders. Sure matches (unique phone + amount + date) are auto-filled; uncertain
// ones are returned for one-click confirmation. Uses the admin's own session.
export async function matchTracking(): Promise<{ ok: boolean; message: string; result?: MatchResult }> {
  const supabase = await createClient();
  try {
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
      message: `Сканирани ${r.scanned} · попълнени ${r.autoFilled.length} · за потвърждение ${r.pending.length}${shipMsg}`,
      result: r,
    };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

// Confirm a suggested (uncertain) match → fill the tracking number + mark shipped.
export async function confirmMatch(orderId: number, awb: string): Promise<string | null> {
  return patchOrder(orderId, { tracking_number: awb, status: "shipped" });
}

// Manual "check Econt now" — reconciles shipped orders against Econt using the
// admin's own session (works without the service-role key). Only completes
// orders Econt actually reports delivered, so it's still tamper-proof.
export async function checkEcontStatuses(): Promise<{ ok: boolean; message: string }> {
  const supabase = await createClient();
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
  return patchOrder(id, { excluded_from_stock: fake });
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
  total: number;               // COD amount (auto from items, or manually adjusted)
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

  const supabase = await createClient();
  const ref = `LR-${Date.now().toString(36).slice(-6).toUpperCase()}`;
  const goods = input.items.reduce((s, i) => s + i.price * i.quantity, 0);
  const shippingMethod = input.courier === "home" ? "Доставка чрез Еконт до адрес" : "Доставка чрез Еконт до офис";

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
  }

  const { error } = await supabase.from("orders").insert({
    order_ref:       ref,
    name,
    phone,
    city:            input.city.trim(),
    address:         input.address.trim(),
    shipping_method: shippingMethod,
    courier:         input.courier,
    items:           input.items.map((i) => ({ name: i.name, sku: i.sku, slug: i.slug, price: i.price, currency: i.currency, quantity: i.quantity, qty: i.quantity })),
    subtotal:        goods,
    shipping_cost:   0,
    total:           Number.isFinite(input.total) ? input.total : goods,
    notes:           input.notes.trim() || null,
    status:          input.status === "confirmed" ? "confirmed" : "new",
    call_state:      input.status === "confirmed" ? "confirmed" : "pending",
    is_manual:       true,
  });
  if (error) {
    console.error("[orders] manual create error:", error.message);
    if (reserveItems.length) await restockOrderItems(supabase, input.items); // undo the reserve
    return { ok: false, message: error.message };
  }
  revalidatePath(ORDERS_PATH);
  return { ok: true, message: `Създадена ${ref}`, ref };
}
