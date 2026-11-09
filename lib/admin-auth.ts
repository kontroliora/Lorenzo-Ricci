import { getAdminSession } from "@/lib/supabase/admin-db";

// App-layer owner gate (mirrors the RLS is_owner()): the signed-in admin's admin_users row, read server-side.
export async function isOwner(): Promise<boolean> {
  return (await getAdminSession())?.role === "owner";
}
