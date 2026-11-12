"use server";

import { revalidatePath } from "next/cache";
import { getAdminSession } from "@/lib/supabase/admin-db";
import { recordCartCall, saveCartNote } from "@/lib/cart-calls";
import type { CartCallState } from "@/lib/abandoned-carts";

const ORDERS_PATH = "/lr-panel-v8m3q/orders";

// The staff's result of phoning a saved cart (panel "Изоставени колички"):
//   will_order -> "Звъннах - ще поръча": stays in the list, marked;
//   declined   -> "Звъннах - не иска": the cart disappears for good;
//   no_answer  -> "Не вдига": counted atomically (a double click cannot count twice); the 2nd one makes the cart disappear.
// Returns an error text for the screen, null on success. Only a logged-in panel user may call it.
export async function markCartCall(id: string, outcome: CartCallState): Promise<string | null> {
  try {
    const admin = await getAdminSession();
    if (!admin) return "Нямаш достъп. Влез отново в панела.";
    const err = await recordCartCall(id, outcome, admin.email ?? "админ");
    if (!err) revalidatePath(ORDERS_PATH);
    return err;
  } catch (e) {
    console.error("[carts] call exception:", e);
    return e instanceof Error ? e.message : "Грешка при запис на обаждането.";
  }
}

/** A note on a cart (shared with the partner's /partner -> Колички). */
export async function setCartNote(id: string, note: string): Promise<string | null> {
  const admin = await getAdminSession();
  if (!admin) return "Нямаш достъп. Влез отново в панела.";
  const err = await saveCartNote(id, note, admin.email ?? "админ");
  if (!err) revalidatePath(ORDERS_PATH);
  return err;
}
