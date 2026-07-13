import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Server-only Supabase client using the SERVICE-ROLE key (bypasses RLS).
// Use this for any server-side read/write to an RLS-protected table where no
// user session exists (crons, capture endpoints, admin reads). The key is
// whitespace-stripped because a pasted key once carried a mid-value newline.
// NEVER import this into a client component.
export function supabaseAdmin(): SupabaseClient {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").replace(/\s/g, "");
  return createClient(url, key, { auth: { persistSession: false } });
}
