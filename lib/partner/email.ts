// mail-policy: internal
import { Resend } from "resend";
import { EMAIL_IVORY, EMAIL_NAVY, emailHead, emailHeaderRow } from "../email-layout";
import { SITE_ORIGIN } from "../meta-capi";
import { sendTelegram } from "../telegram";
import { supabaseAdmin } from "../supabase-admin";
import { PARTNER_ORDER_COLUMNS, money, partnerView, partnerVisible, type PartnerOrderView } from "./orders";

// The partner's order e-mail (owner, 09.11.2026). Not a customer e-mail: Bulgarian text, to the ENABLED partners with notify on
// (table `partners`). Same restrictions as the /partner panel: built from partnerView() only (jewellery lines, name, phone,
// address; never the customer's e-mail, never the other lines or the order total).
//   - cash on delivery: right after the order is saved (/api/order);
//   - card: only once the payment is confirmed (lib/payment-notify.ts, reached only for a PAID order); never for an open / failed one.
// notifyPartnerOnce() claims orders.partner_email_sent_at first (one conditional UPDATE), so it can never go out twice. 3 tries;
// still failing -> Telegram alert to the owner and the error in orders.partner_email_error.

const FROM = "Lorenzo Ricci Orders <orders@lorenzo-ricci.com>";
const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fmtDate = (d: string) => new Date(d).toLocaleString("bg-BG", { timeZone: "Europe/Sofia", dateStyle: "short", timeStyle: "short" });

export const partnerOrderUrl = (ref: string) => `${SITE_ORIGIN}/partner?order=${encodeURIComponent(ref)}`;

export function partnerSubject(v: PartnerOrderView): string {
  return v.payment.kind === "card"
    ? `Нова поръчка #${v.ref} — ПЛАТЕНА С КАРТА`
    : `Нова поръчка #${v.ref} — НАЛОЖЕН ПЛАТЕЖ ${money(v.jewelleryTotal, v.market)}`;
}

export function buildPartnerOrderEmail(v: PartnerOrderView): string {
  const card = v.payment.kind === "card";
  const badge = card
    ? `<div style="background:#e7f6ec;border:2px solid #16a34a;color:#14532d;padding:16px 18px;font-size:18px;font-weight:700;text-align:center">✅ ПЛАТЕНО С КАРТА — не се събира нищо</div>`
    : `<div style="background:#fff3e0;border:2px solid #ea7a0c;color:#7c2d12;padding:16px 18px;font-size:18px;font-weight:700;text-align:center">💵 НАЛОЖЕН ПЛАТЕЖ — ${esc(money(v.jewelleryTotal, v.market))} за събиране</div>`;
  const row = (k: string, val: string, shade: boolean) =>
    `<tr${shade ? ' style="background:#faf7f1"' : ""}><td style="padding:9px 12px;font-weight:600;width:130px;vertical-align:top">${k}</td><td style="padding:9px 12px">${val}</td></tr>`;
  const lines = v.items.map((i) => `<tr>
      <td style="padding:9px 12px;border-bottom:1px solid #e5e7eb"><strong>${esc(i.model)}</strong><br><span style="color:#6b6456;font-size:13px">${esc([i.color, i.stone].filter(Boolean).join(" · "))}</span></td>
      <td style="padding:9px 12px;border-bottom:1px solid #e5e7eb;text-align:center">${i.qty}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #e5e7eb;text-align:right;white-space:nowrap">${esc(money(i.price, v.market))}</td>
    </tr>`).join("");
  const url = partnerOrderUrl(v.ref);

  return `<!DOCTYPE html><html lang="bg">${emailHead(esc(partnerSubject(v)))}
<body style="margin:0;padding:16px;font-family:Arial,sans-serif;background:${EMAIL_IVORY};color:${EMAIL_NAVY}">
 <div style="max-width:600px;margin:0 auto;background:#ffffff;overflow:hidden">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${emailHeaderRow(600)}</table>
  <div style="padding:8px 20px 24px">
   ${badge}
   <p style="margin:18px 0 6px;font-size:13px;color:#6b6456">Поръчка <strong style="color:${EMAIL_NAVY}">#${esc(v.ref)}</strong> · ${esc(fmtDate(v.createdAt))}</p>
   <table style="width:100%;border-collapse:collapse;font-size:15px;margin:8px 0 20px">
    ${row("Клиент", esc(v.name || "-"), true)}
    ${row("Телефон", v.phone ? `<a href="tel:${esc(v.phone.replace(/\s+/g, ""))}" style="color:${EMAIL_NAVY};font-weight:700">${esc(v.phone)}</a>` : "-", false)}
    ${row("Доставка", `${esc(v.delivery.courier)} - ${v.delivery.office ? "до офис / автомат" : "до адрес"}`, true)}
    ${row(v.delivery.office ? "Офис" : "Адрес", esc(v.delivery.place || "-"), false)}
   </table>
   <table style="width:100%;border-collapse:collapse;font-size:14px">
    <thead><tr style="background:${EMAIL_IVORY}"><th style="padding:9px 12px;text-align:left">Бижу</th><th style="padding:9px 12px">Бр.</th><th style="padding:9px 12px;text-align:right">Цена</th></tr></thead>
    <tbody>${lines}</tbody>
    <tfoot>${v.onePlusOne > 0 ? `<tr><td colspan="2" style="padding:9px 12px;color:#047857">1+1 (второто бижу безплатно)</td><td style="padding:9px 12px;text-align:right;color:#047857;white-space:nowrap">-${esc(money(v.onePlusOne, v.market))}</td></tr>` : ""}
     <tr style="background:#faf7f1;font-weight:700"><td colspan="2" style="padding:10px 12px">${card ? "Платено с карта" : "За събиране"}</td><td style="padding:10px 12px;text-align:right;white-space:nowrap">${card ? "€0.00" : esc(money(v.jewelleryTotal, v.market))}</td></tr></tfoot>
   </table>
   <p style="margin:24px 0 0;text-align:center"><a href="${esc(url)}" style="display:inline-block;background:${EMAIL_NAVY};color:#ffffff;text-decoration:none;padding:14px 26px;font-weight:700;letter-spacing:.06em">ОТВОРИ ПОРЪЧКАТА</a></p>
  </div>
 </div>
</body></html>`;
}

async function recipients(): Promise<string[]> {
  const { data, error } = await supabaseAdmin().from("partners").select("email").eq("enabled", true).eq("notify", true);
  if (error) throw new Error(`partners: ${error.message}`);
  return (data ?? []).map((r: { email: string }) => r.email).filter(Boolean);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Sends with up to 3 tries (0.5 s, 2 s apart). Throws the last error. */
export async function sendWithRetry(msg: { to: string[]; subject: string; html: string }, tries = 3): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY not set");
  const resend = new Resend(key);
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      const { error } = await resend.emails.send({ from: FROM, ...msg });
      if (!error) return;
      last = new Error(`Resend: ${error.message}`);
    } catch (e) { last = e; }
    if (i < tries - 1) await sleep(i === 0 ? 500 : 2000);
  }
  throw last instanceof Error ? last : new Error(String(last));
}

export type PartnerNotifyResult = "sent" | "not-jewellery" | "not-paid" | "already-sent" | "no-recipient" | "not-found" | "failed";

/**
 * The partner e-mail of one order, at most once. Reads the SAVED row (so card orders are checked for PAID here as well).
 * Never throws: the order is saved either way; a failure is alerted on Telegram.
 */
export async function notifyPartnerOnce(ref: string): Promise<PartnerNotifyResult> {
  try {
    const sb = supabaseAdmin();
    const { data: row, error } = await sb.from("orders").select(`${PARTNER_ORDER_COLUMNS}, partner_email_sent_at`).eq("order_ref", ref).maybeSingle();
    if (error) throw new Error(`orders: ${error.message}`);
    if (!row) return "not-found";
    const r = row as Record<string, unknown>;
    if (r.payment_method === "card" && r.payment_status !== "paid") return "not-paid";
    if (!partnerVisible(r)) return "not-jewellery";
    if (r.partner_email_sent_at) return "already-sent";
    const to = await recipients();
    if (!to.length) return "no-recipient";

    // claim: only the call that moves partner_email_sent_at from NULL sends
    const claim = await sb.from("orders").update({ partner_email_sent_at: new Date().toISOString() })
      .eq("order_ref", ref).is("partner_email_sent_at", null).select("order_ref");
    if (claim.error) throw new Error(`claim: ${claim.error.message}`);
    if (!claim.data?.length) return "already-sent";

    const v = partnerView(r);
    try {
      await sendWithRetry({ to, subject: partnerSubject(v), html: buildPartnerOrderEmail(v) });
      return "sent";
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await sb.from("orders").update({ partner_email_error: msg.slice(0, 500) }).eq("order_ref", ref);
      throw new Error(`3 опита: ${msg}`);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[partner] e-mail failed:", ref, msg);
    const t = await sendTelegram(`🚨 <b>Имейлът към партньора не излезе</b>\nПоръчка ${ref.replace(/[<>&]/g, "")}\n${msg.replace(/[<>&]/g, "").slice(0, 400)}`);
    if (!t.ok) console.error("[partner] Telegram alert failed too:", t.error);
    return "failed";
  }
}

// ── the sign-in link ─────────────────────────────────────────────────────────
export function buildPartnerLoginEmail(link: string, invite: boolean): string {
  return `<!DOCTYPE html><html lang="bg">${emailHead("Вход - Lorenzo Ricci партньор")}
<body style="margin:0;padding:16px;font-family:Arial,sans-serif;background:${EMAIL_IVORY};color:${EMAIL_NAVY}">
 <div style="max-width:520px;margin:0 auto;background:#ffffff;overflow:hidden">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${emailHeaderRow(520)}</table>
  <div style="padding:8px 24px 28px;font-size:15px;line-height:1.6">
   <p style="margin:0 0 14px">${invite ? "Поканени сте в партньорския панел на Lorenzo Ricci: поръчките на дамската колекция бижута и наличностите им." : "Ето линка за вход в партньорския панел."}</p>
   <p style="margin:22px 0;text-align:center"><a href="${esc(link)}" style="display:inline-block;background:${EMAIL_NAVY};color:#ffffff;text-decoration:none;padding:14px 26px;font-weight:700;letter-spacing:.06em">ВЛЕЗ В ПАНЕЛА</a></p>
   <p style="margin:0;color:#6b6456;font-size:13px">Линкът важи ${invite ? "7 дни" : "15 минути"} и само веднъж. След вход оставате вписан 30 дни на това устройство. Нов линк по всяко време: ${esc(SITE_ORIGIN)}/partner/login (въведете този имейл).</p>
  </div>
 </div>
</body></html>`;
}

export async function sendPartnerLoginEmail(to: string, token: string, invite = false): Promise<void> {
  const link = `${SITE_ORIGIN}/partner/auth?t=${encodeURIComponent(token)}`;
  await sendWithRetry({ to: [to], subject: invite ? "Покана: партньорски панел Lorenzo Ricci" : "Вход в партньорския панел - Lorenzo Ricci", html: buildPartnerLoginEmail(link, invite) });
}
