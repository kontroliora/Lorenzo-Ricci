// Transactional shipment / uncollected-parcel emails (Resend). Plain, personal,
// minimal — designed to land in the inbox, NOT read as marketing. No caps, no
// exclamation, no "buy". One CTA (Econt tracking), one logo, nothing else.

export interface ShipmentEmailData {
  firstName: string;   // customer first name (or "клиент")
  ref: string;         // order_ref, e.g. LR-9MR9IO
  product: string;     // product name(s), comma-joined
  tracking: string;    // AWB
  amount: string;      // COD amount formatted, e.g. "65.00"
  trackUrl: string;    // Econt tracking link
}

export const shipmentSubjects = {
  shipped: (ref: string) => `Поръчка ${ref} е изпратена`,
  reminder: (ref: string) => `Пратката Ви очаква в офис на Еконт (${ref})`,
  final: (ref: string) => `Последно напомняне за пратка ${ref}`,
};

export function econtTrackUrl(awb: string): string {
  return `https://www.econt.com/services/track-shipment/${encodeURIComponent(String(awb).replace(/\s+/g, ""))}`;
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

function detailRows(d: ShipmentEmailData, withAmount: boolean): string {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:#444;margin:0 0 8px">
    <tr><td style="padding:5px 0;width:180px;color:#888">Номер на поръчка</td><td style="padding:5px 0;color:#1a1a1a">${d.ref}</td></tr>
    <tr><td style="padding:5px 0;color:#888">Продукт</td><td style="padding:5px 0;color:#1a1a1a">${d.product}</td></tr>
    <tr><td style="padding:5px 0;color:#888">Тракинг номер</td><td style="padding:5px 0;color:#1a1a1a;font-family:Georgia,serif">${d.tracking}</td></tr>
    ${withAmount ? `<tr><td style="padding:5px 0;color:#888">Сума при получаване</td><td style="padding:5px 0;color:#1a1a1a">€${d.amount} (наложен платеж)</td></tr>` : ""}
  </table>`;
}

function trackButton(d: ShipmentEmailData): string {
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 4px"><tr><td align="center" style="background:${NAVY}">
    <a href="${d.trackUrl}" style="display:inline-block;color:#fff;font-size:11px;letter-spacing:.22em;text-transform:uppercase;text-decoration:none;padding:14px 40px">Проследете пратката</a>
  </td></tr></table>`;
}

const LABEL = (t: string) => `<p style="margin:0 0 14px;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#888">${t}</p>`;
const DIV = `<div style="border-top:1px solid #e8dfc8;margin:26px 0"></div>`;

// Email 1 — shipped (on tracking link). Neutral, informative, positive.
export function buildShippedEmail(d: ShipmentEmailData): string {
  return shell(d, "Вашата поръчка е изпратена и пътува към Вас.", `
  <p style="margin:0 0 6px;font-family:Georgia,serif;font-size:22px;color:${NAVY}">Здравейте, ${d.firstName},</p>
  <p style="margin:0 0 24px;color:#666;font-size:14px;line-height:1.7">Вашата поръчка е предадена на куриер Еконт и вече пътува към Вас. По-долу ще намерите тракинг номера, с който можете да следите пратката.</p>
  ${DIV}${LABEL("Детайли за пратката")}${detailRows(d, false)}${trackButton(d)}
  <p style="margin:18px 0 0;color:#666;font-size:14px;line-height:1.7">Очаквано време на доставка: <strong style="color:#1a1a1a">1 до 2 работни дни</strong>. Еконт ще Ви уведоми, когато пратката пристигне в офиса за получаване.</p>`);
}

// Email 2 — reminder, parcel waiting (day 2-3). Polite, helpful.
export function buildReminderEmail(d: ShipmentEmailData): string {
  return shell(d, "Пратката Ви очаква в офиса на Еконт.", `
  <p style="margin:0 0 6px;font-family:Georgia,serif;font-size:22px;color:${NAVY}">Здравейте, ${d.firstName},</p>
  <p style="margin:0 0 24px;color:#666;font-size:14px;line-height:1.7">Вашата пратка пристигна в офиса на Еконт и Ви очаква. Можете да я вземете в удобно за Вас време през работните часове на офиса.</p>
  ${DIV}${LABEL("Детайли за пратката")}${detailRows(d, true)}${trackButton(d)}
  <p style="margin:18px 0 0;color:#666;font-size:14px;line-height:1.7">Ако вече сте получили пратката, моля не обръщайте внимание на това съобщение.</p>`);
}

// Email 3 — final reminder (day 5-6). Firmer, not aggressive.
export function buildFinalReminderEmail(d: ShipmentEmailData): string {
  return shell(d, "Последно напомняне: пратката Ви скоро ще бъде върната.", `
  <p style="margin:0 0 6px;font-family:Georgia,serif;font-size:22px;color:${NAVY}">Здравейте, ${d.firstName},</p>
  <p style="margin:0 0 16px;color:#666;font-size:14px;line-height:1.7">Вашата пратка все още Ви очаква в офиса на Еконт. Съгласно условията на куриера, тя се съхранява до 7 дни от пристигането си, след което се връща обратно към нас.</p>
  <p style="margin:0 0 24px;color:#666;font-size:14px;line-height:1.7">За да не се налага повторно изпращане, моля вземете я в оставащите дни.</p>
  ${DIV}${LABEL("Детайли за пратката")}${detailRows(d, true)}${trackButton(d)}
  <p style="margin:18px 0 0;color:#666;font-size:14px;line-height:1.7">При въпрос или нужда от съдействие ни пишете на info@lorenzo-ricci.com. Ако вече сте получили пратката, моля не обръщайте внимание на това съобщение.</p>`);
}
