"use server";
// mail-policy: internal
import { revalidatePath } from "next/cache";
import { isOwner } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { issueLoginToken, normEmail } from "@/lib/partner/access";
import { sendPartnerLoginEmail } from "@/lib/partner/email";

// Owner-only actions of the Партньор tab (each re-checks the owner on the server).

/** The one toggle: off = he is out at once (every request re-checks; old sessions revoked), no more order e-mails. */
export async function setPartnerEnabled(email: string, enabled: boolean): Promise<{ ok: boolean; error?: string }> {
  if (!(await isOwner())) return { ok: false, error: "Само собственикът" };
  const { error } = await supabaseAdmin().from("partners")
    .update({ enabled, ...(enabled ? {} : { revoked_before: new Date().toISOString() }) }).eq("email", normEmail(email));
  revalidatePath("/lr-panel-v8m3q/partner");
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Adds (or re-enables) a partner and e-mails him the invitation with a sign-in link. */
export async function invitePartner(emailRaw: string, name: string): Promise<{ ok: boolean; error?: string }> {
  if (!(await isOwner())) return { ok: false, error: "Само собственикът" };
  const email = normEmail(emailRaw);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Невалиден имейл" };
  const sb = supabaseAdmin();
  const up = await sb.from("partners").upsert({ email, name: name.trim() || null, enabled: true, invited_at: new Date().toISOString() }, { onConflict: "email" });
  if (up.error) return { ok: false, error: up.error.message };
  try { await sendPartnerLoginEmail(email, await issueLoginToken(email, "invite"), true); }
  catch (e) { return { ok: false, error: e instanceof Error ? e.message : "Имейлът не излезе" }; }
  revalidatePath("/lr-panel-v8m3q/partner");
  return { ok: true };
}
