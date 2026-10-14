// Romania market: e-mails. Customer mails are in Romanian, the team mail stays in Bulgarian (the team reads it).
// Pure builders: no sending here (app/api/order-ro/route.ts and the panel action send them).
import { fmtRON, RO_DELIVERY_DAYS, RO_COURIER_LABEL, RO_RETURN_DAYS } from "./config";

export type RoOrderLine = { name?: string; sku?: string; quantity?: number; price?: number };
export type RoOrderEmailData = {
  orderRef: string;
  customer: { name?: string; phone?: string; email?: string; county?: string; city?: string; address?: string; postCode?: string; notes?: string };
  items: RoOrderLine[];
  subtotal: number;
  shippingCost: number;
  total: number;
};

const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const NAVY = "#0a0e1f";

export const roCustomerSubject = "Comanda dumneavoastră a fost primită - Lorenzo Ricci";
export const roShippedSubject = (ref: string) => `Comanda ${ref} a fost expediată`;

function shell(title: string, bodyHtml: string, ref: string): string {
  return `<!DOCTYPE html>
<html lang="ro"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#f5f0e8;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f0e8;padding:40px 16px"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;max-width:560px;width:100%">
  <tr><td style="background:${NAVY};padding:36px 40px;text-align:center"><img src="https://lorenzo-ricci.com/email-logo.png" alt="Lorenzo Ricci" width="200" style="max-width:200px;height:auto;display:block;margin:0 auto"></td></tr>
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

// ── Customer: order received (cash on delivery) ───────────────────────────────────
export function buildRoCustomerEmail(o: RoOrderEmailData): string {
  const first = esc(String(o.customer.name ?? "").trim().split(" ")[0] || "client");
  return shell("Comanda dumneavoastră de la Lorenzo Ricci", `
    <p style="margin:0 0 6px;font-family:Georgia,serif;font-size:22px;color:${NAVY}">Vă mulțumim, ${first}!</p>
    <p style="margin:0 0 28px;color:#666;font-size:14px;line-height:1.6">Am primit comanda dumneavoastră <strong style="color:#1a1a1a">${esc(o.orderRef)}</strong>. O vom pregăti pentru expediere, iar livrarea se face prin ${esc(RO_COURIER_LABEL)} în ${esc(RO_DELIVERY_DAYS)} zile lucrătoare de la expediere. Plata se face la livrare (ramburs).</p>
    <div style="border-top:1px solid #e8dfc8;margin-bottom:28px"></div>
    <p style="margin:0 0 16px;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#888">Comanda dumneavoastră</p>
    <table width="100%" cellpadding="0" cellspacing="0"><tbody>${itemRows(o.items)}</tbody>
      <tfoot>
        <tr><td colspan="2" style="padding:12px 0 0;font-size:12px;color:#888">Livrare</td><td style="padding:12px 0 0;text-align:right;font-size:14px;color:#1a1a1a">${o.shippingCost === 0 ? "Gratuită" : esc(fmtRON(o.shippingCost))}</td></tr>
        <tr><td colspan="2" style="padding:14px 0 0;font-size:12px;letter-spacing:.15em;text-transform:uppercase;color:#888">Suma de plătit la livrare</td><td style="padding:14px 0 0;text-align:right;font-family:Georgia,serif;font-size:20px;color:${NAVY};font-weight:700">${esc(fmtRON(o.total))}</td></tr>
      </tfoot>
    </table>
    <div style="border-top:1px solid #e8dfc8;margin:28px 0"></div>
    <p style="margin:0 0 16px;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#888">Livrare</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:#444">
      <tr><td style="padding:4px 0;width:130px;color:#888">Metodă</td><td style="padding:4px 0">Livrare la domiciliu</td></tr>
      <tr><td style="padding:4px 0;color:#888">Adresă</td><td style="padding:4px 0">${esc(addressLine(o.customer))}</td></tr>
      <tr><td style="padding:4px 0;color:#888">Telefon</td><td style="padding:4px 0">${esc(o.customer.phone)}</td></tr>
    </table>
    <div style="border-top:1px solid #e8dfc8;margin:28px 0"></div>
    <p style="margin:0 0 28px;color:#666;font-size:13px;line-height:1.7">Aveți dreptul de retragere în ${RO_RETURN_DAYS} zile de la primirea coletului. Detalii: <a href="https://lorenzo-ricci.com/ro/politici/retur" style="color:${NAVY}">Politica de retur</a>. Pentru ceasuri oferim 5 ani garanție comercială. Întrebări: info@lorenzo-ricci.com.</p>`, o.orderRef);
}

// ── Customer: parcel shipped (sent from the panel when staff enter the AWB) ───────
export function buildRoShippedEmail(d: { orderRef: string; firstName: string; items: RoOrderLine[]; total: number; awb: string; courierLabel?: string; trackUrl?: string }): string {
  const courier = d.courierLabel || RO_COURIER_LABEL;
  const track = d.trackUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 4px"><tr><td align="center" style="background:${NAVY}"><a href="${esc(d.trackUrl)}" style="display:inline-block;color:#fff;font-size:11px;letter-spacing:.22em;text-transform:uppercase;text-decoration:none;padding:14px 40px">Urmăriți coletul</a></td></tr></table>`
    : "";
  return shell("Comanda a fost expediată", `
    <p style="margin:0 0 6px;font-family:Georgia,serif;font-size:22px;color:${NAVY}">Bună ziua, ${esc(d.firstName || "client")},</p>
    <p style="margin:0 0 24px;color:#666;font-size:14px;line-height:1.7">Comanda dumneavoastră <strong style="color:#1a1a1a">${esc(d.orderRef)}</strong> a fost predată curierului (${esc(courier)}) și este în drum spre dumneavoastră. Livrarea durează de regulă ${esc(RO_DELIVERY_DAYS)} zile lucrătoare.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:#444">
      <tr><td style="padding:4px 0;width:150px;color:#888">Număr AWB</td><td style="padding:4px 0;color:#1a1a1a;font-family:Georgia,serif">${esc(d.awb)}</td></tr>
      <tr><td style="padding:4px 0;color:#888">Suma de plătit la livrare</td><td style="padding:4px 0;color:#1a1a1a">${esc(fmtRON(d.total))} (ramburs)</td></tr>
    </table>
    ${track}
    <div style="border-top:1px solid #e8dfc8;margin:26px 0"></div>
    <table width="100%" cellpadding="0" cellspacing="0"><tbody>${itemRows(d.items)}</tbody></table>
    <p style="margin:24px 0 28px;color:#666;font-size:13px;line-height:1.7">Vă rugăm să aveți suma pregătită la livrare. Întrebări: info@lorenzo-ricci.com.</p>`, d.orderRef);
}

// ── Team: new Romanian order (Bulgarian, like the existing order e-mail) ─────────
export function buildRoAdminEmail(o: RoOrderEmailData, alert?: string): string {
  const rows = o.items.map((i) => `<tr><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${esc(i.name)}</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-family:monospace;font-size:12px">${esc(i.sku)}</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center">${i.quantity ?? 1}</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right">${esc(fmtRON(Number(i.price ?? 0)))}</td></tr>`).join("");
  const c = o.customer;
  return `<!DOCTYPE html><html lang="bg"><head><meta charset="UTF-8"></head><body style="margin:0;padding:24px;font-family:Arial,sans-serif;background:#f9fafb;color:#111">
  <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden">
   <div style="background:${NAVY};padding:20px 28px;color:#fff"><strong style="letter-spacing:.2em">LORENZO RICCI</strong> <span style="opacity:.6;margin-left:10px">🇷🇴 Нова поръчка от Румъния · ${esc(o.orderRef)}</span></div>
   <div style="padding:28px">
    ${alert ? `<div style="background:#b91c1c;color:#fff;padding:14px 18px;border-radius:6px;margin-bottom:16px">⚠️ ${esc(alert)}</div>` : ""}
    <p style="margin:0 0 14px;font-size:13px;color:#555">Сумите са в <strong>леи (RON)</strong>. Доставка с румънски куриер (НЕ Еконт). Поръчката е в раздел „Румъния" на панела.</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:22px">
     <tr style="background:#f3f4f6"><td style="padding:8px 12px;font-weight:600;width:150px">Имена</td><td style="padding:8px 12px">${esc(c.name)}</td></tr>
     <tr><td style="padding:8px 12px;font-weight:600">Телефон</td><td style="padding:8px 12px"><a href="tel:${esc(c.phone)}">${esc(c.phone)}</a></td></tr>
     <tr style="background:#f3f4f6"><td style="padding:8px 12px;font-weight:600">Имейл</td><td style="padding:8px 12px">${esc(c.email)}</td></tr>
     <tr><td style="padding:8px 12px;font-weight:600">Адрес</td><td style="padding:8px 12px">${esc(addressLine(c))}</td></tr>
     <tr style="background:#f3f4f6"><td style="padding:8px 12px;font-weight:600">Бележка</td><td style="padding:8px 12px">${esc(c.notes || "-")}</td></tr>
    </table>
    <table style="width:100%;border-collapse:collapse;font-size:14px"><thead><tr style="background:${NAVY};color:#fff"><th style="padding:8px 12px;text-align:left">Продукт</th><th style="padding:8px 12px;text-align:left">SKU</th><th style="padding:8px 12px">Бр.</th><th style="padding:8px 12px;text-align:right">Цена</th></tr></thead><tbody>${rows}</tbody>
     <tfoot><tr><td colspan="3" style="padding:8px 12px;color:#555">Доставка</td><td style="padding:8px 12px;text-align:right">${o.shippingCost === 0 ? "безплатна" : esc(fmtRON(o.shippingCost))}</td></tr>
     <tr style="background:#f3f4f6;font-weight:700"><td colspan="3" style="padding:10px 12px">ОБЩО (наложен платеж)</td><td style="padding:10px 12px;text-align:right">${esc(fmtRON(o.total))}</td></tr></tfoot></table>
   </div></div></body></html>`;
}
