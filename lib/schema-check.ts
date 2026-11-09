import type { SupabaseClient } from "@supabase/supabase-js";
import { PARTNER_ORDER_COLUMNS } from "./partner/orders";

// Columns / tables the code needs that a migration adds (owner, 09.11.2026, after the partner e-mail failed in production with
// "column orders.partner_email_sent_at does not exist" because the code shipped before its SQL). Checked by the health cron
// (lib/health.ts, every 15 min) -> panel top bar + Telegram, naming each missing column. A new migration => add its columns here.
const cols = (s: string) => s.split(",").map((c) => c.trim()).filter(Boolean);
export const EXPECTED_SCHEMA: Record<string, string[]> = {
  orders: [...cols(PARTNER_ORDER_COLUMNS), "email", "total", "partner_email_sent_at", "partner_email_error"],
  partners: cols("email, name, enabled, notify, revoked_before, invited_at, last_login_at, created_at, password_hash"),
  partner_order_state: cols("order_ref, status, note, updated_at, updated_by"),
  partner_status_log: cols("id, order_ref, old_status, new_status, old_note, new_note, email, ip, changed_at"),
  wallet_inventory: cols("slug, stock"),
  health_status: cols("key, ok, title, detail, since, checked_at, last_alerted_at"),
};

type Err = { code?: string; message?: string } | null;
// 42703 undefined column, 42P01 undefined table, PGRST204/205 not in PostgREST's schema cache
const isSchemaError = (e: Err) => !!e && (/^(42703|42P01|PGRST20[45])$/.test(String(e.code ?? "")) || /does not exist|could not find/i.test(String(e.message ?? "")));

export type SchemaProblem = { table: string; missing: string[] | "table"; error: string };

/** Every expected table / column that is missing in the live database. Non-schema errors (network ...) throw. */
export async function findSchemaProblems(sb: SupabaseClient): Promise<SchemaProblem[]> {
  const out: SchemaProblem[] = [];
  for (const [table, columns] of Object.entries(EXPECTED_SCHEMA)) {
    const all = await sb.from(table).select(columns.join(", ")).limit(1);
    if (!all.error) continue;
    if (!isSchemaError(all.error)) throw new Error(`${table}: ${all.error.message}`);
    const probe = await sb.from(table).select("*").limit(1);
    if (probe.error && isSchemaError(probe.error)) { out.push({ table, missing: "table", error: probe.error.message }); continue; }
    const missing: string[] = [];
    for (const c of columns) {
      const r = await sb.from(table).select(c).limit(1);
      if (r.error && isSchemaError(r.error)) missing.push(c);
    }
    out.push({ table, missing, error: all.error.message });
  }
  return out;
}
