import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client for the admin area (Supabase Auth).
 * Uses the public anon key — safe to expose; RLS protects the data.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
