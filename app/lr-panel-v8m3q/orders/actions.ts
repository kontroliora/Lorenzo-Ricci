"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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

// „Не вдига" → call marker only, no status change; bumps the attempt counter.
export async function markNoAnswer(id: number, attempts: number): Promise<string | null> {
  return patchOrder(id, { call_state: "no_answer", call_attempts: (attempts ?? 0) + 1 });
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
