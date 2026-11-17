"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { adminDb, getAdminSession, type AdminSession } from "@/lib/supabase/admin-db";
import { REVIEW_BUCKET, validateReviewInput } from "@/lib/user-reviews";
import { USER_REVIEWS_TAG } from "@/lib/user-reviews-server";

// Moderation of customer reviews (owner, 17.11.2026; table and RLS: supabase/reviews.sql). Every action re-checks on the server that
// the caller is a panel admin (owner or employee), and writes a line to review_audit_log with WHO did it (e-mail + role) and WHEN.
// The audit line is part of the action: if it cannot be written, the change is undone and the admin sees an error.

type Result = { ok: boolean; error?: string; warning?: string };
type Row = { id: string; product_slug: string; name: string; rating: number; body: string; images: string[] | null; status: string; is_partnership: boolean; moderated_at: string | null; moderated_by: string | null };
type AuditAction = "approved" | "rejected" | "edited" | "partnership_on" | "partnership_off" | "deleted";

const PANEL_PATH = "/lr-panel-v8m3q/reviews";
const COLS = "id, product_slug, name, rating, body, images, status, is_partnership, moderated_at, moderated_by";

async function context(id: string) {
  const admin = await getAdminSession();
  if (!admin) return { error: "Нямате достъп (влезте отново в панела)." as const };
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { error: "Невалидно ревю." as const };
  const sb = await adminDb();
  const { data, error } = await sb.from("reviews").select(COLS).eq("id", id).maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Ревюто вече не съществува." as const };
  return { admin, sb, row: data as Row };
}

type Ctx = Exclude<Awaited<ReturnType<typeof context>>, { error: string }>;

async function audit(c: Ctx, row: Row, action: AuditAction, extra: { old_status?: string | null; new_status?: string | null; details?: unknown } = {}) {
  const a: AdminSession = c.admin;
  const { error } = await c.sb.from("review_audit_log").insert({
    review_id: row.id, product_slug: row.product_slug, review_name: row.name, action,
    old_status: extra.old_status ?? null, new_status: extra.new_status ?? null, details: extra.details ?? null,
    actor_id: a.userId, actor_email: a.email, actor_role: a.role,
  });
  return error?.message ?? null;
}

/** The public page of the product and the cached review reads show the new state at once. */
function refresh(slug: string) {
  revalidateTag(USER_REVIEWS_TAG);
  revalidatePath(`/products/${slug}`);
  revalidatePath(PANEL_PATH);
}

/** Approve (-> shown on the site) or reject (-> hidden) a review. Works from any status; the same status again does nothing. */
export async function moderateReview(id: string, status: "approved" | "rejected"): Promise<Result> {
  if (status !== "approved" && status !== "rejected") return { ok: false, error: "Невалидно действие." };
  const c = await context(id);
  if ("error" in c) return { ok: false, error: c.error };
  if (c.row.status === status) return { ok: true };
  const at = new Date().toISOString();
  const by = c.admin.email ?? c.admin.userId;
  const upd = await c.sb.from("reviews").update({ status, moderated_at: at, moderated_by: by }).eq("id", id).eq("status", c.row.status).select("id");
  if (upd.error) return { ok: false, error: upd.error.message };
  if (!upd.data?.length) return { ok: false, error: "Ревюто току-що е променено от друг. Презаредете страницата." };
  const aerr = await audit(c, c.row, status, { old_status: c.row.status, new_status: status });
  if (aerr) {
    await c.sb.from("reviews").update({ status: c.row.status, moderated_at: c.row.moderated_at, moderated_by: c.row.moderated_by }).eq("id", id);
    return { ok: false, error: `Не е записано в журнала, промяната е върната (${aerr}).` };
  }
  refresh(c.row.product_slug);
  return { ok: true };
}

/** Spelling fixes: only the review text changes (same 10-1000 character rules as the form). The old text stays in the log. */
export async function editReviewText(id: string, bodyRaw: string): Promise<Result> {
  const c = await context(id);
  if ("error" in c) return { ok: false, error: c.error };
  const checked = validateReviewInput({ name: c.row.name, rating: c.row.rating, body: bodyRaw, email: "" });
  if (!checked.ok) return { ok: false, error: checked.errors.body ?? "Невалиден текст." };
  const body = checked.value.body;
  if (body === c.row.body) return { ok: true };
  const upd = await c.sb.from("reviews").update({ body }).eq("id", id).select("id");
  if (upd.error) return { ok: false, error: upd.error.message };
  const aerr = await audit(c, c.row, "edited", { details: { old_body: c.row.body, new_body: body } });
  if (aerr) {
    await c.sb.from("reviews").update({ body: c.row.body }).eq("id", id);
    return { ok: false, error: `Не е записано в журнала, промяната е върната (${aerr}).` };
  }
  refresh(c.row.product_slug);
  return { ok: true };
}

/** "Партньорско ревю": the site shows the label "Партньорство" next to the review. */
export async function setPartnership(id: string, on: boolean): Promise<Result> {
  const c = await context(id);
  if ("error" in c) return { ok: false, error: c.error };
  if (c.row.is_partnership === on) return { ok: true };
  const upd = await c.sb.from("reviews").update({ is_partnership: on }).eq("id", id).select("id");
  if (upd.error) return { ok: false, error: upd.error.message };
  const aerr = await audit(c, c.row, on ? "partnership_on" : "partnership_off");
  if (aerr) {
    await c.sb.from("reviews").update({ is_partnership: c.row.is_partnership }).eq("id", id);
    return { ok: false, error: `Не е записано в журнала, промяната е върната (${aerr}).` };
  }
  refresh(c.row.product_slug);
  return { ok: true };
}

/** Permanent delete (the row and its photos). The log keeps a line with the author, the text and who deleted it. */
export async function deleteReview(id: string): Promise<Result> {
  const c = await context(id);
  if ("error" in c) return { ok: false, error: c.error };
  const del = await c.sb.from("reviews").delete().eq("id", id).select("id");
  if (del.error) return { ok: false, error: del.error.message };
  if (!del.data?.length) return { ok: false, error: "Ревюто вече не съществува." };
  const aerr = await audit(c, c.row, "deleted", { old_status: c.row.status, details: { rating: c.row.rating, body: c.row.body, images: c.row.images ?? [] } });
  const photos = c.row.images ?? [];
  if (photos.length) await c.sb.storage.from(REVIEW_BUCKET).remove(photos).catch(() => undefined);
  refresh(c.row.product_slug);
  return aerr ? { ok: true, warning: `Изтрито, но не е записано в журнала (${aerr}).` } : { ok: true };
}
