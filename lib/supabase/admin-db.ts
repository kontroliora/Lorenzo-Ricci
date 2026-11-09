import { cache } from "react";
import { createClient as createSupabase, type SupabaseClient } from "@supabase/supabase-js";
import { createClient as createSessionClient } from "./server";
import { supabaseAdmin } from "../supabase-admin";

// The admin panel's database client (owner, 09.11.2026). Customer data (orders, order_status_log, cart_sessions, newsletter ...)
// has NO policy for "authenticated" any more (supabase/rls_lockdown.sql): a panel login can no longer read or change it straight
// through the public API with its own token. The panel's server code reads and writes it with the SERVICE ROLE instead, after
// checking here that the signed-in user is in admin_users.
//
// Who did it stays recorded: every request carries the admin's user id in the "x-lr-actor" header, and the database functions
// that used auth.uid() (the order history triggers, is_owner(), mark_no_answer ...) now call lr_actor_uid(), which is auth.uid()
// or - for the service role only - that header. So order_status_log still shows the admin's e-mail, and owner_revenue() still
// answers only the owner.

export type AdminSession = { userId: string; email: string | null; role: "owner" | "employee" };

/** The signed-in admin of this request (session cookie + admin_users row), or null. Cached per request. */
export const getAdminSession = cache(async (): Promise<AdminSession | null> => {
  const session = await createSessionClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabaseAdmin().from("admin_users").select("role").eq("user_id", user.id).maybeSingle();
  if (error || !data) return null;
  const role = (data as { role: string }).role === "owner" ? "owner" : "employee";
  return { userId: user.id, email: user.email ?? null, role };
});

/** Service-role client acting for the signed-in admin (x-lr-actor). Throws when nobody / a non-admin is signed in. */
export const adminDb = cache(async (): Promise<SupabaseClient> => {
  const admin = await getAdminSession();
  if (!admin) throw new Error("Нямате достъп (влезте отново в панела).");
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").replace(/\s/g, "");
  return createSupabase(url, key, { auth: { persistSession: false }, global: { headers: { "x-lr-actor": admin.userId } } });
});
