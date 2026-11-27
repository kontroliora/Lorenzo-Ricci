// The customer's click on "ПОТВЪРЖДАВАМ ПОРЪЧКАТА" (lib/confirm-request.ts). Server only (service role: the customer has no login).
// The order becomes status 'confirmed' + call_state 'confirmed' - the same as a phone confirmation, so it leaves the call queue
// (panel and partner) and lands in "За изпълнение" with the others - plus email_confirmed_at. One conditional UPDATE (only while
// status = 'new'): a second click, or a click after a phone confirmation, changes nothing and just says "already confirmed".
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { ConfirmClaim } from "@/lib/order-confirm-token";
import { deliveryText, itemLines, type ConfirmRow } from "@/lib/confirm-request";
import { hasCardMoney } from "@/lib/payments";
import { after } from "next/server";
import { createEcontLabel, labelMode } from "@/lib/econt-shipping";

/** What the page shows before the click: the order as the e-mail described it. */
export type OrderSummary = { items: { name: string; color: string; qty: number; gift: boolean }[]; total: string; payment: string; delivery: string };

export type ConfirmOutcome =
  | { kind: "confirmed"; ref: string; test?: boolean }   // confirmed by THIS click
  | { kind: "already"; ref: string }                     // confirmed before (by e-mail or by phone) / already shipped
  | { kind: "closed"; ref: string }                      // cancelled / returned: nothing to confirm
  | { kind: "open"; ref: string; summary?: OrderSummary } // still waiting for confirmation (page view only)
  | { kind: "error" };

type Row = { id: number; order_ref: string | null; status: string; payment_status?: string | null; email_confirmed_at?: string | null };

const DONE = new Set(["confirmed", "shipped", "completed"]);

export async function readConfirmState(orderId: number): Promise<ConfirmOutcome> {
  try { return await readState(orderId); } catch (e) { console.error("[confirm-by-email] read failed", orderId, e); return { kind: "error" }; }
}

async function readState(orderId: number): Promise<ConfirmOutcome> {
  const { data, error } = await supabaseAdmin().from("orders").select("*").eq("id", orderId).maybeSingle();
  if (error || !data) return { kind: "error" };
  const o = data as Row;
  const ref = String(o.order_ref ?? o.id);
  if (o.email_confirmed_at || DONE.has(o.status)) return { kind: "already", ref };
  if (o.status !== "new" || o.payment_status === "refunded") return { kind: "closed", ref };
  const r = data as ConfirmRow;
  return { kind: "open", ref, summary: {
    items: itemLines(r.items),
    total: `€${(Number(r.total ?? 0) || 0).toFixed(2)}`,
    payment: hasCardMoney(r) ? "платено с карта" : "наложен платеж",
    delivery: deliveryText(r),
  } };
}

export async function confirmByEmail(claim: ConfirmClaim): Promise<ConfirmOutcome> {
  try { return await confirm(claim); } catch (e) { console.error("[confirm-by-email] failed", claim.orderId, e); return { kind: "error" }; }
}

async function confirm(claim: ConfirmClaim): Promise<ConfirmOutcome> {
  const state = await readConfirmState(claim.orderId);
  if (claim.test) return state.kind === "error" ? state : { kind: "confirmed", ref: "ref" in state ? state.ref : "", test: true };   // owner's test link: no change
  if (state.kind !== "open") return state;
  const { data, error } = await supabaseAdmin().from("orders")
    .update({ status: "confirmed", call_state: "confirmed", email_confirmed_at: new Date().toISOString() })
    .eq("id", claim.orderId).eq("status", "new").is("email_confirmed_at", null).select("id");
  if (error) { console.error("[confirm-by-email] update failed", claim.orderId, error.message); return { kind: "error" }; }
  if (!data?.length) {
    const again = await readConfirmState(claim.orderId);   // a second tab or the phone got there first
    return again.kind === "open" ? { kind: "error" } : again;
  }
  console.log("[confirm-by-email] confirmed", state.ref);
  // Same as a phone confirmation: the Econt label is made right after (history shows it as "автоматично": no admin did it).
  if (labelMode() !== "off") after(async () => {
    const r = await createEcontLabel(supabaseAdmin(), claim.orderId).catch((e) => ({ ok: false as const, error: String(e) }));
    if (!r.ok) console.warn("[confirm-by-email] label", state.ref, r.error);
  });
  return { kind: "confirmed", ref: state.ref };
}
