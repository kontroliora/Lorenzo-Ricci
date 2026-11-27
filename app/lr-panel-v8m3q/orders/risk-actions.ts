"use server";

// Некоректни клиенти: panel actions. Every action writes a row into order_status_log (the existing history), with the
// signed-in admin's e-mail, so the history says who did it (Давид / Коко / ...).
import { revalidatePath } from "next/cache";
import { adminDb, getAdminSession } from "@/lib/supabase/admin-db";
import { fulfillmentVisible } from "@/lib/fulfillment-filter";
import { isReturn, type OrderItem } from "@/lib/orders";
import { normPhone, bgDate } from "@/lib/customer-risk-shared";
import { checkCustomer, createReport, nekorektenConfigured, SOURCE, type ReportPayload } from "@/lib/nekorekten";

const ORDERS_PATH = "/lr-panel-v8m3q/orders";

type OrderRow = {
  id: number; order_ref: string | null; name: string | null; phone: string | null; email: string | null; status: string;
  return_kind?: string | null; total: number | null; created_at: string; items: OrderItem[] | null; source_site?: string | null; ship_country?: string | null;
};

/** The order, if this admin may see it (Коко: not the jewellery-only ones - same rule as the board). */
async function loadOrder(id: number): Promise<{ row: OrderRow } | { error: string }> {
  const me = await getAdminSession();
  if (!me) return { error: "Нямате достъп (влезте отново в панела)." };
  const { data, error } = await (await adminDb()).from("orders").select("*").eq("id", id).maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Поръчката не е намерена." };
  const row = data as OrderRow;
  if (me.role === "fulfillment" && !fulfillmentVisible(row)) return { error: "Поръчката не е намерена." };
  return { row };
}

async function audit(orderId: number, what: string, text: string): Promise<string | null> {
  const sb = await adminDb();
  const me = await getAdminSession();
  const { count } = await sb.from("order_status_log").select("order_id", { count: "exact", head: true }).eq("order_id", orderId);
  const { error } = await sb.from("order_status_log").insert({
    order_id: orderId, old_status: what, new_status: text.slice(0, 300),
    changed_by: me?.userId ?? null, changed_by_email: me?.email ?? null, change_number: (count ?? 0) + 1,
  });
  if (error) console.error("[risk] audit write failed:", error.message);
  return error ? `Записът в историята не успя: ${error.message}` : null;
}

/** "Провери отново": asks Nekorekten.com now (ignores the 7-day cache). */
export async function recheckExternal(orderId: number): Promise<{ ok: boolean; message: string }> {
  const o = await loadOrder(orderId);
  if ("error" in o) return { ok: false, message: o.error };
  if (!nekorektenConfigured()) return { ok: false, message: "Външната проверка не е настроена (липсва NEKOREKTEN_API_KEY във Vercel)." };
  const r = await checkCustomer(await adminDb(), o.row.phone, o.row.email, { force: true });
  revalidatePath(ORDERS_PATH);
  if (r.status === "checked") return { ok: true, message: `Nekorekten.com: ${r.count} доклад(а).` };
  return { ok: false, message: `Външна проверка: недостъпна${r.error ? ` (${r.error})` : ""}. Панелът работи нормално.` };
}

/** "Маркирай като некоректен" / "Премахни маркировката" - always with a note. */
export async function setCustomerFlag(orderId: number, flagged: boolean, note: string): Promise<string | null> {
  const t = String(note ?? "").trim().slice(0, 500);
  if (!t) return "Напишете бележка (защо).";
  const o = await loadOrder(orderId);
  if ("error" in o) return o.error;
  const norm = normPhone(o.row.phone);
  if (!norm) return "Поръчката няма телефон.";
  const me = await getAdminSession();
  const sb = await adminDb();
  const { error } = await sb.from("customer_flags").upsert(
    { phone_norm: norm, flagged, note: t, updated_by_email: me?.email ?? null, updated_at: new Date().toISOString() },
    { onConflict: "phone_norm" },
  );
  if (error) {
    console.error("[risk] flag write failed:", error.message);
    return /customer_flags|schema cache|does not exist/i.test(error.message)
      ? "Таблицата за маркировки още не е създадена (пуснете supabase/customer_risk.sql в Supabase)."
      : error.message;
  }
  const warn = await audit(orderId, "некоректен", `${flagged ? "маркиран като некоректен" : "маркировката премахната"}: ${t}`);
  revalidatePath(ORDERS_PATH);
  return warn;
}

// ── "Докладвай в Nekorekten" ────────────────────────────────────────────────
// Only for a parcel that came back (непотърсена / отказана), only the owner, only after the dialog showed exactly what goes out.

function splitName(name: string | null): { firstName?: string; lastName?: string } {
  const parts = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return {};
  if (parts.length === 1) return { firstName: parts[0] };
  return { firstName: parts[0], lastName: parts[parts.length - 1] };
}

function defaultText(o: OrderRow): string {
  const what = o.return_kind === "refused" ? "Отказа пратка с наложен платеж в офиса на куриера" : "Не потърси пратка с наложен платеж от офиса на куриера";
  const amount = Number(o.total) > 0 ? ` на стойност €${Number(o.total).toFixed(2)}` : "";
  return `${what} (поръчка от ${bgDate(o.created_at)}${amount}). Пратката се върна и платихме доставката в двете посоки.`;
}

function buildPayload(o: OrderRow, text: string, includeEmail: boolean): ReportPayload | null {
  const norm = normPhone(o.phone);
  if (!norm) return null;
  const p: ReportPayload = { text: text.trim(), phone: norm, ...splitName(o.name) };
  if (includeEmail && o.email) p.email = o.email.trim();
  return p;
}

export type ReportPreview = { ok: true; payload: ReportPayload; defaultText: string; email: string | null; alreadySent: string | null } | { ok: false; message: string };

async function reportGate(orderId: number): Promise<{ row: OrderRow } | { error: string }> {
  const me = await getAdminSession();
  if (me?.role !== "owner") return { error: "Само собственикът може да докладва." };
  if (!nekorektenConfigured()) return { error: "Външната проверка не е настроена (липсва NEKOREKTEN_API_KEY във Vercel)." };
  const o = await loadOrder(orderId);
  if ("error" in o) return o;
  if (!isReturn(o.row.status)) return { error: "Докладва се само непотърсена или отказана пратка." };
  return o;
}

async function sentBefore(orderId: number): Promise<string | null> {
  const { data, error } = await (await adminDb()).from("external_reports_sent").select("sent_at, sent_by_email").eq("order_id", orderId).eq("source", SOURCE).limit(1);
  if (error) return null;
  const r = (data ?? [])[0] as { sent_at: string; sent_by_email: string | null } | undefined;
  return r ? `${bgDate(r.sent_at)}${r.sent_by_email ? ` (${r.sent_by_email.split("@")[0]})` : ""}` : null;
}

/** What WOULD be sent (shown in the dialog). Sends nothing. */
export async function previewNekorektenReport(orderId: number): Promise<ReportPreview> {
  const o = await reportGate(orderId);
  if ("error" in o) return { ok: false, message: o.error };
  const text = defaultText(o.row);
  const payload = buildPayload(o.row, text, false);
  if (!payload) return { ok: false, message: "Поръчката няма телефон." };
  return { ok: true, payload, defaultText: text, email: o.row.email?.trim() || null, alreadySent: await sentBefore(orderId) };
}

/** Sends the report - called ONLY by the dialog's confirm button. The payload is rebuilt here from the database (same builder). */
export async function sendNekorektenReport(orderId: number, text: string, includeEmail: boolean): Promise<{ ok: boolean; message: string }> {
  const o = await reportGate(orderId);
  if ("error" in o) return { ok: false, message: o.error };
  const t = String(text ?? "").trim();
  if (t.length < 10) return { ok: false, message: "Описанието е твърде кратко." };
  if (t.length > 2000) return { ok: false, message: "Описанието е твърде дълго." };
  const already = await sentBefore(orderId);
  if (already) return { ok: false, message: `Тази пратка вече е докладвана на ${already}.` };
  const payload = buildPayload(o.row, t, includeEmail);
  if (!payload) return { ok: false, message: "Поръчката няма телефон." };
  const r = await createReport(payload);
  const me = await getAdminSession();
  const sb = await adminDb();
  if (!r.ok) {
    console.error("[nekorekten] report failed:", r.error);
    return { ok: false, message: `Докладът НЕ е изпратен: ${r.error}` };
  }
  const log = await sb.from("external_reports_sent").insert({ order_id: orderId, phone: payload.phone, source: SOURCE, payload, response: r.json, sent_by_email: me?.email ?? null });
  if (log.error) console.error("[nekorekten] sent-log write failed:", log.error.message);
  const warn = await audit(orderId, "nekorekten", "докладван в Nekorekten.com");
  revalidatePath(ORDERS_PATH);
  return { ok: true, message: `Докладът е изпратен в Nekorekten.com.${warn ? ` ${warn}` : ""}` };
}
