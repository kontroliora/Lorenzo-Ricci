"use server";

// Econt товарителници on the orders board (owner, 27.11.2026) + the board's live refresh. Every role that sees the board may use
// these (Koko included); the fulfillment role only on orders it can see (same rule as the board, lib/fulfillment-filter.ts).
// Each action leaves a history row with WHO did it: label status changes through the DB trigger (supabase/econt_labels.sql),
// prints through logAction below.

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminDb, getAdminSession } from "@/lib/supabase/admin-db";
import { fulfillmentVisible } from "@/lib/fulfillment-filter";
import { getOfficeList } from "@/lib/econt-offices";
import { isRoOrder } from "@/lib/market";
import {
  createEcontLabel, cancelEcontLabel, labelMode, todaysLabels, mergeLabelPdfs, type LabelRow,
} from "@/lib/econt-shipping";
import type { OrderItem } from "@/lib/orders";
import { SENDER_GROUPS, type SenderGroup, type SenderRow, type DbAccount } from "@/lib/econt-shipping-core";

const ORDERS_PATH = "/lr-panel-v8m3q/orders";

async function scopeBlock(ids: number[]): Promise<string | null> {
  const session = await getAdminSession();
  if (!session) return "Нямате достъп (влезте отново в панела).";
  if (session.role !== "fulfillment" || !ids.length) return null;
  const { data, error } = await (await adminDb()).from("orders").select("id, items, source_site").in("id", [...new Set(ids)]);
  if (error) return "Поръчката не е намерена.";
  const rows = (data ?? []) as { items: OrderItem[] | null; source_site: string | null }[];
  return rows.length === new Set(ids).size && rows.every(fulfillmentVisible) ? null : "Поръчката не е намерена.";
}

async function logAction(sb: SupabaseClient, orderId: number, what: string, detail: string): Promise<void> {
  const who = await getAdminSession();
  const { count } = await sb.from("order_status_log").select("order_id", { count: "exact", head: true }).eq("order_id", orderId);
  const { error } = await sb.from("order_status_log").insert({
    order_id: orderId, old_status: what, new_status: detail,
    changed_by: who?.userId ?? null, changed_by_email: who?.email ?? null, change_number: (count ?? 0) + 1,
  });
  if (error) console.error("[labels] log failed", orderId, error.message);
}

const offMsg = "Товарителниците от панела са изключени (ECONT_LABELS_MODE).";

// ── One order ────────────────────────────────────────────────────────────────

/** "Създай товарителница" / "Създай отново". retry: may take over a label stuck in 'pending' for > 5 minutes. */
export async function createLabel(id: number, retry = false): Promise<{ ok: boolean; message: string }> {
  if (labelMode() === "off") return { ok: false, message: offMsg };
  { const denied = await scopeBlock([id]); if (denied) return { ok: false, message: denied }; }
  const r = await createEcontLabel(await adminDb(), id, { retryStale: retry });
  revalidatePath(ORDERS_PATH);
  return r.ok ? { ok: true, message: r.already ? `Вече има товарителница ${r.shipmentNumber}.` : `Създадена товарителница ${r.shipmentNumber}.` } : { ok: false, message: r.error };
}

/** "Анулирай товарителницата" (by hand). */
export async function cancelLabel(id: number): Promise<{ ok: boolean; message: string }> {
  { const denied = await scopeBlock([id]); if (denied) return { ok: false, message: denied }; }
  const r = await cancelEcontLabel(await adminDb(), id);
  revalidatePath(ORDERS_PATH);
  return { ok: r.ok, message: r.message || "Няма товарителница за анулиране." };
}

/** CHRONOBG office not recognised -> chosen by hand from Econt's list, then the label is made again. */
export async function setLabelOffice(id: number, code: string): Promise<{ ok: boolean; message: string }> {
  { const denied = await scopeBlock([id]); if (denied) return { ok: false, message: denied }; }
  const list = await getOfficeList();
  const office = list?.offices.find((o) => o.c === String(code).trim());
  if (!office) return { ok: false, message: "Няма такъв офис в списъка на Еконт." };
  const sb = await adminDb();
  const { error } = await sb.from("orders").update({ econt_office_code: office.c }).eq("id", id);
  if (error) return { ok: false, message: error.message };
  return createLabel(id, true);
}

/** Office list for the manual pick (only the cities the order names first, then all - the picker filters client-side). */
export async function officeChoices(city: string | null): Promise<{ c: string; n: string; a: string }[]> {
  if (!(await getAdminSession())) return [];
  const list = await getOfficeList();
  if (!list) return [];
  const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const ids = new Set(list.cities.filter((c) => city && norm(c.n) === norm(city)).map((c) => c.i));
  const pick = ids.size ? list.offices.filter((o) => ids.has(o.i)) : list.offices;
  return pick.map((o) => ({ c: o.c, n: o.n, a: o.a }));
}

/** "Печат PDF": the link (Econt's) and a history row "печат". */
export async function labelPdf(id: number): Promise<{ ok: boolean; url?: string; message?: string }> {
  { const denied = await scopeBlock([id]); if (denied) return { ok: false, message: denied }; }
  const sb = await adminDb();
  const { data } = await sb.from("orders").select("econt_shipment_number, econt_label_pdf_url, econt_label_status").eq("id", id).maybeSingle();
  const row = data as { econt_shipment_number?: string; econt_label_pdf_url?: string; econt_label_status?: string } | null;
  if (!row?.econt_label_pdf_url || row.econt_label_status !== "created") return { ok: false, message: "Няма PDF на товарителница." };
  await logAction(sb, id, "печат", `PDF на ${row.econt_shipment_number}`);
  return { ok: true, url: row.econt_label_pdf_url };
}

// ── All of them ──────────────────────────────────────────────────────────────

/** "Създай товарителници за всички потвърдени": only those without one, one after another, X ok / Y errors. */
export async function createLabelsForConfirmed(): Promise<{ ok: boolean; message: string; errors: { ref: string; error: string }[] }> {
  if (labelMode() === "off") return { ok: false, message: offMsg, errors: [] };
  const session = await getAdminSession();
  if (!session) return { ok: false, message: "Нямате достъп.", errors: [] };
  const sb = await adminDb();
  const { data, error } = await sb.from("orders").select("*").eq("status", "confirmed").in("econt_label_status", ["none", "error"]).order("created_at", { ascending: true });
  if (error) return { ok: false, message: error.message, errors: [] };
  let rows = (data ?? []) as (LabelRow & { items: OrderItem[] | null })[];
  rows = rows.filter((o) => !isRoOrder(o) && !o.is_international && !o.excluded_from_stock);
  if (session.role === "fulfillment") rows = rows.filter(fulfillmentVisible);
  let ok = 0;
  const errors: { ref: string; error: string }[] = [];
  for (const o of rows) {
    const r = await createEcontLabel(sb, o.id);
    if (r.ok) ok++;
    else errors.push({ ref: o.order_ref ?? `#${o.id}`, error: r.error });
  }
  revalidatePath(ORDERS_PATH);
  return { ok: errors.length === 0, message: rows.length ? `${ok} успешни / ${errors.length} грешки` : "Няма потвърдени поръчки без товарителница.", errors };
}

/** "Печат на всички днешни": one merged PDF of today's labels (base64), plus links for any that could not be merged. */
export async function todaysLabelsPdf(): Promise<{ ok: boolean; message: string; pdfBase64?: string; links: { ref: string; url: string }[] }> {
  const session = await getAdminSession();
  if (!session) return { ok: false, message: "Нямате достъп.", links: [] };
  const sb = await adminDb();
  let rows = await todaysLabels(sb);
  if (session.role === "fulfillment") rows = rows.filter((o) => fulfillmentVisible(o as { items?: OrderItem[] | null; source_site?: string | null }));
  if (!rows.length) return { ok: false, message: "Днес няма създадени товарителници.", links: [] };
  const { pdf, failed } = await mergeLabelPdfs(rows);
  for (const o of rows) await logAction(sb, o.id, "печат", failed.includes(o) ? "общ PDF (линк)" : "общ PDF за деня");
  const links = failed.map((o) => ({ ref: o.order_ref ?? `#${o.id}`, url: o.econt_label_pdf_url ?? "" })).filter((l) => l.url);
  return {
    ok: !!pdf,
    message: pdf ? `${rows.length - failed.length} етикета в един PDF${failed.length ? `, ${failed.length} само като линк` : ""}.` : "PDF-ите не можаха да се обединят: ето линковете.",
    pdfBase64: pdf ? Buffer.from(pdf).toString("base64") : undefined,
    links,
  };
}

// ── Live refresh ─────────────────────────────────────────────────────────────

/**
 * A short fingerprint of "anything changed": the newest order update + the newest history row (panel and partner). The board
 * asks every 5 s and refreshes itself when it differs. It reveals nothing about which order changed, so it needs no scope filter
 * (Koko may refresh for a change on an order he cannot see - he still only gets his own orders).
 */
export async function boardVersion(): Promise<string> {
  if (!(await getAdminSession())) return "";
  const sb = await adminDb();
  const [o, l, p] = await Promise.all([
    sb.from("orders").select("updated_at").order("updated_at", { ascending: false, nullsFirst: false }).limit(1),
    sb.from("order_status_log").select("changed_at").order("changed_at", { ascending: false }).limit(1),
    sb.from("partner_status_log").select("changed_at").order("changed_at", { ascending: false }).limit(1),
  ]);
  const top = (r: { data: unknown }, k: string) => String(((r.data as Record<string, unknown>[] | null)?.[0] ?? {})[k] ?? "");
  return [top(o, "updated_at"), top(l, "changed_at"), top(p, "changed_at")].join("|");
}

// ── "Подател по групи" (owner only) ──────────────────────────────────────────
// The sender of each group of orders (supabase/shipping_senders.sql): office (from Econt's list), the person + phone, the Econt
// account. Every change is logged by the table's trigger with the owner's e-mail (shipping_senders_log). No deploy needed.

export type SenderEditRow = SenderRow & { office_name?: string | null };
export type SenderLogRow = { sender_group: string; old_row: Partial<SenderRow> | null; new_row: Partial<SenderRow> | null; changed_by_email: string | null; changed_at: string };

export async function getSenders(): Promise<{ ok: boolean; message?: string; rows: SenderEditRow[]; log: SenderLogRow[] }> {
  if ((await getAdminSession())?.role !== "owner") return { ok: false, message: "Само за собственика.", rows: [], log: [] };
  const sb = await adminDb();
  const { data, error } = await sb.from("shipping_senders").select("*");
  if (error) return { ok: false, message: /shipping_senders|schema cache|does not exist/i.test(error.message) ? "Таблицата още я няма: пусни supabase/shipping_senders.sql." : error.message, rows: [], log: [] };
  const list = await getOfficeList();
  const name = (c: string | null) => (c ? list?.offices.find((o) => o.c === c)?.n ?? null : null);
  const order = SENDER_GROUPS.map((g) => g.key);
  const rows = ((data ?? []) as SenderRow[]).sort((a, b) => order.indexOf(a.sender_group) - order.indexOf(b.sender_group))
    .map((r) => ({ ...r, office_name: name(r.econt_office_code) }));
  const lg = await sb.from("shipping_senders_log").select("sender_group, old_row, new_row, changed_by_email, changed_at").order("changed_at", { ascending: false }).limit(15);
  return { ok: true, rows, log: (lg.data ?? []) as SenderLogRow[] };
}

export async function saveSender(input: { group: SenderGroup; office: string; name: string; phone: string; account: DbAccount }): Promise<{ ok: boolean; message: string }> {
  const me = await getAdminSession();
  if (me?.role !== "owner") return { ok: false, message: "Само за собственика." };
  if (!SENDER_GROUPS.some((g) => g.key === input.group)) return { ok: false, message: "Непозната група." };
  const office = String(input.office ?? "").trim();
  const list = await getOfficeList();
  if (office && !list?.offices.some((o) => o.c === office)) return { ok: false, message: "Няма такъв офис в списъка на Еконт." };
  const name = String(input.name ?? "").trim().slice(0, 120);
  const phone = String(input.phone ?? "").trim().slice(0, 40);
  if (phone && phone.replace(/\D/g, "").length < 9) return { ok: false, message: "Телефонът изглежда непълен." };
  const account: DbAccount = input.group === "chronobg" ? "chronobg" : input.account === "partner" ? "partner" : "lr";
  const sb = await adminDb();
  const { error } = await sb.from("shipping_senders").upsert({
    sender_group: input.group, econt_office_code: office || null, sender_name: name || null, sender_phone: phone || null,
    econt_account: account, updated_by: me.email,
  }, { onConflict: "sender_group" });
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: "Записано." };
}
