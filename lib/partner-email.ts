// mail-policy: internal
import { Resend } from "resend";
import { EMAIL_IVORY, EMAIL_NAVY, emailHead, emailHeaderRow } from "./email-layout";
import { NEW_COLLECTION_SLUGS } from "./new-collection";
import { onePlusOneOfOrder } from "./one-plus-one";
import { isRoOfficeMethod } from "./ro/config";

// Partner order e-mail (BG + RO) to the partner. Its OWN template, separate from the team e-mail
// (lib/order-notify.ts buildAdminEmail / lib/ro/emails.ts buildRoAdminEmail), which stays as it is.
// Owner, 08.11.2026:
//   - sent ONLY for orders holding at least one piece of the women's collection (Verdis, Noctis, Lumen, Linea, Solaris, Spira);
//   - lists ONLY those pieces, with their total after the collection's 1+1 (no watches, cardholders, other products, delivery);
//   - carries the customer's phone but NO e-mail address of the customer.
// Not a customer e-mail: Bulgarian text.

export const PARTNER_RECIPIENTS = ["dejvidvisev99@gmail.com"];

export type PartnerLine = { slug?: string; name?: string; sku?: string; quantity?: number; price?: number; gift?: boolean };

export type PartnerOrder = {
  orderRef: string;
  date: Date | string;                       // when the order was placed
  name: string;
  phone: string;
  market: "bg" | "ro";
  delivery: { method: string; office: boolean; address: string; city?: string; postCode?: string };
  items: PartnerLine[];                      // ALL lines of the order (filtered here)
  orderDiscount: number;                     // the order's discounts on goods (lines - goods after discounts - promo): checks the 1+1
  payment: "cod" | "card";
  status: string;
};

const qty = (l: PartnerLine) => Math.max(1, Math.floor(Number(l.quantity ?? 1)) || 1);
const round2 = (n: number) => Math.round(n * 100) / 100;

/** The women's-collection part of the order, or null when it holds none (then no partner e-mail). */
export function womenPart(o: PartnerOrder): { items: PartnerLine[]; gross: number; opo: number; total: number } | null {
  const items = o.items.filter((i) => !i.gift && typeof i.slug === "string" && NEW_COLLECTION_SLUGS.has(i.slug));
  if (!items.length) return null;
  const gross = round2(items.reduce((s, i) => s + Number(i.price ?? 0) * qty(i), 0));
  const opo = onePlusOneOfOrder(items.map((i) => ({ ...i, quantity: qty(i) })), o.orderDiscount);
  return { items, gross, opo, total: round2(gross - opo) };
}

const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const money = (n: number, market: PartnerOrder["market"]) => market === "ro" ? `${Math.round(n)} lei` : `€${n.toFixed(2)}`;
const fmtDate = (d: Date | string) => new Date(d).toLocaleString("bg-BG", { timeZone: "Europe/Sofia", dateStyle: "short", timeStyle: "short" });

export function partnerSubject(o: PartnerOrder): string {
  return `${o.market === "ro" ? "🇷🇴 " : ""}Поръчка ${o.orderRef} - ${o.name}`;
}

export function buildPartnerEmail(o: PartnerOrder): string | null {
  const part = womenPart(o);
  if (!part) return null;
  const courier = o.market === "ro" ? "Speedy" : "Еконт";
  const where = [o.delivery.address, o.delivery.city, o.delivery.postCode].map((s) => String(s ?? "").trim()).filter(Boolean)
    .filter((s, i, a) => a.findIndex((x) => x.toLowerCase() === s.toLowerCase()) === i).join(", ");
  const row = (k: string, v: string, shade: boolean) =>
    `<tr${shade ? ' style="background:#faf7f1"' : ""}><td style="padding:9px 12px;font-weight:600;width:160px;vertical-align:top">${k}</td><td style="padding:9px 12px">${v}</td></tr>`;
  const lines = part.items.map((i) => `<tr>
      <td style="padding:9px 12px;border-bottom:1px solid #e5e7eb">${esc(i.name ?? "-")}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #e5e7eb;font-family:monospace;font-size:12px;color:#555">${esc(i.sku ?? "-")}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #e5e7eb;text-align:center">${qty(i)}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #e5e7eb;text-align:right">${esc(money(Number(i.price ?? 0), o.market))}</td>
    </tr>`).join("");
  const payment = o.payment === "card" ? "Карта (платена онлайн)" : "Наложен платеж";

  return `<!DOCTYPE html><html lang="bg">${emailHead(esc(partnerSubject(o)))}
<body style="margin:0;padding:24px;font-family:Arial,sans-serif;background:${EMAIL_IVORY};color:${EMAIL_NAVY}">
 <div style="max-width:640px;margin:0 auto;background:#ffffff;overflow:hidden">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${emailHeaderRow(640)}</table>
  <div style="padding:0 28px 14px;text-align:center;font-size:13px;color:#6b6456;border-bottom:1px solid #e8dfc8;margin:0 28px">${o.market === "ro" ? "🇷🇴 Румъния" : "🇧🇬 България"} · Поръчка ${esc(o.orderRef)}</div>
  <div style="padding:28px">
   <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:24px">
    ${row("Номер", `<strong>${esc(o.orderRef)}</strong>`, true)}
    ${row("Дата", esc(fmtDate(o.date)), false)}
    ${row("Клиент", esc(o.name || "-"), true)}
    ${row("Телефон", o.phone ? `<a href="tel:${esc(o.phone)}" style="color:#0a0e1f;font-weight:600">${esc(o.phone)}</a>` : "-", false)}
    ${row("Доставка", `${esc(courier)} - ${o.delivery.office ? "до офис / автомат" : "до адрес"}`, true)}
    ${row(o.delivery.office ? `Офис ${esc(courier)}` : "Адрес", esc(where || "-"), false)}
    ${row("Плащане", esc(payment), true)}
    ${row("Статус", `<strong>${esc(o.status)}</strong>`, false)}
   </table>
   <p style="margin:0 0 10px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#6b7280">Дамска колекция</p>
   <table style="width:100%;border-collapse:collapse;font-size:14px">
    <thead><tr style="background:${EMAIL_IVORY};color:${EMAIL_NAVY};border-bottom:1px solid #e8dfc8"><th style="padding:9px 12px;text-align:left">Продукт</th><th style="padding:9px 12px;text-align:left">SKU</th><th style="padding:9px 12px">Бр.</th><th style="padding:9px 12px;text-align:right">Цена</th></tr></thead>
    <tbody>${lines}</tbody>
    <tfoot>${part.opo > 0 ? `<tr><td colspan="3" style="padding:9px 12px;color:#047857">1+1 (второто бижу безплатно)</td><td style="padding:9px 12px;text-align:right;color:#047857">-${esc(money(part.opo, o.market))}</td></tr>` : ""}
     <tr style="background:#faf7f1;font-weight:700"><td colspan="3" style="padding:10px 12px">ОБЩО (след 1+1)</td><td style="padding:10px 12px;text-align:right">${esc(money(part.total, o.market))}</td></tr></tfoot>
   </table>
  </div>
 </div>
</body></html>`;
}

/**
 * Sends the partner e-mail when the order holds a women's-collection piece; returns false (nothing sent) otherwise.
 * `scheduledAt` (ISO): Resend holds the e-mail and sends it then (the backfill queue). Throws on a Resend error.
 */
export async function sendPartnerEmail(o: PartnerOrder, opts: { scheduledAt?: string } = {}): Promise<boolean> {
  const html = buildPartnerEmail(o);
  if (!html) return false;
  const key = process.env.RESEND_API_KEY;
  if (!key) { console.warn("[partner] RESEND_API_KEY not set - skipping e-mail"); return false; }
  const { error } = await new Resend(key).emails.send({
    from: "Lorenzo Ricci Orders <orders@lorenzo-ricci.com>",
    to: PARTNER_RECIPIENTS,
    subject: partnerSubject(o),
    html,
    ...(opts.scheduledAt ? { scheduledAt: opts.scheduledAt } : {}),
  });
  if (error) throw new Error(`Resend: ${error.message}`);
  return true;
}

// The order's status in words (the panel's statuses).
const STATUS_BG: Record<string, string> = { new: "Нова - чака потвърждение", confirmed: "Потвърдена", shipped: "Изпратена", completed: "Доставена" };

/** The partner e-mail's data from a saved `orders` row (used by the card path and the backfill). */
export function partnerFromRow(order: Record<string, unknown>): PartnerOrder {
  const ro = order.ship_country === "RO" || String(order.order_ref ?? "").startsWith("LRRO-");
  const items = (Array.isArray(order.items) ? order.items : []) as Record<string, unknown>[];
  const lines: PartnerLine[] = items.map((i) => ({
    slug: typeof i.slug === "string" ? i.slug : undefined, name: i.name as string, sku: i.sku as string,
    quantity: Number(i.quantity ?? i.qty ?? 1), price: Number(i.price ?? 0), gift: i.gift === true,
  }));
  const gross = lines.filter((l) => !l.gift).reduce((s, l) => s + Number(l.price ?? 0) * qty(l), 0);
  const card = order.payment_method === "card";
  const stage = STATUS_BG[String(order.status ?? "")] ?? String(order.status ?? "-");
  return {
    orderRef: String(order.order_ref ?? ""),
    date: String(order.created_at ?? order.paid_at ?? new Date().toISOString()),
    market: ro ? "ro" : "bg",
    name: String(order.name ?? ""),
    phone: String(order.phone ?? ""),
    delivery: {
      method: String(order.shipping_method ?? ""),
      office: ro ? isRoOfficeMethod(order.shipping_method) : String(order.courier ?? "") !== "home",
      address: String(order.address ?? ""), city: String(order.city ?? ""), postCode: String(order.post_code ?? ""),
    },
    items: lines,
    orderDiscount: Math.max(0, gross - Number(order.subtotal ?? gross) - Number(order.promo_discount ?? 0)),
    payment: card ? "card" : "cod",
    status: card && order.payment_status === "paid" ? (order.status === "confirmed" ? "Платена (потвърдена)" : `Платена · ${stage}`) : stage,
  };
}
