// "Потвърдете поръчката си" e-mail (owner, 18.11.2026): customers whose order is at "не вдига (1)" or "не вдига (2)" get ONE
// e-mail with a signed button; a click confirms the order exactly like a phone confirmation (app/api/order-confirm).
// Sent once per order: confirm_email_sent_at is CLAIMED (set only while NULL) before Resend is called; a failed send clears it.
// Bulgarian template only: a Romanian order is never mailed (CLAUDE.md, lib/mail-policy.ts).
// mail-policy: confirm_request
import type { SupabaseClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { emailHead, emailHeaderRow, emailOrderRefRow, ORDER_REPLY_TO, goldButton } from "@/lib/email-layout";
import { langOf, mayEmail } from "@/lib/mail-policy";
import { hasCardMoney } from "@/lib/payments";
import { getCatalogProductBySlug } from "@/lib/products";
import { currentNameBg } from "@/lib/email-names";
import { pieceInfo } from "@/lib/partner/orders";
import { confirmToken } from "@/lib/order-confirm-token";
import { SITE_URL } from "@/lib/site";

/**
 * AUTOMATIC sending when staff press "Не вдига" (1st or 2nd attempt). ON since the owner's "пращай" (18.11.2026), after he saw
 * the list and the test e-mail. The backlog page is /lr-panel-v8m3q/orders/confirm-emails.
 */
export const CONFIRM_REQUEST_AUTO = true;

const FROM = "Lorenzo Ricci <info@lorenzo-ricci.com>";
const NAVY = "#0a0e1f";

export type ConfirmRow = {
  id: number; order_ref: string | null; name: string | null; email: string | null; phone: string | null;
  city: string | null; address: string | null; post_code?: string | null; courier: string | null; shipping_method: string | null;
  items: unknown; total: number | null; status: string; call_state: string; call_attempts: number;
  excluded_from_stock?: boolean | null; is_international?: boolean | null; ship_country?: string | null; lang?: string | null;
  payment_method?: string | null; payment_status?: string | null; stripe_payment_intent?: string | null;
  confirm_email_sent_at?: string | null; email_confirmed_at?: string | null; created_at?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const hasEmail = (o: { email?: string | null }) => EMAIL_RE.test(String(o.email ?? "").trim());

/** At "не вдига (1)" / "не вдига (2)", still open (not cancelled / confirmed / shipped), Bulgarian, a real order. Email NOT checked. */
export function isNoAnswerTarget(o: ConfirmRow): boolean {
  return o.status === "new"
    && o.call_state === "no_answer"
    && (o.call_attempts === 1 || o.call_attempts === 2)
    && !o.email_confirmed_at
    && !o.excluded_from_stock
    && !o.is_international
    && o.payment_status !== "refunded"
    && langOf(o) === "bg";
}

/** May get the e-mail now: a target with an e-mail address that has not been mailed yet. */
export const mayMail = (o: ConfirmRow) => isNoAnswerTarget(o) && hasEmail(o) && !o.confirm_email_sent_at;

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

type Line = { slug?: unknown; name?: unknown; quantity?: unknown; qty?: unknown; gift?: unknown };

/** "Гривна Verdis Gold · ×1" / "Часовник X · цвят: Черен · ×1" — name, colour (from the catalogue), quantity. */
export function itemLines(items: unknown): { name: string; color: string; qty: number; gift: boolean }[] {
  const raw = Array.isArray(items) ? (items as Line[]) : [];
  return raw.map((l) => {
    const slug = String(l.slug ?? "");
    const piece = slug ? pieceInfo(slug) : undefined;
    const product = slug ? getCatalogProductBySlug(slug) : undefined;
    const specColor = product?.specs?.find((s) => s.label === "Цвят")?.value?.trim() ?? "";
    // No gold / silver wording in Bulgarian in the e-mail (owner, 28.11.2026): a collection piece's name already says Gold / Silver (no
    // colour line), the other gold / silver products read "Gold" / "Silver"; other colours (watches, leather) stay as they are.
    const rawColor = piece ? "" : specColor || (product?.metal === "silver" ? "Сребърен" : product?.metal === "gold" ? "Златен" : "");
    const color = rawColor === "Златен" ? "Gold" : rawColor === "Сребърен" ? "Silver" : rawColor;
    const gift = l.gift === true;
    const name = currentNameBg(slug, String(l.name ?? product?.name ?? "Артикул")).replace(/^ПОДАРЪК:\s*/, "");
    return { name: gift ? `Подарък: ${name}` : name, color, qty: Math.max(1, Number(l.quantity ?? l.qty ?? 1) || 1), gift };
  });
}

export function deliveryText(o: ConfirmRow): string {
  const place = [o.address, o.city].map((s) => String(s ?? "").trim()).filter(Boolean)
    .filter((s, i, a) => a.findIndex((x) => x.toLowerCase() === s.toLowerCase()) === i).join(", ");
  const home = String(o.courier ?? "") === "home";
  return `${home ? "Адрес (Еконт до адрес)" : "Офис на Еконт"}: ${place || "—"}`;
}

export const confirmSubject = (ref: string) => `Потвърдете поръчката си №${ref} – Lorenzo Ricci`;

export function confirmUrl(orderId: number, test = false): string | null {
  const t = confirmToken(orderId, { test });
  return t ? `${SITE_URL}/potvardi/${t}` : null;
}

export function buildConfirmRequestEmail(o: ConfirmRow, url: string): string {
  const ref = esc(o.order_ref ?? o.id);
  const firstName = esc((o.name ?? "").trim().split(/\s+/)[0] || "клиент");
  const paid = hasCardMoney(o);
  const total = `€${(Number(o.total ?? 0) || 0).toFixed(2)}`;
  const rows = itemLines(o.items).map((i) => `<tr>
        <td style="padding:10px 0;border-bottom:1px solid #e8dfc8;font-family:Georgia,serif;color:${i.gift ? "#047857" : "#1a1a1a"};font-size:14px">${esc(i.name)}${i.color ? `<br><span style="font-family:Arial,sans-serif;font-size:12px;color:#888">Цвят: ${esc(i.color)}</span>` : ""}</td>
        <td style="padding:10px 0;border-bottom:1px solid #e8dfc8;text-align:right;color:#555;font-size:14px;white-space:nowrap">×${i.qty}</td>
      </tr>`).join("");
  const P = "margin:0 0 16px;color:#555;font-size:14px;line-height:1.7";
  const LABEL = "margin:0 0 12px;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#888";
  return `<!DOCTYPE html>
<html lang="bg">${emailHead("Потвърдете поръчката си")}
<body style="margin:0;padding:0;background:#f5f0e8;font-family:Arial,Helvetica,sans-serif">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">Опитахме да Ви се обадим. Потвърдете поръчката с един бутон и я изпращаме.</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f0e8;padding:40px 16px">
  <tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#fff;max-width:560px;width:100%">
      ${emailHeaderRow(560)}
      <tr><td style="padding:0;line-height:0;font-size:0"><div style="height:2px;background:linear-gradient(to right,#b8944a,#d4af6a,#e8c878,#d4af6a,#b8944a)"></div></td></tr>
      ${emailOrderRefRow(String(o.order_ref ?? o.id), "Номер на поръчката")}
      <tr><td style="padding:32px 40px 8px">
        <p style="margin:0 0 14px;font-family:Georgia,serif;font-size:22px;color:${NAVY}">Здравейте, ${firstName},</p>
        <p style="${P}">Благодарим Ви за поръчката! Опитахме да се свържем с Вас по телефона, за да я потвърдим, но не успяхме да се чуем.</p>
        <p style="${P}">За да изпратим пратката Ви, моля, потвърдете поръчката с бутона по-долу:</p>
        ${goldButton(url, "Потвърждавам поръчката", { fontSize: 11 })}
        <p style="margin:0 0 8px;color:#555;font-size:13px;line-height:1.6;text-align:center">След като потвърдите, няма да Ви търсим повече по телефона – директно ще изпратим пратката.</p>
        <div style="border-top:1px solid #e8dfc8;margin:26px 0"></div>
        <p style="${LABEL}">Детайли на поръчката</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tbody>${rows}</tbody></table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:#444;margin-top:16px">
          <tr><td style="padding:5px 0;width:130px;color:#888;vertical-align:top">Обща сума</td><td style="padding:5px 0;color:#1a1a1a"><strong style="font-family:Georgia,serif;font-size:16px;color:${NAVY}">${total}</strong> (${paid ? "платено с карта" : "наложен платеж"})</td></tr>
          <tr><td style="padding:5px 0;color:#888;vertical-align:top">Доставка до</td><td style="padding:5px 0;color:#1a1a1a">${esc(deliveryText(o))}</td></tr>
          <tr><td style="padding:5px 0;color:#888;vertical-align:top">Телефон</td><td style="padding:5px 0;color:#1a1a1a">${esc(o.phone ?? "—")}</td></tr>
        </table>
        <div style="border-top:1px solid #e8dfc8;margin:26px 0"></div>
        <p style="${P}">Ако нещо в поръчката не е вярно или искате промяна, просто отговорете на този имейл.</p>
        <p style="margin:0;color:#555;font-size:14px;line-height:1.7">Поздрави,<br>Екипът на Lorenzo Ricci</p>
      </td></tr>
      <tr><td style="padding:24px 40px 40px;text-align:center">
        <div style="border-top:1px solid #e8dfc8;padding-top:24px">
          <p style="margin:0 0 6px;font-family:Georgia,serif;font-size:13px;color:${NAVY};letter-spacing:.08em">LORENZO RICCI</p>
          <p style="margin:0 0 12px;font-size:11px;color:#aaa;line-height:1.8">info@lorenzo-ricci.com &nbsp;·&nbsp; <a href="https://lorenzo-ricci.com" style="color:#aaa;text-decoration:none">lorenzo-ricci.com</a></p>
          <p style="margin:0;font-size:10px;color:#c8c2ba;line-height:1.7">Получавате това писмо във връзка с Вашата поръчка ${ref} в Lorenzo Ricci. Бутонът е валиден 7 дни.</p>
        </div>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function getResend(): Resend | null {
  const k = process.env.RESEND_API_KEY;
  return k ? new Resend(k) : null;
}

export const CONFIRM_SELECT = "*";

export type SendOutcome = { ok: true } | { ok: false; reason: string };

/**
 * Sends the e-mail for ONE order, once. Re-reads the order, checks it is still a target, claims confirm_email_sent_at, sends.
 * Never throws.
 */
export async function sendConfirmRequest(sb: SupabaseClient, orderId: number): Promise<SendOutcome> {
  try {
    const resend = getResend();
    if (!resend) return { ok: false, reason: "няма RESEND_API_KEY" };
    const { data, error } = await sb.from("orders").select(CONFIRM_SELECT).eq("id", orderId).maybeSingle();
    if (error || !data) return { ok: false, reason: error?.message ?? "поръчката липсва" };
    const o = data as ConfirmRow;
    if (!("confirm_email_sent_at" in o)) return { ok: false, reason: "миграцията supabase/orders_email_confirm.sql не е пусната" };
    if (!mayMail(o)) return { ok: false, reason: o.confirm_email_sent_at ? "вече изпратен" : !hasEmail(o) ? "няма имейл" : "не е „не вдига (1/2)“" };
    if (!mayEmail("confirm_request", langOf(o), "bg")) return { ok: false, reason: "не е българска поръчка" };
    const url = confirmUrl(o.id);
    if (!url) return { ok: false, reason: "няма ORDER_CONFIRM_SECRET / CRON_SECRET" };

    const nowIso = new Date().toISOString();
    const claim = await sb.from("orders").update({ confirm_email_sent_at: nowIso })
      .eq("id", o.id).is("confirm_email_sent_at", null).eq("status", "new").select("id");
    if (claim.error) return { ok: false, reason: claim.error.message };
    if (!claim.data?.length) return { ok: false, reason: "вече изпратен" };

    const { error: e } = await resend.emails.send({
      from: FROM, to: [String(o.email).trim()], replyTo: ORDER_REPLY_TO,
      subject: confirmSubject(String(o.order_ref ?? o.id)), html: buildConfirmRequestEmail(o, url),
    });
    if (e) {
      console.error("[confirm-request] send failed", o.id, e.message);
      await sb.from("orders").update({ confirm_email_sent_at: null }).eq("id", o.id).eq("confirm_email_sent_at", nowIso);
      return { ok: false, reason: e.message };
    }
    return { ok: true };
  } catch (err) {
    console.error("[confirm-request] exception", orderId, err);
    return { ok: false, reason: err instanceof Error ? err.message : "грешка" };
  }
}

/** The owner's TEST e-mail: real data of one order, sent to `to`; its link (t=1) confirms nothing. Marks nothing. */
export async function sendConfirmRequestTest(sb: SupabaseClient, orderId: number, to: string): Promise<SendOutcome> {
  const resend = getResend();
  if (!resend) return { ok: false, reason: "няма RESEND_API_KEY" };
  const { data, error } = await sb.from("orders").select(CONFIRM_SELECT).eq("id", orderId).maybeSingle();
  if (error || !data) return { ok: false, reason: error?.message ?? "поръчката липсва" };
  const o = data as ConfirmRow;
  const url = confirmUrl(o.id, true);
  if (!url) return { ok: false, reason: "няма ORDER_CONFIRM_SECRET / CRON_SECRET" };
  const { error: e } = await resend.emails.send({
    from: FROM, to: [to], replyTo: ORDER_REPLY_TO,
    subject: `[ТЕСТ] ${confirmSubject(String(o.order_ref ?? o.id))}`, html: buildConfirmRequestEmail(o, url),
  });
  return e ? { ok: false, reason: e.message } : { ok: true };
}
