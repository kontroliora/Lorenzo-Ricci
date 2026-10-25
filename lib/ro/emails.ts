// Romania market: e-mails. Customer mails are in Romanian, the team mail stays in Bulgarian (the team reads it).
// Pure builders: no sending here (app/api/order-ro/route.ts and the panel action send them).
import { fmtRON, RO_DELIVERY_DAYS, RO_COURIER_LABEL, RO_RETURN_DAYS } from "./config";
import { emailHead, emailHeaderRow } from "@/lib/email-layout";

export type RoOrderLine = { name?: string; sku?: string; quantity?: number; price?: number };
export type RoOrderEmailData = {
  orderRef: string;
  customer: { name?: string; phone?: string; email?: string; county?: string; city?: string; address?: string; postCode?: string; notes?: string };
  items: RoOrderLine[];
  subtotal: number;        // goods after set discounts
  discount?: number;       // set discount in lei (0 / undefined: none)
  cardDiscount?: number;   // not used in Romania any more (no card discount since 25.10.2026); kept for the data shape
  shippingCost: number;
  total: number;
  officeDelivery?: boolean; // delivery to a Speedy locker / office: customer.address is then its address
};

const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const NAVY = "#0a0e1f";

export const roPaidSubject = "Plata a fost primită - Lorenzo Ricci";
export const roShippedSubject = (ref: string) => `Comanda ${ref} a fost expediată`;

// Dark-mode safe shell (lib/email-layout.ts): the header is the opaque PNG with the white wordmark baked in.
function shell(title: string, bodyHtml: string, ref: string): string {
  return `<!DOCTYPE html>
<html lang="ro">${emailHead(esc(title))}
<body style="margin:0;padding:0;background:#f5f0e8;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f0e8;padding:40px 16px"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;max-width:560px;width:100%">
  ${emailHeaderRow(560)}
  <tr><td style="padding:40px 40px 0">${bodyHtml}</td></tr>
  <tr><td style="padding:32px 40px 40px;text-align:center"><div style="border-top:1px solid #e8dfc8;padding-top:28px">
    <p style="margin:0 0 6px;font-family:Georgia,serif;font-size:13px;color:${NAVY};letter-spacing:.08em">LORENZO RICCI</p>
    <p style="margin:0;font-size:11px;color:#aaa;line-height:1.8">info@lorenzo-ricci.com<br><a href="https://lorenzo-ricci.com/ro" style="color:#aaa;text-decoration:none">lorenzo-ricci.com/ro</a></p>
    <p style="margin:12px 0 0;font-size:10px;color:#c8c2ba;line-height:1.7">Primiți acest mesaj în legătură cu comanda ${esc(ref)} plasată pe lorenzo-ricci.com.</p>
  </div></td></tr>
</table></td></tr></table></body></html>`;
}

const itemRows = (items: RoOrderLine[]) =>
  items.map((i) => `<tr>
    <td style="padding:12px 0;border-bottom:1px solid #e8dfc8;font-family:Georgia,serif;color:#1a1a1a;font-size:14px">${esc(i.name ?? "-")}</td>
    <td style="padding:12px 0;border-bottom:1px solid #e8dfc8;text-align:center;color:#555;font-size:14px">×${i.quantity ?? 1}</td>
    <td style="padding:12px 0;border-bottom:1px solid #e8dfc8;text-align:right;font-family:Georgia,serif;color:#1a1a1a;font-size:14px">${esc(fmtRON(Number(i.price ?? 0)))}</td>
  </tr>`).join("");

const addressLine = (c: RoOrderEmailData["customer"]) =>
  [c.address, c.city, c.county ? `jud. ${c.county}` : "", c.postCode].filter(Boolean).join(", ");

// ── Customer: card payment received (sent once, when Stripe confirms the payment: lib/payment-notify.ts) ─────────────
// Romania is card only (no ramburs): this e-mail always says the order is paid and nothing is due on delivery.
export function buildRoCustomerEmail(o: RoOrderEmailData): string {
  const first = esc(String(o.customer.name ?? "").trim().split(" ")[0] || "client");
  return shell("Comanda dumneavoastră de la Lorenzo Ricci", `
    <p style="margin:0 0 6px;font-family:Georgia,serif;font-size:22px;color:${NAVY}">Vă mulțumim, ${first}!</p>
    <p style="margin:0 0 28px;color:#666;font-size:14px;line-height:1.6">Am primit plata dumneavoastră cu cardul pentru comanda <strong style="color:#1a1a1a">${esc(o.orderRef)}</strong>, vă mulțumim! O pregătim pentru expediere, iar livrarea se face prin ${esc(RO_COURIER_LABEL)} în ${esc(RO_DELIVERY_DAYS)} zile lucrătoare de la expediere. Nu aveți nimic de plătit la livrare.</p>
    <div style="border-top:1px solid #e8dfc8;margin-bottom:28px"></div>
    <p style="margin:0 0 16px;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#888">Comanda dumneavoastră</p>
    <table width="100%" cellpadding="0" cellspacing="0"><tbody>${itemRows(o.items)}</tbody>
      <tfoot>
        ${o.discount ? `<tr><td colspan="2" style="padding:12px 0 0;font-size:12px;color:#888">Reducere set</td><td style="padding:12px 0 0;text-align:right;font-size:14px;color:#047857">-${esc(fmtRON(o.discount))}</td></tr>` : ""}
        <tr><td colspan="2" style="padding:12px 0 0;font-size:12px;color:#888">Livrare</td><td style="padding:12px 0 0;text-align:right;font-size:14px;color:#1a1a1a">${o.shippingCost === 0 ? "Gratuită" : esc(fmtRON(o.shippingCost))}</td></tr>
        <tr><td colspan="2" style="padding:14px 0 0;font-size:12px;letter-spacing:.15em;text-transform:uppercase;color:#888">Plătit cu cardul</td><td style="padding:14px 0 0;text-align:right;font-family:Georgia,serif;font-size:20px;color:${NAVY};font-weight:700">${esc(fmtRON(o.total))}</td></tr>
      </tfoot>
    </table>
    <div style="border-top:1px solid #e8dfc8;margin:28px 0"></div>
    <p style="margin:0 0 16px;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#888">Livrare</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:#444">
      <tr><td style="padding:4px 0;width:130px;color:#888">Metodă</td><td style="padding:4px 0">${o.officeDelivery ? "Livrare la locker / birou Speedy" : "Livrare la domiciliu"}</td></tr>
      <tr><td style="padding:4px 0;color:#888">${o.officeDelivery ? "Locker / birou Speedy" : "Adresă"}</td><td style="padding:4px 0">${esc(addressLine(o.customer))}</td></tr>
      <tr><td style="padding:4px 0;color:#888">Telefon</td><td style="padding:4px 0">${esc(o.customer.phone)}</td></tr>
    </table>
    <div style="border-top:1px solid #e8dfc8;margin:28px 0"></div>
    <p style="margin:0 0 28px;color:#666;font-size:13px;line-height:1.7">Aveți dreptul de retragere în ${RO_RETURN_DAYS} zile de la primirea coletului. Detalii: <a href="https://lorenzo-ricci.com/ro/politici/retur" style="color:${NAVY}">Politica de retur</a>. Pentru ceasuri oferim 5 ani garanție comercială. Întrebări: info@lorenzo-ricci.com.</p>`, o.orderRef);
}

// How the order is paid, from the ORDER's own payment data (lib/ro/panel-mail.ts roPaymentOf, never assumed):
//   "card"    - paid by card (lib/payments.ts hasCardMoney): nothing to pay on delivery. Every order since Romania went card only (25.10.2026);
//   "ramburs" - an old order placed with cash on delivery before that date: the courier collects the total;
//   "unknown" - a card order whose payment is not recorded as paid: no payment line at all (never "pay the courier").
export type RoPayment = "card" | "ramburs" | "unknown";
const paymentRow = (total: number, payment: RoPayment, labelWidth: number) =>
  payment === "card" ? `<tr><td style="padding:4px 0;width:${labelWidth}px;color:#888">Plată</td><td style="padding:4px 0;color:#1a1a1a">${esc(fmtRON(total))}, plătit cu cardul - nu aveți nimic de plătit la livrare</td></tr>`
  : payment === "ramburs" ? `<tr><td style="padding:4px 0;width:${labelWidth}px;color:#888">Suma de plătit la livrare</td><td style="padding:4px 0;color:#1a1a1a">${esc(fmtRON(total))} (ramburs)</td></tr>`
  : "";

// ── Customer: parcel shipped (sent from the panel when staff enter the AWB) ───────
export function buildRoShippedEmail(d: { orderRef: string; firstName: string; items: RoOrderLine[]; total: number; payment: RoPayment; awb: string; courierLabel?: string; trackUrl?: string }): string {
  const courier = d.courierLabel || RO_COURIER_LABEL;
  const track = d.trackUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 4px"><tr><td align="center" style="background:${NAVY}"><a href="${esc(d.trackUrl)}" style="display:inline-block;color:#fff;font-size:11px;letter-spacing:.22em;text-transform:uppercase;text-decoration:none;padding:14px 40px">Urmăriți coletul</a></td></tr></table>`
    : "";
  return shell("Comanda a fost expediată", `
    <p style="margin:0 0 6px;font-family:Georgia,serif;font-size:22px;color:${NAVY}">Bună ziua, ${esc(d.firstName || "client")},</p>
    <p style="margin:0 0 24px;color:#666;font-size:14px;line-height:1.7">Comanda dumneavoastră <strong style="color:#1a1a1a">${esc(d.orderRef)}</strong> a fost predată curierului (${esc(courier)}) și este în drum spre dumneavoastră. Livrarea durează de regulă ${esc(RO_DELIVERY_DAYS)} zile lucrătoare.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:#444">
      <tr><td style="padding:4px 0;width:150px;color:#888">Număr AWB</td><td style="padding:4px 0;color:#1a1a1a;font-family:Georgia,serif">${esc(d.awb)}</td></tr>
      ${paymentRow(d.total, d.payment, 150)}
    </table>
    ${track}
    <div style="border-top:1px solid #e8dfc8;margin:26px 0"></div>
    <table width="100%" cellpadding="0" cellspacing="0"><tbody>${itemRows(d.items)}</tbody></table>
    <p style="margin:24px 0 28px;color:#666;font-size:13px;line-height:1.7">${d.payment === "ramburs" ? "Vă rugăm să aveți suma pregătită la livrare. " : ""}Întrebări: info@lorenzo-ricci.com.</p>`, d.orderRef);
}

// ── Customer: status e-mails sent from the panel (Romanian only; see lib/ro/panel-mail.ts) ──────────────────────────────────
export const roConfirmedSubject = (ref: string) => `Comanda ${ref} a fost confirmată`;
export const roCancelledSubject = (ref: string) => `Comanda ${ref} a fost anulată`;
export const roDeliveredSubject = (ref: string) => `Comanda ${ref} a fost livrată`;
export const roReturnedSubject = (ref: string) => `Comanda ${ref} - coletul s-a întors la noi`;

const greet = (firstName: string) => `<p style="margin:0 0 6px;font-family:Georgia,serif;font-size:22px;color:${NAVY}">Bună ziua, ${esc(firstName || "client")},</p>`;
const para = (html: string, bottom = 24) => `<p style="margin:0 0 ${bottom}px;color:#666;font-size:14px;line-height:1.7">${html}</p>`;
const strongRef = (ref: string) => `<strong style="color:#1a1a1a">${esc(ref)}</strong>`;
const contactLine = `Întrebări: <a href="mailto:info@lorenzo-ricci.com" style="color:${NAVY}">info@lorenzo-ricci.com</a>.`;

type StatusMailBase = { orderRef: string; firstName: string };

// Staff pressed "Потвърждава": the order is confirmed and goes to packing.
export function buildRoConfirmedEmail(d: StatusMailBase & { items: RoOrderLine[]; total: number; payment: RoPayment }): string {
  return shell("Comanda a fost confirmată", `
    ${greet(d.firstName)}
    ${para(`Comanda dumneavoastră ${strongRef(d.orderRef)} a fost confirmată și o pregătim pentru expediere. Veți primi un nou e-mail cu numărul AWB imediat ce coletul pleacă. Livrarea durează de regulă ${esc(RO_DELIVERY_DAYS)} zile lucrătoare de la expediere.`)}
    <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:#444">
      ${paymentRow(d.total, d.payment, 190)}
    </table>
    <div style="border-top:1px solid #e8dfc8;margin:26px 0"></div>
    <table width="100%" cellpadding="0" cellspacing="0"><tbody>${itemRows(d.items)}</tbody></table>
    <p style="margin:24px 0 28px;color:#666;font-size:13px;line-height:1.7">${contactLine}</p>`, d.orderRef);
}

export type RoCancelCategory = "refused" | "unreachable" | "wrong_number" | "other";
// Staff cancelled the order. The Bulgarian free-text reason is never shown: the text depends on the category only.
// refundLabel (e.g. "735 lei"): the card payment is being refunded (card orders, Stripe branch); without it nothing was paid.
export function buildRoCancelledEmail(d: StatusMailBase & { category?: RoCancelCategory | string; refundLabel?: string }): string {
  const why =
    d.category === "refused" ? `Conform solicitării dumneavoastră, comanda ${strongRef(d.orderRef)} a fost anulată.`
    : d.category === "unreachable" || d.category === "wrong_number" ? `Nu am reușit să vă contactăm pentru confirmarea comenzii ${strongRef(d.orderRef)}, de aceea a fost anulată.`
    : `Din păcate a trebuit să anulăm comanda ${strongRef(d.orderRef)}.`;
  const money = d.refundLabel
    ? `Suma plătită cu cardul (${esc(d.refundLabel)}) vă este rambursată automat, în același cont. Banii apar de regulă în 5-10 zile lucrătoare, în funcție de banca dumneavoastră.`
    : "Nu se datorează nicio sumă.";
  return shell("Comanda a fost anulată", `
    ${greet(d.firstName)}
    ${para(`${why} ${money}`)}
    ${para(`Dacă doriți totuși produsele, puteți plasa oricând o nouă comandă pe <a href="https://lorenzo-ricci.com/ro" style="color:${NAVY}">lorenzo-ricci.com/ro</a>. ${contactLine}`, 28)}`, d.orderRef);
}

// Staff marked the parcel delivered ("Доставена").
export function buildRoDeliveredEmail(d: StatusMailBase): string {
  return shell("Comanda a fost livrată", `
    ${greet(d.firstName)}
    ${para(`Comanda dumneavoastră ${strongRef(d.orderRef)} a fost livrată. Vă mulțumim că ați ales Lorenzo Ricci!`)}
    ${para(`Pentru ceasuri oferim 5 ani garanție comercială. Aveți dreptul de retragere în ${RO_RETURN_DAYS} zile de la primirea coletului: <a href="https://lorenzo-ricci.com/ro/politici/retur" style="color:${NAVY}">Politica de retur</a>. Dacă ceva nu este în regulă cu comanda, scrieți-ne și rezolvăm.`, 24)}
    ${para(contactLine, 28)}`, d.orderRef);
}

// Staff marked the parcel returned / not collected ("Върната").
// payment "card" (paid by card): the amount is refunded to the same card - staff do it in Stripe (the panel reminds them when they
// mark the parcel returned). Cash on delivery / unpaid: nothing was paid, nothing is owed.
export function buildRoReturnedEmail(d: StatusMailBase & { payment?: RoPayment; total?: number }): string {
  return shell("Coletul s-a întors la noi", `
    ${greet(d.firstName)}
    ${para(`Coletul comenzii ${strongRef(d.orderRef)} nu a putut fi livrat și se întoarce la noi, de aceea comanda a fost închisă. ${d.payment === "card"
      ? `Suma plătită cu cardul${d.total ? ` (${esc(fmtRON(d.total))})` : ""} vă va fi rambursată integral, în același card. Banii apar de regulă în 5-10 zile lucrătoare de la rambursare, în funcție de banca dumneavoastră.`
      : "Nu se datorează nicio sumă."}`)}
    ${para(`Dacă a intervenit o problemă sau doriți să primiți totuși produsele, scrieți-ne sau plasați o nouă comandă pe <a href="https://lorenzo-ricci.com/ro" style="color:${NAVY}">lorenzo-ricci.com/ro</a>. ${contactLine}`, 28)}`, d.orderRef);
}

// ── Team: new Romanian order (Bulgarian, like the existing order e-mail) ─────────
export function buildRoAdminEmail(o: RoOrderEmailData, alert?: string, opts: { paidByCard?: boolean } = {}): string {
  const rows = o.items.map((i) => `<tr><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${esc(i.name)}</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-family:monospace;font-size:12px">${esc(i.sku)}</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center">${i.quantity ?? 1}</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right">${esc(fmtRON(Number(i.price ?? 0)))}</td></tr>`).join("");
  const c = o.customer;
  return `<!DOCTYPE html><html lang="bg"><head><meta charset="UTF-8"></head><body style="margin:0;padding:24px;font-family:Arial,sans-serif;background:#f9fafb;color:#111">
  <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden">
   <div style="background:${NAVY};padding:20px 28px;color:#fff"><strong style="letter-spacing:.2em">LORENZO RICCI</strong> <span style="opacity:.6;margin-left:10px">🇷🇴 Нова поръчка от Румъния · ${esc(o.orderRef)}</span></div>
   <div style="padding:28px">
    ${alert ? `<div style="background:#b91c1c;color:#fff;padding:14px 18px;border-radius:6px;margin-bottom:16px">⚠️ ${esc(alert)}</div>` : ""}${opts.paidByCard ? `<div style="background:#047857;color:#fff;padding:14px 18px;border-radius:6px;margin-bottom:16px">💳 ПЛАТЕНА С КАРТА - куриерът събира 0 лей (НЕ слагай наложен платеж).</div>` : ""}
    <p style="margin:0 0 14px;font-size:13px;color:#555">Сумите са в <strong>леи (RON)</strong>. ${o.officeDelivery ? "Доставка до АВТОМАТ / ОФИС на Speedy (Румъния) - адресът по-долу е на автомата/офиса." : "Доставка до адрес със Speedy (Румъния, НЕ Еконт)."} Поръчката е в „Поръчки" на панела (значка 🇷🇴 RO, филтър „Румъния").</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:22px">
     <tr style="background:#f3f4f6"><td style="padding:8px 12px;font-weight:600;width:150px">Имена</td><td style="padding:8px 12px">${esc(c.name)}</td></tr>
     <tr><td style="padding:8px 12px;font-weight:600">Телефон</td><td style="padding:8px 12px"><a href="tel:${esc(c.phone)}">${esc(c.phone)}</a></td></tr>
     <tr style="background:#f3f4f6"><td style="padding:8px 12px;font-weight:600">Имейл</td><td style="padding:8px 12px">${esc(c.email)}</td></tr>
     <tr><td style="padding:8px 12px;font-weight:600">${o.officeDelivery ? "Автомат / офис Speedy" : "Адрес"}</td><td style="padding:8px 12px">${esc(addressLine(c))}</td></tr>
     <tr style="background:#f3f4f6"><td style="padding:8px 12px;font-weight:600">Бележка</td><td style="padding:8px 12px">${esc(c.notes || "-")}</td></tr>
    </table>
    <table style="width:100%;border-collapse:collapse;font-size:14px"><thead><tr style="background:${NAVY};color:#fff"><th style="padding:8px 12px;text-align:left">Продукт</th><th style="padding:8px 12px;text-align:left">SKU</th><th style="padding:8px 12px">Бр.</th><th style="padding:8px 12px;text-align:right">Цена</th></tr></thead><tbody>${rows}</tbody>
     <tfoot>${o.discount ? `<tr><td colspan="3" style="padding:8px 12px;color:#047857">Отстъпка за комплект</td><td style="padding:8px 12px;text-align:right;color:#047857">-${esc(fmtRON(o.discount))}</td></tr>` : ""}${o.cardDiscount ? `<tr><td colspan="3" style="padding:8px 12px;color:#047857">Отстъпка за плащане с карта (-5%)</td><td style="padding:8px 12px;text-align:right;color:#047857">-${esc(fmtRON(o.cardDiscount))}</td></tr>` : ""}<tr><td colspan="3" style="padding:8px 12px;color:#555">Доставка</td><td style="padding:8px 12px;text-align:right">${o.shippingCost === 0 ? "безплатна" : esc(fmtRON(o.shippingCost))}</td></tr>
     <tr style="background:#f3f4f6;font-weight:700"><td colspan="3" style="padding:10px 12px">${opts.paidByCard ? "ОБЩО (платено с карта)" : "ОБЩО (наложен платеж)"}</td><td style="padding:10px 12px;text-align:right">${esc(fmtRON(o.total))}</td></tr></tfoot></table>
   </div></div></body></html>`;
}
