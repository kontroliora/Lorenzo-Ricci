// Transactional shipment / uncollected-parcel emails (Resend). Plain, personal,
// premium — designed to land in the inbox, not read as marketing. No caps for
// emphasis, no exclamation, no "buy". One CTA (own /track page), one logo.

export interface ShipmentItem {
  name: string;
  qty: number;
  price: number;      // unit price
  currency: string;
}

export interface ShipmentEmailData {
  firstName: string;  // customer first name (or "клиент")
  ref: string;        // order_ref
  items: ShipmentItem[];
  total: string;      // formatted order total, e.g. "65.00"
  currency: string;
  tracking: string;   // AWB
  trackUrl: string;   // own branded /track/{awb} page
  officeName?: string; // Econt storageOfficeName — WHICH office holds the parcel (reminders)
}

export const shipmentSubjects = {
  shipped: (ref: string) => `Поръчка ${ref} е изпратена`,
  reminder: (ref: string) => `Пратката Ви очаква в офис на Еконт (${ref})`,
};

// All emails point to our own branded page, never econt.com.
export function trackPageUrl(awb: string): string {
  return `https://lorenzo-ricci.com/track/${encodeURIComponent(String(awb).replace(/\s+/g, ""))}`;
}

const NAVY = "#0a0e1f";

function shell(d: ShipmentEmailData, preheader: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="bg"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>Lorenzo Ricci</title></head>
<body style="margin:0;padding:0;background:#f5f0e8;font-family:Arial,Helvetica,sans-serif">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${preheader}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f0e8;padding:40px 16px">
  <tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#fff;max-width:560px;width:100%">
      <tr><td style="background:${NAVY};padding:34px 40px;text-align:center">
        <img src="https://lorenzo-ricci.com/email-logo.png" alt="Lorenzo Ricci" width="190" style="max-width:190px;height:auto;display:block;margin:0 auto;border:0">
      </td></tr>
      <tr><td style="padding:0;line-height:0;font-size:0"><div style="height:2px;background:linear-gradient(to right,#b8944a,#d4af6a,#e8c878,#d4af6a,#b8944a)"></div></td></tr>
      <tr><td style="padding:40px 40px 8px">${bodyHtml}</td></tr>
      <tr><td style="padding:24px 40px 40px;text-align:center">
        <div style="border-top:1px solid #e8dfc8;padding-top:24px">
          <p style="margin:0 0 6px;font-family:Georgia,serif;font-size:13px;color:${NAVY};letter-spacing:.08em">LORENZO RICCI</p>
          <p style="margin:0 0 12px;font-size:11px;color:#aaa;line-height:1.8">info@lorenzo-ricci.com &nbsp;·&nbsp; <a href="https://lorenzo-ricci.com" style="color:#aaa;text-decoration:none">lorenzo-ricci.com</a></p>
          <p style="margin:0;font-size:10px;color:#c8c2ba;line-height:1.7">Получавате това писмо във връзка с Вашата поръчка ${d.ref} в Lorenzo Ricci.</p>
        </div>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

const LABEL = (t: string) => `<p style="margin:0 0 14px;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#888">${t}</p>`;
const DIV = `<div style="border-top:1px solid #e8dfc8;margin:26px 0"></div>`;

function trackButton(d: ShipmentEmailData): string {
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 4px"><tr><td align="center" style="background:${NAVY}">
    <a href="${d.trackUrl}" style="display:inline-block;color:#fff;font-size:11px;letter-spacing:.22em;text-transform:uppercase;text-decoration:none;padding:14px 40px">Проследете пратката</a>
  </td></tr></table>`;
}

// Small "Поръчка / Тракинг / Сума" line block, shared by the reminders.
function refBlock(d: ShipmentEmailData, withTracking: boolean): string {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:#444">
    <tr><td style="padding:5px 0;width:190px;color:#888">Поръчка</td><td style="padding:5px 0;color:#1a1a1a">${d.ref}</td></tr>
    ${withTracking ? `<tr><td style="padding:5px 0;color:#888">Тракинг номер</td><td style="padding:5px 0;color:#1a1a1a;font-family:Georgia,serif">${d.tracking}</td></tr>` : ""}
    <tr><td style="padding:5px 0;color:#888">Сума при получаване</td><td style="padding:5px 0;color:#1a1a1a">${d.currency}${d.total} (наложен платеж)</td></tr>
  </table>`;
}

// ── EMAIL 1 — shipped (trigger: Econt accepted, sendTime != null) ────────────
export function buildShippedEmail(d: ShipmentEmailData): string {
  const itemRows = d.items
    .map(
      (i) => `<tr>
        <td style="padding:12px 0;border-bottom:1px solid #e8dfc8;font-family:Georgia,serif;color:#1a1a1a;font-size:14px">${i.name}</td>
        <td style="padding:12px 0;border-bottom:1px solid #e8dfc8;text-align:center;color:#555;font-size:14px">×${i.qty}</td>
        <td style="padding:12px 0;border-bottom:1px solid #e8dfc8;text-align:right;font-family:Georgia,serif;color:#1a1a1a;font-size:14px">${i.currency}${i.price.toFixed(2)}</td>
      </tr>`,
    )
    .join("");

  return shell(d, "Вашата поръчка е предадена на Еконт и пътува към Вас.", `
  <p style="margin:0 0 6px;font-family:Georgia,serif;font-size:22px;color:${NAVY}">Здравейте, ${d.firstName},</p>
  <p style="margin:0 0 24px;color:#666;font-size:14px;line-height:1.7">Благодарим Ви за доверието към Lorenzo Ricci. Вашата поръчка е предадена на куриер Еконт и вече пътува към Вас.</p>
  ${DIV}${LABEL("Поръчка " + d.ref)}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tbody>${itemRows}</tbody>
    <tfoot><tr>
      <td colspan="2" style="padding:14px 0 0;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#888">Обща сума (наложен платеж)</td>
      <td style="padding:14px 0 0;text-align:right;font-family:Georgia,serif;font-size:20px;color:${NAVY};font-weight:700">${d.currency}${d.total}</td>
    </tr></tfoot>
  </table>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:#444;margin-top:18px">
    <tr><td style="padding:4px 0;width:150px;color:#888">Тракинг номер</td><td style="padding:4px 0;color:#1a1a1a;font-family:Georgia,serif">${d.tracking}</td></tr>
  </table>
  ${trackButton(d)}
  <p style="margin:18px 0 0;color:#666;font-size:14px;line-height:1.7">Очаквано време на доставка: <strong style="color:#1a1a1a">1-2 работни дни</strong>.</p>`);
}

// ── EMAIL 2, CASE A — office delivery, waiting at final office ───────────────
export function buildReminderOfficeEmail(d: ShipmentEmailData): string {
  const office = d.officeName ? ` ${d.officeName}` : "";
  return shell(d, "Пратката Ви очаква в офис на Еконт.", `
  <p style="margin:0 0 6px;font-family:Georgia,serif;font-size:22px;color:${NAVY}">Здравейте, ${d.firstName},</p>
  <p style="margin:0 0 16px;color:#666;font-size:14px;line-height:1.7">Вашата пратка от Lorenzo Ricci Ви очаква в офис на Еконт${office}. Съгласно условията на куриера, тя се съхранява до 7 дни от пристигането, след което се връща обратно към нас.</p>
  <p style="margin:0 0 24px;color:#666;font-size:14px;line-height:1.7">Ако не бъде получена в оставащите дни, пратката ще бъде върната и поръчката — анулирана.</p>
  ${DIV}${refBlock(d, true)}${trackButton(d)}
  <p style="margin:18px 0 0;color:#666;font-size:14px;line-height:1.7">Оставаме на разположение при въпроси на info@lorenzo-ricci.com. Ако вече сте получили пратката, моля не обръщайте внимание на това съобщение.</p>`);
}

// ── EMAIL 2, CASE B — door delivery, failed attempt → parked at office ───────
export function buildReminderDoorEmail(d: ShipmentEmailData): string {
  const office = d.officeName ? ` ${d.officeName}` : "";
  return shell(d, "Пратката Ви вече очаква в офис на Еконт.", `
  <p style="margin:0 0 6px;font-family:Georgia,serif;font-size:22px;color:${NAVY}">Здравейте, ${d.firstName},</p>
  <p style="margin:0 0 16px;color:#666;font-size:14px;line-height:1.7">Опитахме да доставим Вашата пратка от Lorenzo Ricci на посочения адрес, но не успяхме да Ви открием. Пратката вече Ви очаква в офис на Еконт${office} и се съхранява до 7 дни, след което се връща обратно към нас.</p>
  <p style="margin:0 0 24px;color:#666;font-size:14px;line-height:1.7">Ако не бъде получена в оставащите дни, пратката ще бъде върната и поръчката — анулирана.</p>
  ${DIV}${refBlock(d, true)}${trackButton(d)}
  <p style="margin:18px 0 0;color:#666;font-size:14px;line-height:1.7">Оставаме на разположение при въпроси на info@lorenzo-ricci.com.</p>`);
}
