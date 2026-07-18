"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { reconcileShippedOrders, matchTrackingNumbers, classifyExistingReturns, markRestocked as markRestockedTx, type MatchResult } from "@/lib/econt";
import { sendShipConfirmations } from "@/lib/shipment-notify";
import { RESERVING_STATUSES, type OrderItem } from "@/lib/orders";

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

// Leather goods (wallet_inventory) are decremented at order time, so a cancel or
// return must put the units back — otherwise the counter only ever drifts down.
// Watches/jewellery need nothing here: their availability is computed live
// (KV − active orders), so leaving the reserving statuses frees them by itself.
// Only restock when the order was actually holding stock (prevents double-restock
// on a re-cancel of an already-cancelled order).
async function restockLeatherItems(
  supabase: Awaited<ReturnType<typeof createClient>>,
  items: OrderItem[] | null | undefined,
): Promise<void> {
  const leather = (items ?? [])
    .map((it) => ({ slug: String(it.slug ?? ""), qty: Math.max(1, Number(it.quantity ?? it.qty ?? 1)) }))
    .filter((x) => x.slug.startsWith("wallet-") || x.slug.startsWith("cardholder-"));
  if (!leather.length) return;
  const { error } = await supabase.rpc("restock_wallet_stock", { p_items: leather });
  if (error) console.error("[orders] restock_wallet_stock error:", error.message);
}

const HOLDS_STOCK = (status: string) => (RESERVING_STATUSES as readonly string[]).includes(status);

// Потвърждава / big ПОТВЪРДИ button → confirmed (stock stays reserved).
export async function confirmOrder(id: number): Promise<string | null> {
  return patchOrder(id, { status: "confirmed", call_state: "confirmed" });
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
  const { data: before } = await supabase.from("orders").select("status, items").eq("id", id).single();
  const { error } = await supabase.from("orders").update(patch).eq("id", id);
  if (error) { console.error("[orders] cancel error:", error.message); return error.message; }
  const b = before as { status: string; items: OrderItem[] } | null;
  if (b && HOLDS_STOCK(b.status)) await restockLeatherItems(supabase, b.items);
  revalidatePath(ORDERS_PATH);
  return null;
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
  const { error } = await supabase.from("orders")
    .update({ status: "confirmed", call_state: "confirmed" })
    .in("id", ids);
  if (error) { console.error("[orders] bulk confirm error:", error.message); return error.message; }
  revalidatePath(ORDERS_PATH);
  return null;
}

export async function cancelOrders(ids: number[], category: string, reason: string): Promise<string | null> {
  if (!ids.length) return null;
  const patch: Record<string, unknown> = { status: "cancelled", cancel_category: category, cancel_reason: reason || null };
  if (category === "refused") patch.call_state = "refused";
  const supabase = await createClient();
  const { data: before } = await supabase.from("orders").select("id, status, items").in("id", ids);
  const { error } = await supabase.from("orders").update(patch).in("id", ids);
  if (error) { console.error("[orders] bulk cancel error:", error.message); return error.message; }
  for (const o of (before ?? []) as { status: string; items: OrderItem[] }[]) {
    if (HOLDS_STOCK(o.status)) await restockLeatherItems(supabase, o.items);
  }
  revalidatePath(ORDERS_PATH);
  return null;
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
  if (!t) return "Въведи тракинг номер от Еконт първо";
  return patchOrder(id, { tracking_number: t, status: "shipped" });
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
// Tagged 'manual' so it NEVER counts toward the bonus (only Econt-confirmed
// deliveries, which set completed_source='econt', earn a bonus).
export async function markCompleted(id: number): Promise<string | null> {
  return patchOrder(id, {
    status: "completed",
    completed_at: new Date().toISOString(),
    completed_source: "manual",
  });
}

// Shipment came back / customer never took it → status 'returning'. Leather is
// NOT restocked here — that happens only on the confirmed 'restocked' transition
// (the cron's Econt receipt, or the "Взех пратката" button), never in transit.
// Sets returning_at so the cron may auto-restock it once Econt confirms receipt.
export async function markReturned(id: number): Promise<string | null> {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  let { error } = await supabase.from("orders").update({ status: "returning", returning_at: nowIso }).eq("id", id);
  if (error && /returning|returning_at|column|schema cache|enum|invalid input/i.test(error.message)) {
    ({ error } = await supabase.from("orders").update({ status: "returned" }).eq("id", id)); // pre-migration
  }
  if (error) { console.error("[orders] return error:", error.message); return error.message; }
  revalidatePath(ORDERS_PATH);
  return null;
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
    return { ok: false, message: error.message };
  }
  revalidatePath(ORDERS_PATH);
  return { ok: true, message: `Създадена ${ref}`, ref };
}
