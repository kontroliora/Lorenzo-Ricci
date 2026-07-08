"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { reconcileShippedOrders } from "@/lib/econt";

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

// Отказва / big ОТКАЖИ button → cancelled (reservation is released automatically).
export async function cancelOrder(id: number): Promise<string | null> {
  return patchOrder(id, { status: "cancelled", call_state: "refused" });
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
