"use server";
import { revalidatePath } from "next/cache";
import { isOwner } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { normEmail } from "@/lib/partner/access";
import { PARTNER_PAUSED, PARTNER_SKIPPED, notifyPartnerOnce } from "@/lib/partner/email";

// Owner-only actions of the Партньор tab (each re-checks the owner on the server). No action here e-mails the partner an
// invitation or a sign-in link (owner, 09.11.2026): he gets access only when the owner switches him ON; he then signs in with his
// password (or asks for a link himself on /partner/login).

/** The one toggle: off = he is out at once (every request re-checks; old sessions revoked, password ones too), order e-mails
 *  paused (logged on each order, see sendMissedOrders / skipMissedOrders). */
export async function setPartnerEnabled(email: string, enabled: boolean): Promise<{ ok: boolean; error?: string }> {
  if (!(await isOwner())) return { ok: false, error: "Само собственикът" };
  const { error } = await supabaseAdmin().from("partners")
    .update({ enabled, ...(enabled ? {} : { revoked_before: new Date().toISOString() }) }).eq("email", normEmail(email));
  revalidatePath("/lr-panel-v8m3q/partner");
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Adds a partner, switched OFF (no e-mail). The owner switches him on with the toggle. */
export async function addPartner(emailRaw: string, name: string): Promise<{ ok: boolean; error?: string }> {
  if (!(await isOwner())) return { ok: false, error: "Само собственикът" };
  const email = normEmail(emailRaw);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Невалиден имейл" };
  const sb = supabaseAdmin();
  const exists = await sb.from("partners").select("email").eq("email", email).maybeSingle();
  if (exists.data) return { ok: false, error: "Вече е в списъка" };
  const ins = await sb.from("partners").insert({ email, name: name.trim() || null, enabled: false, notify: true });
  revalidatePath("/lr-panel-v8m3q/partner");
  return ins.error ? { ok: false, error: ins.error.message } : { ok: true };
}

/** The orders whose partner e-mail was held back while he was switched off (oldest first). */
async function missedRefs(): Promise<string[]> {
  const { data } = await supabaseAdmin().from("orders").select("order_ref")
    .is("partner_email_sent_at", null).eq("partner_email_error", PARTNER_PAUSED).order("created_at");
  return (data ?? []).map((r) => String(r.order_ref));
}

/** "Send the missed orders": one e-mail per held-back order (each still checked: women's jewellery, paid card, never twice). */
export async function sendMissedOrders(): Promise<{ ok: boolean; sent?: number; error?: string }> {
  if (!(await isOwner())) return { ok: false, error: "Само собственикът" };
  const { data: on } = await supabaseAdmin().from("partners").select("email").eq("enabled", true).eq("notify", true).limit(1);
  if (!on?.length) return { ok: false, error: "Първо включи партньора" };
  let sent = 0;
  for (const ref of await missedRefs()) {
    await supabaseAdmin().from("orders").update({ partner_email_error: null }).eq("order_ref", ref).is("partner_email_sent_at", null);
    if ((await notifyPartnerOnce(ref)) === "sent") sent++;
  }
  revalidatePath("/lr-panel-v8m3q/partner");
  return { ok: true, sent };
}

/** "Don't send": the held-back orders stay without an e-mail and leave the list (he still sees them in /partner). */
export async function skipMissedOrders(): Promise<{ ok: boolean; skipped?: number; error?: string }> {
  if (!(await isOwner())) return { ok: false, error: "Само собственикът" };
  const refs = await missedRefs();
  if (refs.length) await supabaseAdmin().from("orders").update({ partner_email_error: PARTNER_SKIPPED }).in("order_ref", refs).is("partner_email_sent_at", null);
  revalidatePath("/lr-panel-v8m3q/partner");
  return { ok: true, skipped: refs.length };
}
