// Optimistic locking for the orders board (owner, 27.11.2026). The board sends the updated_at it saw; before a status action the
// server compares it with the row. A newer row is a CONFLICT only when someone ELSE did something a person must see (a status,
// a call attempt, a comment...). Label work (товарителница / печат) and silent system writes (e-mail sent flags, payment sync) bump
// updated_at too but are not a reason to stop: then the current updated_at is used as the token instead.
// The write itself then goes with .eq("updated_at", token), so a change landing between this check and the write still loses.

import type { SupabaseClient } from "@supabase/supabase-js";
import { whoName, actionText } from "./admin-names";

const BENIGN = new Set(["товарителница", "печат"]);

export type LockCheck = { token: string | null; conflict: string | null };

export async function lockCheck(sb: SupabaseClient, id: number, expected: string | null | undefined, myEmail: string | null): Promise<LockCheck> {
  if (!expected) return { token: null, conflict: null };          // an old screen without the token: behaves as before
  const { data: row } = await sb.from("orders").select("updated_at").eq("id", id).maybeSingle();
  const current = (row as { updated_at?: string | null } | null)?.updated_at ?? null;
  if (!current) return { token: null, conflict: null };
  if (new Date(current).getTime() === new Date(expected).getTime()) return { token: current, conflict: null };
  const { data: log } = await sb.from("order_status_log")
    .select("old_status, new_status, changed_by_email, changed_at")
    .eq("order_id", id).gt("changed_at", expected).order("changed_at", { ascending: false });
  const others = ((log ?? []) as { old_status: string | null; new_status: string | null; changed_by_email: string | null; changed_at: string }[])
    .filter((r) => !BENIGN.has(r.old_status ?? "") && (r.changed_by_email ?? "") !== (myEmail ?? "\u0000"));
  if (!others.length) return { token: current, conflict: null };
  const last = others[0];
  return { token: null, conflict: `Поръчката е променена от ${whoName(last.changed_by_email)} („${actionText(last)}“). Презареди.` };
}

export const CHANGED_JUST_NOW = "Поръчката е променена току-що от друг потребител. Презареди.";
