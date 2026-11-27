// Econt товарителници from the panel (owner, 27.11.2026) - the server part. The pure builder is lib/econt-shipping-core.ts.
//
// MODE (env ECONT_LABELS_MODE):
//   unset / anything else = OFF: nothing is created, the panel hides the buttons, confirming an order does not call Econt.
//   "demo" = demo.econt.com with the demo login (ECONT_DEMO_USER / ECONT_DEMO_PASS, else Econt's public test account).
//   "live" = the real Econt accounts: ours (ECONT_USER / ECONT_PASS), CHRONOBG (CHRONOBG_ECONT_USERNAME / _PASSWORD),
//            partner (PARTNER_ECONT_USER / _PASS). Never a fallback between them.
//
// SENDER: per group of orders (table shipping_senders, edited by the owner in the panel): main / womens_jewelry / chronobg.
// The group decides the office, the person who hands it over and the Econt account. A group without a sender = error, never
// another group's sender. The account that made a label is stored on the order (econt_label_account): cancel / status use it.
//
// SAFETY
//  - Idempotent: an order with an econt_shipment_number never gets a second one. The claim is ONE conditional UPDATE
//    (none|error|cancelled -> pending, while status = 'confirmed'), so two clicks / two people / the auto-trigger and a button
//    can never both reach Econt for the same order. A 'pending' older than 5 minutes is stale (the server died mid-way) and may
//    be claimed again ONLY from the "Създай отново" button (retryStale) - it may already exist in Econt, the error says so.
//  - The status is checked on the server: a cancelled / not-confirmed order is refused (labelBlockReason).
//  - Race: if the order is cancelled while its label is being created, the new label is deleted in Econt straight away.
//  - Every status change of the label writes a history row with WHO (trigger trg_log_econt_label, supabase/econt_labels.sql).

import type { SupabaseClient } from "@supabase/supabase-js";
import { getEcontAuth, getRawStatuses } from "./econt";
import { getOfficeList } from "./econt-offices";
import { allProducts } from "./products";
import { sofiaDay, sofiaMidnight, shiftDay } from "./sofia-time";
import {
  buildLabel, econtErrorText, isOfficeDelivery, labelBlockReason, matchOffice, officeCodeOf, senderGroupOf, senderProblem,
  accountOfDb, dbOfAccount, NO_SENDER, ACCOUNT_LABEL, type EcontAccount, type LabelOrder, type Sender, type SenderGroup, type SenderRow,
} from "./econt-shipping-core";

export type LabelMode = "off" | "demo" | "live";
export const labelMode = (): LabelMode => {
  const m = (process.env.ECONT_LABELS_MODE ?? "").trim().toLowerCase();
  return m === "live" ? "live" : m === "demo" ? "demo" : "off";
};

const BASES: Record<Exclude<LabelMode, "off">, string> = {
  live: "https://ee.econt.com/services",
  demo: "https://demo.econt.com/ee/services",
};
// Econt's own published test account for demo.econt.com (not a secret: it is in Econt's API documentation).
const ECONT_PUBLIC_DEMO = { user: "iasp-dev", pass: "1Asp-dev" };

function authFor(account: EcontAccount, mode: Exclude<LabelMode, "off">): { header: string; available: boolean } {
  const basic = (u: string, p: string) => ({ header: "Basic " + Buffer.from(`${u}:${p}`).toString("base64"), available: !!(u && p) });
  if (mode === "demo") return basic(process.env.ECONT_DEMO_USER || ECONT_PUBLIC_DEMO.user, process.env.ECONT_DEMO_PASS || ECONT_PUBLIC_DEMO.pass);
  if (account === "partner") return basic(process.env.PARTNER_ECONT_USER ?? "", process.env.PARTNER_ECONT_PASS ?? "");
  return getEcontAuth(account);
}

const ENV_HINT: Record<EcontAccount, string> = {
  "lorenzo-ricci": "ECONT_USER / ECONT_PASS",
  chronobg: "CHRONOBG_ECONT_USERNAME / CHRONOBG_ECONT_PASSWORD",
  partner: "PARTNER_ECONT_USER / PARTNER_ECONT_PASS",
};

class EcontCallError extends Error {}

async function econtCall<T>(account: EcontAccount, path: string, body: unknown): Promise<T> {
  const mode = labelMode();
  if (mode === "off") throw new EcontCallError("Товарителниците от панела са изключени (ECONT_LABELS_MODE).");
  const auth = authFor(account, mode);
  if (!auth.available) throw new EcontCallError(`Липсват данни за Еконт акаунта на ${ACCOUNT_LABEL[account]} (${ENV_HINT[account]}).`);
  let r: Response;
  try {
    r = await fetch(`${BASES[mode]}/${path}.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: auth.header },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    });
  } catch {
    throw new EcontCallError("Еконт не отговаря. Опитай пак след минута.");
  }
  if (r.status === 401 || r.status === 403) throw new EcontCallError(`Еконт отказа достъп: грешно потребителско име/парола за акаунта на ${ACCOUNT_LABEL[account]}.`);
  const text = await r.text();
  let data: unknown;
  try { data = JSON.parse(text); } catch { throw new EcontCallError(`Еконт върна неочакван отговор (HTTP ${r.status}).`); }
  const d = data as { type?: string; message?: string };
  if (!r.ok || (d && typeof d.type === "string" && /^Ex/.test(d.type))) throw new EcontCallError(econtErrorText(data));
  return data as T;
}

// ── Sender: the group's row (shipping_senders) + the company from the Econt account's profile ──

const profileCache = new Map<string, { at: number; client: Sender["client"] }>();

/** The company that sends (the Econt account's profile), cached an hour per account. */
async function companyOf(account: EcontAccount): Promise<Sender["client"]> {
  const key = `${labelMode()}:${account}`;
  const hit = profileCache.get(key);
  if (hit && Date.now() - hit.at < 3_600_000) return hit.client;
  type Profile = { client?: { name?: string; phones?: string[]; email?: string } };
  const data = await econtCall<{ profiles?: Profile[] }>(account, "Profile/ProfileService.getClientProfiles", {});
  const p = data.profiles?.[0];
  if (!p?.client?.name) throw new EcontCallError(`Еконт акаунтът на ${ACCOUNT_LABEL[account]} няма профил на подател.`);
  const client = { name: p.client.name, phones: (p.client.phones ?? []).filter(Boolean).slice(0, 1), ...(p.client.email ? { email: p.client.email } : {}) };
  profileCache.set(key, { at: Date.now(), client });
  return client;
}

/** The sender row of a group; null when the table / row is missing (= "Няма зададен подател"). */
export async function readSender(sb: SupabaseClient, group: SenderGroup): Promise<SenderRow | null> {
  const { data, error } = await sb.from("shipping_senders").select("*").eq("sender_group", group).maybeSingle();
  if (error) { console.error("[econt-shipping] shipping_senders:", error.message); return null; }
  return (data as SenderRow) ?? null;
}

async function senderOf(row: SenderRow, account: EcontAccount): Promise<Sender> {
  return {
    client: await companyOf(account),
    agent: { name: String(row.sender_name).trim(), phones: [String(row.sender_phone).trim()] },
    officeCode: String(row.econt_office_code).trim(),
  };
}

/** The account a label was made from (stored), else what its group says now. */
async function accountOfLabel(sb: SupabaseClient, o: LabelRow): Promise<EcontAccount> {
  if (o.econt_label_account) return accountOfDb(o.econt_label_account);
  const group = senderGroupOf(o);
  if (group === "chronobg") return "chronobg";
  return accountOfDb((await readSender(sb, group))?.econt_account);
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const categoryMap = new Map(allProducts.map((p) => [p.slug, String((p as { category?: string }).category ?? "")]));
const categoryOf = (slug: string) => categoryMap.get(slug);

const STALE_PENDING_MS = 5 * 60_000;

export type LabelRow = LabelOrder & {
  econt_shipment_number?: string | null;
  econt_label_pdf_url?: string | null;
  econt_label_status?: string | null;
  econt_label_error?: string | null;
  econt_label_created_at?: string | null;
  econt_label_account?: string | null;
  updated_at?: string | null;
};

async function readOrder(sb: SupabaseClient, id: number): Promise<LabelRow | null> {
  const { data } = await sb.from("orders").select("*").eq("id", id).maybeSingle();
  return (data as LabelRow) ?? null;
}

/** Resolve the receiver office: the code we have, or (CHRONOBG) the office text matched to Econt's list. */
async function resolveOffice(o: LabelRow): Promise<{ code: string | null; error?: string }> {
  if (!isOfficeDelivery(o)) return { code: null };
  const code = officeCodeOf(o);
  if (code) return { code };
  const list = await getOfficeList();
  if (!list) return { code: null, error: "Списъкът с офиси на Еконт не се зарежда. Опитай пак след минута." };
  const hit = matchOffice(o.city, o.address, list.offices, list.cities);
  return hit ? { code: hit } : { code: null, error: `Офисът не е разпознат: ${[o.city, o.address].filter(Boolean).join(", ") || "—"}` };
}

async function setError(sb: SupabaseClient, id: number, text: string, from = "pending"): Promise<void> {
  await sb.from("orders").update({ econt_label_status: "error", econt_label_error: text.slice(0, 900) }).eq("id", id).eq("econt_label_status", from);
}

// ── Create ──────────────────────────────────────────────────────────────────

export type LabelResult =
  | { ok: true; shipmentNumber: string; pdfUrl: string; already?: boolean }
  | { ok: false; error: string; skipped?: boolean };

/**
 * Create the Econt label of one order (validate, then create). Safe to call many times and from many places at once.
 * retryStale: the "Създай отново" button may take over a 'pending' that has been stuck for > 5 minutes.
 */
export async function createEcontLabel(sb: SupabaseClient, orderId: number, opts: { retryStale?: boolean } = {}): Promise<LabelResult> {
  if (labelMode() === "off") return { ok: false, error: "Товарителниците от панела са изключени.", skipped: true };
  const o = await readOrder(sb, orderId);
  if (!o) return { ok: false, error: "Поръчката не е намерена." };
  if (o.econt_shipment_number && o.econt_label_status === "created") {
    return { ok: true, shipmentNumber: o.econt_shipment_number, pdfUrl: o.econt_label_pdf_url ?? "", already: true };
  }
  const blocked = labelBlockReason(o);
  if (blocked) return { ok: false, error: blocked, skipped: true };

  // ── the claim: one conditional UPDATE, only one caller wins ──
  const staleBefore = new Date(Date.now() - STALE_PENDING_MS).toISOString();
  const claimable = opts.retryStale
    ? `econt_label_status.in.(none,error,cancelled),and(econt_label_status.eq.pending,updated_at.lt.${staleBefore})`
    : "econt_label_status.in.(none,error,cancelled)";
  const { data: claimed, error: claimErr } = await sb.from("orders")
    .update({ econt_label_status: "pending", econt_label_error: null, econt_shipment_number: null, econt_label_pdf_url: null })
    .eq("id", orderId).eq("status", "confirmed").or(claimable)
    .select("id");
  if (claimErr) return { ok: false, error: `База данни: ${claimErr.message}` };
  if (!claimed?.length) {
    const now = await readOrder(sb, orderId);
    if (now?.econt_label_status === "created" && now.econt_shipment_number) return { ok: true, shipmentNumber: now.econt_shipment_number, pdfUrl: now.econt_label_pdf_url ?? "", already: true };
    if (now?.econt_label_status === "pending") return { ok: false, error: "Товарителницата в момента се създава (друг потребител или автоматично). Изчакай няколко секунди.", skipped: true };
    return { ok: false, error: labelBlockReason(now ?? o) ?? "Поръчката е променена междувременно. Презареди.", skipped: true };
  }

  const group = senderGroupOf(o);
  const row = await readSender(sb, group);
  const problem = senderProblem(group, row);
  if (problem || !row) { const t = problem ?? NO_SENDER; await setError(sb, orderId, t); return { ok: false, error: t }; }
  const account = accountOfDb(row.econt_account);
  try {
    const office = await resolveOffice(o);
    if (office.error) { await setError(sb, orderId, office.error); return { ok: false, error: office.error }; }
    const sender = await senderOf(row, account);
    const built = buildLabel(o, sender, categoryOf, office.code);
    if ("error" in built) { await setError(sb, orderId, built.error); return { ok: false, error: built.error }; }

    type LabelAnswer = { label?: { shipmentNumber?: string | null; pdfURL?: string | null } };
    await econtCall<LabelAnswer>(account, "Shipments/LabelService.createLabel", { label: built.label, mode: "validate" });
    const made = await econtCall<LabelAnswer>(account, "Shipments/LabelService.createLabel", { label: built.label, mode: "create" });
    const num = String(made.label?.shipmentNumber ?? "").trim();
    const pdf = String(made.label?.pdfURL ?? "").trim();
    if (!num) { const t = "Еконт не върна номер на товарителница."; await setError(sb, orderId, t); return { ok: false, error: t }; }

    // Write it down (3 tries: a label that exists in Econt but not here would be made twice later).
    let saved = false;
    for (let i = 0; i < 3 && !saved; i++) {
      const { data, error } = await sb.from("orders")
        .update({ econt_label_status: "created", econt_shipment_number: num, econt_label_pdf_url: pdf || null, econt_label_created_at: new Date().toISOString(), econt_label_error: null, econt_label_account: dbOfAccount(account) })
        .eq("id", orderId).eq("econt_label_status", "pending").select("id");
      saved = !error && !!data?.length;
      if (!saved && i < 2) await new Promise((r) => setTimeout(r, 400));
    }
    if (!saved) {
      // Could not record it: take it back out of Econt so a later click does not make a second one.
      await deleteInEcont(account, num).catch(() => null);
      const t = `Товарителница ${num} беше създадена, но не се записа в базата и беше анулирана. Опитай пак.`;
      await setError(sb, orderId, t);
      return { ok: false, error: t };
    }

    // Race: cancelled while we were at Econt -> undo at once.
    const after = await readOrder(sb, orderId);
    if (after && after.status !== "confirmed" && after.status !== "shipped") {
      await cancelEcontLabel(sb, orderId);
      return { ok: false, error: `Поръчката беше отказана, докато се създаваше товарителницата: ${num} е анулирана.` };
    }
    return { ok: true, shipmentNumber: num, pdfUrl: pdf };
  } catch (e) {
    const t = e instanceof EcontCallError ? e.message : `Неочаквана грешка: ${e instanceof Error ? e.message : String(e)}`;
    await setError(sb, orderId, t);
    return { ok: false, error: t };
  }
}

// ── Cancel ──────────────────────────────────────────────────────────────────

async function deleteInEcont(account: EcontAccount, num: string): Promise<{ ok: boolean; error?: string; gone?: boolean }> {
  const data = await econtCall<{ results?: Array<{ shipmentNum?: string; error?: { message?: string } | null }> }>(
    account, "Shipments/LabelService.deleteLabels", { shipmentNumbers: [num] });
  const r = data.results?.find((x) => String(x.shipmentNum) === num) ?? data.results?.[0];
  if (!r) return { ok: false, error: "Еконт не потвърди анулирането." };
  if (!r.error) return { ok: true };
  const msg = String(r.error.message ?? "");
  if (/не е открита|not found/i.test(msg)) return { ok: true, gone: true };   // already deleted
  return { ok: false, error: econtErrorText(r.error) };
}

/** Accepted by Econt already (sendTime set) = it is on its way; a label can no longer be deleted. */
async function acceptedByEcont(account: EcontAccount, num: string): Promise<boolean | null> {
  const mode = labelMode();
  if (mode === "off") return null;
  if (mode === "live") {
    const m = await getRawStatuses([num], account === "partner" ? null : account).catch(() => null);
    return m ? m.get(num)?.sendTime != null : null;
  }
  const data = await econtCall<{ shipmentStatuses?: Array<{ status?: { sendTime?: number | null } | null }> }>(
    account, "Shipments/ShipmentService.getShipmentStatuses", { shipmentNumbers: [num] }).catch(() => null);
  return data ? data.shipmentStatuses?.[0]?.status?.sendTime != null : null;
}

export type CancelResult = { ok: boolean; message: string; state: "cancelled" | "none" | "accepted" | "error" };

/** Delete the order's label in Econt (only while Econt has not taken the parcel) and mark it 'cancelled'. */
export async function cancelEcontLabel(sb: SupabaseClient, orderId: number): Promise<CancelResult> {
  const o = await readOrder(sb, orderId);
  if (!o || !o.econt_shipment_number || o.econt_label_status !== "created") return { ok: true, message: "", state: "none" };
  if (labelMode() === "off") return { ok: false, message: `Поръчката има товарителница ${o.econt_shipment_number}: анулирай я ръчно в Еконт.`, state: "error" };
  const account = await accountOfLabel(sb, o);
  const num = o.econt_shipment_number;
  try {
    const accepted = await acceptedByEcont(account, num);
    if (accepted) {
      const t = `Пратка ${num} вече е приета от Еконт: не може да се анулира автоматично. Спри я в Еконт.`;
      await sb.from("orders").update({ econt_label_error: t }).eq("id", orderId);
      return { ok: false, message: t, state: "accepted" };
    }
    const del = await deleteInEcont(account, num);
    if (!del.ok) {
      const t = `Анулирането на ${num} в Еконт не успя: ${del.error}`;
      await sb.from("orders").update({ econt_label_error: t }).eq("id", orderId);
      return { ok: false, message: t, state: "error" };
    }
    await sb.from("orders").update({ econt_label_status: "cancelled", econt_label_error: null }).eq("id", orderId).eq("econt_label_status", "created");
    return { ok: true, message: `Товарителница ${num} е анулирана в Еконт.`, state: "cancelled" };
  } catch (e) {
    const t = `Анулирането на ${num} не успя: ${e instanceof Error ? e.message : String(e)}`;
    await sb.from("orders").update({ econt_label_error: t }).eq("id", orderId);
    return { ok: false, message: t, state: "error" };
  }
}

// ── Label accepted by Econt -> order shipped (the cron and the "check" button) ──

/** A confirmed order whose panel label Econt has physically accepted becomes 'shipped' with that AWB (no phone guessing). */
export async function promoteAcceptedLabels(sb: SupabaseClient): Promise<number> {
  if (labelMode() === "off") return 0;
  const { data, error } = await sb.from("orders").select("*").eq("status", "confirmed").eq("econt_label_status", "created").not("econt_shipment_number", "is", null);
  if (error || !data?.length) return 0;
  let n = 0;
  for (const o of data as LabelRow[]) {
    const num = String(o.econt_shipment_number);
    if (await acceptedByEcont(await accountOfLabel(sb, o), num)) {
      const { data: up } = await sb.from("orders").update({ tracking_number: num, status: "shipped" }).eq("id", o.id).eq("status", "confirmed").select("id");
      if (up?.length) n++;
    }
  }
  return n;
}

// ── Today's labels: one PDF ─────────────────────────────────────────────────

export async function todaysLabels(sb: SupabaseClient): Promise<LabelRow[]> {
  const today = sofiaDay();
  const from = sofiaMidnight(today).toISOString();
  const to = sofiaMidnight(shiftDay(today, 1)).toISOString();
  const { data } = await sb.from("orders").select("*").eq("econt_label_status", "created")
    .gte("econt_label_created_at", from).lt("econt_label_created_at", to).order("econt_label_created_at", { ascending: true });
  return (data ?? []) as LabelRow[];
}

/** Fetch each label PDF and merge them into one. Returns the merged bytes and the orders whose PDF could not be read. */
export async function mergeLabelPdfs(rows: LabelRow[]): Promise<{ pdf: Uint8Array | null; failed: LabelRow[] }> {
  const { PDFDocument } = await import("pdf-lib");
  const out = await PDFDocument.create();
  const failed: LabelRow[] = [];
  for (const o of rows) {
    try {
      if (!o.econt_label_pdf_url) throw new Error("no url");
      const r = await fetch(o.econt_label_pdf_url, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
      const buf = new Uint8Array(await r.arrayBuffer());
      if (!r.ok || String.fromCharCode(...buf.slice(0, 4)) !== "%PDF") throw new Error("not a pdf");
      const src = await PDFDocument.load(buf);
      for (const p of await out.copyPages(src, src.getPageIndices())) out.addPage(p);
    } catch {
      failed.push(o);
    }
  }
  return { pdf: out.getPageCount() ? await out.save() : null, failed };
}
