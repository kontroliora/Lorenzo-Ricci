"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { reconcileShippedOrders, matchTrackingNumbers, type MatchResult } from "@/lib/econt";

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

// Потвърждава / big ПОТВЪРДИ button → confirmed (stock stays reserved).
export async function confirmOrder(id: number): Promise<string | null> {
  return patchOrder(id, { status: "confirmed", call_state: "confirmed" });
}

// Отказва → cancelled, with a structured reason so an ACTIVE refusal (lost sale)
// is distinguishable from UNREACHABLE contact (logistics) in the stats.
// category: refused | unreachable | wrong_number | other. Only a genuine phone
// refusal counts as call_state='refused' (the customer-history badge).
export async function cancelOrder(id: number, category: string, reason: string): Promise<string | null> {
  const callState = category === "refused" ? "refused" : category;
  return patchOrder(id, {
    status: "cancelled",
    call_state: callState,
    cancel_category: category,
    cancel_reason: reason || null,
  });
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

// Ship → tracking required. The DB trigger also blocks 'shipped' without it.
export async function shipOrder(id: number, tracking: string): Promise<string | null> {
  const t = (tracking ?? "").trim();
  if (!t) return "Въведи тракинг номер от Еконт първо";
  return patchOrder(id, { tracking_number: t, status: "shipped" });
}

export async function saveCallNotes(id: number, notes: string): Promise<string | null> {
  return patchOrder(id, { call_notes: notes });
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

// Shipment came back / customer never took it → returns stock, flags the customer.
export async function markReturned(id: number): Promise<string | null> {
  return patchOrder(id, { status: "returned" });
}

// Returned goods physically inspected and put back on the shelf.
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
    revalidatePath(ORDERS_PATH);
    return {
      ok: true,
      message: `Сканирани ${r.scanned} · попълнени ${r.autoFilled.length} · за потвърждение ${r.pending.length}`,
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
    revalidatePath(ORDERS_PATH);
    return { ok: true, message: `Проверени ${r.checked} · завършени ${r.completed} · върнати ${r.returned}` };
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
