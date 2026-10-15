"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { CartCallState } from "@/lib/abandoned-carts";

const ORDERS_PATH = "/lr-panel-v8m3q/orders";
const OUTCOMES: CartCallState[] = ["will_order", "declined", "no_answer"];
const NEEDS_SQL = "Първо пусни SQL файла supabase/cart_sessions_calls.sql в Supabase (добавя колоните за обажданията).";

// The staff's result of phoning a saved cart (panel "Изоставени колички"):
//   will_order -> "Звъннах - ще поръча": stays in the list, marked;
//   declined   -> "Звъннах - не иска": the cart disappears for good;
//   no_answer  -> "Не вдига": counted atomically (a double click cannot count twice); the 2nd one makes the cart disappear.
// Returns an error text for the screen, null on success. Only a logged-in panel user may call it.
export async function markCartCall(id: string, outcome: CartCallState): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return "Нямаш достъп. Влез отново в панела.";
    if (!OUTCOMES.includes(outcome) || !id) return "Невалидно действие.";

    const admin = supabaseAdmin();
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { call_state: outcome, last_call_at: now };

    if (outcome !== "no_answer") {
      const { error } = await admin.from("cart_sessions").update(patch).eq("id", id);
      if (error) { console.error("[carts] call update error:", error.message); return /call_state|last_call_at|column/i.test(error.message) ? NEEDS_SQL : error.message; }
    } else {
      // Compare-and-set on the attempts counter: if two presses race, only one of them wins the update and the other re-reads.
      let done = false;
      for (let attempt = 0; attempt < 3 && !done; attempt++) {
        const cur = await admin.from("cart_sessions").select("id, call_attempts").eq("id", id).limit(1);
        if (cur.error) { console.error("[carts] call read error:", cur.error.message); return /call_attempts|column/i.test(cur.error.message) ? NEEDS_SQL : cur.error.message; }
        if (!cur.data?.length) return "Количката не е намерена.";
        const attempts = Number((cur.data[0] as { call_attempts?: number | null }).call_attempts ?? 0) || 0;
        const upd = await admin.from("cart_sessions").update({ ...patch, call_attempts: attempts + 1 }).eq("id", id).eq("call_attempts", attempts).select("id");
        if (upd.error) { console.error("[carts] no-answer update error:", upd.error.message); return /call_attempts|call_state|column/i.test(upd.error.message) ? NEEDS_SQL : upd.error.message; }
        done = (upd.data?.length ?? 0) > 0;
      }
      if (!done) return "Не успях да запиша обаждането (две натискания едновременно). Опитай пак.";
    }
    revalidatePath(ORDERS_PATH);
    return null;
  } catch (e) {
    console.error("[carts] call exception:", e);
    return e instanceof Error ? e.message : "Грешка при запис на обаждането.";
  }
}
