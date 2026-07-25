import { createClient } from "@/lib/supabase/server";

// App-layer owner gate (mirrors the RLS is_owner()). admin_users self-read policy
// returns only the caller's own row, so this reflects the logged-in admin.
export async function isOwner(): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.from("admin_users").select("role").maybeSingle();
  return (data as { role?: string } | null)?.role === "owner";
}
