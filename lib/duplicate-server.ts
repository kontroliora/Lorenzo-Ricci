// Server side of the repeat-order feature: the checkout guard and the alert to the team. Pure logic lives in lib/duplicate-orders.ts.
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendTelegram } from "@/lib/telegram";
import { sendAdminEmail } from "@/lib/order-notify";
import { SITE_URL } from "@/lib/site";
import { buildDuplicateGroups, findRecentSameProduct, DUP_WINDOW_HOURS, DUP_WINDOW_MS, type DupOrder } from "@/lib/duplicate-orders";

const esc = (t: string): string => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const PANEL_URL = `${SITE_URL}/lr-panel-v8m3q/orders`;

/** Orders created since `sinceMs`. "*" so a column that a migration has not added yet (duplicate_dismissed_at) can never break the read. */
async function ordersSince(sinceMs: number): Promise<DupOrder[]> {
  const { data, error } = await supabaseAdmin().from("orders").select("*")
    .gte("created_at", new Date(sinceMs).toISOString()).order("created_at", { ascending: false }).limit(1000);
  if (error) throw new Error(error.message);
  return (data ?? []) as DupOrder[];
}

export type CheckoutDuplicate = { ref: string; at: string; total: number | null; names: string[] };

/**
 * Checkout guard: has this e-mail or phone already ordered one of these products in the last 24 h (not cancelled)? Returns the newest such
 * order, or null. It never blocks on a database problem (null): a paying customer must not be stopped by a failed lookup.
 */
export async function checkCheckoutDuplicate(who: { email?: unknown; phone?: unknown }, slugs: string[]): Promise<CheckoutDuplicate | null> {
  try {
    const recent = await ordersSince(Date.now() - 25 * 3_600_000);
    const hit = findRecentSameProduct(recent, who, slugs);
    if (!hit || !hit.order_ref) return null;
    const names = (hit.items ?? []).filter((l) => !l.gift).map((l) => String(l.name ?? l.slug ?? "")).filter(Boolean);
    return { ref: hit.order_ref, at: hit.created_at, total: hit.total ?? null, names };
  } catch (e) {
    console.error("[duplicate] checkout lookup failed (order goes on):", e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * Tell the team that a new order belongs to a group of repeat orders. Telegram first (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID, the same
 * bot as the health alerts); when it is not configured or fails, an e-mail to the team instead. Never throws: the order is already saved.
 * Returns what happened, for the logs.
 */
export async function notifyDuplicateOrder(orderRef: string): Promise<"telegram" | "email" | "none" | "failed"> {
  try {
    if (!orderRef) return "none";
    const all = await ordersSince(Date.now() - 2 * DUP_WINDOW_MS);
    const { byId } = buildDuplicateGroups(all);
    const me = all.find((o) => o.order_ref === orderRef);
    const group = me ? byId.get(me.id) : undefined;
    if (!me || !group) return "none";
    const others = group.orders.filter((o) => o.id !== me.id);
    const refs = others.map((o) => `#${o.order_ref ?? o.id}`).join(", ");
    const text =
      `⚠ <b>Повторна поръчка #${esc(String(me.order_ref ?? me.id))}</b> от ${esc(String(me.name ?? "—"))} (${esc(String(me.phone ?? "—"))}).\n` +
      `Има още ${others.length} ${others.length === 1 ? "поръчка" : "поръчки"} за ${DUP_WINDOW_HOURS}ч: ${esc(refs)}.` +
      `${group.sameProducts ? "\nЕДНАКВИ ПРОДУКТИ." : ""}\n${PANEL_URL}`;
    const tg = await sendTelegram(text);
    if (tg.ok) return "telegram";
    console.warn("[duplicate] Telegram not sent, using e-mail:", tg.error);
    await sendAdminEmail(
      `⚠ Повторна поръчка #${me.order_ref ?? me.id} - ${me.name ?? ""}`,
      `<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5">${text.replace(/\n/g, "<br>").replace(PANEL_URL, `<a href="${PANEL_URL}">${PANEL_URL}</a>`)}</p>`,
    );
    return "email";
  } catch (e) {
    console.error("[duplicate] alert failed:", e instanceof Error ? e.message : e);
    return "failed";
  }
}
