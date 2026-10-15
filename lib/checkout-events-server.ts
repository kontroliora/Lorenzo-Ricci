import { supabaseAdmin } from "@/lib/supabase-admin";
import { summarizeEvents, type CheckoutEventRow, type StuckSummary } from "@/lib/checkout-events";

// Server only. Needs supabase/checkout_events.sql; without the table the panel simply shows no summary.
export async function getStuckSummary(nowMs = Date.now()): Promise<StuckSummary | null> {
  const r = await supabaseAdmin().from("checkout_events").select("*").order("created_at", { ascending: false }).limit(500);
  if (r.error) return null;
  return summarizeEvents((r.data ?? []) as CheckoutEventRow[], nowMs - 24 * 3_600_000);
}
