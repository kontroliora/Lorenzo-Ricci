"use server";
import { isOwner } from "@/lib/bonus";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { computeRoas, type RoasData } from "@/lib/roas";

export type SpendInput = { start: string; end: string; amount: number; note: string };
type Result = { ok: boolean; message?: string };

// Recompute ROAS for an arbitrary window (called on every period change).
export async function getRoas(startISO: string, endISO: string): Promise<RoasData | null> {
  return computeRoas(startISO, endISO);
}

function validate(i: SpendInput): string | null {
  if (!i.start || !i.end) return "Липсват дати";
  if (i.end < i.start) return "Крайната дата е преди началната";
  if (!(i.amount >= 0) || !isFinite(i.amount)) return "Невалидна сума";
  return null;
}

export async function addSpend(input: SpendInput): Promise<Result> {
  if (!(await isOwner())) return { ok: false, message: "Няма достъп" };
  const err = validate(input);
  if (err) return { ok: false, message: err };
  const sb = supabaseAdmin();
  const { error } = await sb.from("ad_spend").insert({
    period_start: input.start, period_end: input.end,
    amount: input.amount, note: input.note.trim() || null,
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function updateSpend(id: string, input: SpendInput): Promise<Result> {
  if (!(await isOwner())) return { ok: false, message: "Няма достъп" };
  const err = validate(input);
  if (err) return { ok: false, message: err };
  const sb = supabaseAdmin();
  const { error } = await sb.from("ad_spend").update({
    period_start: input.start, period_end: input.end,
    amount: input.amount, note: input.note.trim() || null,
    updated_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function deleteSpend(id: string): Promise<Result> {
  if (!(await isOwner())) return { ok: false, message: "Няма достъп" };
  const sb = supabaseAdmin();
  const { error } = await sb.from("ad_spend").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}
