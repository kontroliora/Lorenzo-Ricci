import { supabaseAdmin } from "@/lib/supabase-admin";
import { CART_KEEP_DAYS, CART_MIN_EUR, selectAbandoned, type AbandonedCart, type CartRow, type OrderRef } from "@/lib/abandoned-carts";

// Server only. cart_sessions has no policy for the panel's login (only the capture API writes it with the service key), so the panel
// reads it with the service key too; the page it is called from sits behind the panel's login (middleware.ts).
// The "1-24 h / older" split is NOT done here: the screen's clock keeps ticking, so the client splits with cartSection().
export async function getAbandonedCarts(nowMs = Date.now()): Promise<AbandonedCart[]> {
  const sb = supabaseAdmin();
  // The list's own rules in the query FIRST (12.11.2026): reading "the newest 600 rows" and filtering afterwards lost every cart older
  // than the last 600 sessions written (busy hours fill that in under 2 h). selectAbandoned() still applies every rule.
  const since = new Date(nowMs - CART_KEEP_DAYS * 86_400_000).toISOString();
  const carts = await sb.from("cart_sessions").select("*")
    .in("status", ["pending", "emailed"]).gt("subtotal", CART_MIN_EUR).not("phone", "is", null).neq("phone", "")
    .gte("updated_at", since).or("lang.is.null,lang.neq.ro")
    .order("updated_at", { ascending: false }).limit(1000);
  if (carts.error) throw new Error(carts.error.message);
  const rows = (carts.data ?? []) as CartRow[];
  if (rows.length === 0) return [];
  // Every order (any status, fakes too) with its phone / e-mail: a customer who ordered after the cart was started is not "abandoned".
  const orders = await sb.from("orders").select("phone, email, created_at").order("created_at", { ascending: false }).limit(3000);
  if (orders.error) throw new Error(orders.error.message);
  return selectAbandoned(rows, (orders.data ?? []) as OrderRef[], nowMs);
}
