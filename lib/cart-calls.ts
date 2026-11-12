import { supabaseAdmin } from "./supabase-admin";
import type { CartCallState } from "./abandoned-carts";

// Writing the result of phoning an abandoned cart, shared by the admin panel (Изоставени колички) and the partner (/partner ->
// Колички): one record per cart, so whoever calls next sees what the other did and nobody phones the same customer twice.
//   will_order -> stays in the list, marked; declined -> leaves the list; no_answer -> counted atomically, the 2nd one hides the cart.
// `by` = who did it ('партньор' or the admin's e-mail). Returns an error text for the screen, null on success.

export const CART_OUTCOMES: CartCallState[] = ["will_order", "declined", "no_answer"];
const NEEDS_SQL = "Първо пусни SQL файла supabase/cart_sessions_calls.sql в Supabase (добавя колоните за обажданията).";
const NEEDS_NOTE_SQL = "Първо пусни SQL файла supabase/cart_sessions_notes.sql в Supabase (добавя бележките).";

export async function recordCartCall(id: string, outcome: CartCallState, by: string): Promise<string | null> {
  if (!CART_OUTCOMES.includes(outcome) || !id) return "Невалидно действие.";
  const admin = supabaseAdmin();
  const now = new Date().toISOString();
  const withBy = async (patch: Record<string, unknown>, q: (p: Record<string, unknown>) => PromiseLike<{ error: { message: string } | null; data?: unknown }>) => {
    const r = await q({ ...patch, call_by: by });
    return r.error && /call_by/.test(r.error.message) ? q(patch) : r;   // before cart_sessions_notes.sql: write without "who"
  };
  const patch: Record<string, unknown> = { call_state: outcome, last_call_at: now };
  if (outcome !== "no_answer") {
    const { error } = await withBy(patch, (p) => admin.from("cart_sessions").update(p).eq("id", id));
    if (error) { console.error("[carts] call update error:", error.message); return /call_state|last_call_at|column/i.test(error.message) ? NEEDS_SQL : error.message; }
    return null;
  }
  // compare-and-set on the attempts counter: two presses at once can never count twice
  for (let attempt = 0; attempt < 3; attempt++) {
    const cur = await admin.from("cart_sessions").select("id, call_attempts").eq("id", id).limit(1);
    if (cur.error) { console.error("[carts] call read error:", cur.error.message); return /call_attempts|column/i.test(cur.error.message) ? NEEDS_SQL : cur.error.message; }
    if (!cur.data?.length) return "Количката не е намерена.";
    const attempts = Number((cur.data[0] as { call_attempts?: number | null }).call_attempts ?? 0) || 0;
    const upd = await withBy({ ...patch, call_attempts: attempts + 1 }, (p) => admin.from("cart_sessions").update(p).eq("id", id).eq("call_attempts", attempts).select("id"));
    if (upd.error) { console.error("[carts] no-answer update error:", upd.error.message); return /call_attempts|call_state|column/i.test(upd.error.message) ? NEEDS_SQL : upd.error.message; }
    if (((upd.data as unknown[] | undefined)?.length ?? 0) > 0) return null;
  }
  return "Не успях да запиша обаждането (две натискания едновременно). Опитай пак.";
}

export async function saveCartNote(id: string, note: string, by: string): Promise<string | null> {
  if (!id) return "Невалидно действие.";
  const text = note.trim().slice(0, 1000);
  const { error } = await supabaseAdmin().from("cart_sessions")
    .update({ call_note: text || null, call_note_at: new Date().toISOString(), call_note_by: by }).eq("id", id);
  if (error) { console.error("[carts] note error:", error.message); return /call_note/.test(error.message) ? NEEDS_NOTE_SQL : error.message; }
  return null;
}
