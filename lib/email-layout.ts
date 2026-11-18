// Shared pieces for the customer HTML e-mails. Every e-mail is LIGHT (ivory page, white card, navy text), like the marketing e-mails,
// and looks the same in every mail app:
//   - color-scheme "light dark" (owner, 18.11.2026; was "light" only): every block carries its own inline background and text colour,
//     so a client that honours the meta keeps the e-mail as designed; body has a default dark text colour for anything uncoloured;
//   - the header is a white block with the logo as a PNG (public/email-logo-navy.png, 400x96 = 200 px at 2x) whose white plate is
//     baked in: Gmail iOS/Android and Zoho invert the page in dark mode but never an image, so the navy wordmark always sits on
//     white and never blends into a dark background;
//   - Outlook (outlook.com, Outlook iOS/Android/Mac) darkens the page anyway and marks it with [data-ogsc]/[data-ogsb]: there the header
//     turns navy and the logo swaps to public/email-logo-white.png (white wordmark on navy).
//     No @media (prefers-color-scheme: dark) swap on purpose: Apple Mail matches that query but (thanks to the meta) keeps the e-mail
//     light, so a swap there would put a navy bar on a light e-mail - the opposite of "the same everywhere";
//   - buttons are goldButton() (gold + near-black text, gradient + border: see below); darkBg() stays for other dark blocks.
// The logos are made by scripts/make-email-logos.mjs.
export const EMAIL_SITE = "https://lorenzo-ricci.com";
export const EMAIL_NAVY = "#0a0e1f";
export const EMAIL_IVORY = "#f5f0e8";
// Images load straight from www: the bare domain answers 308 -> www, and some mail image proxies do not follow redirects.
const EMAIL_ASSETS = "https://www.lorenzo-ricci.com";
export const EMAIL_LOGO_NAVY = `${EMAIL_ASSETS}/email-logo-navy.png`;
export const EMAIL_LOGO_WHITE = `${EMAIL_ASSETS}/email-logo-white.png`;

const escAttr = (s: string) => String(s ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/**
 * The bulletproof gold button: a one-cell table (bgcolor + inline background), the link inside it, one line (nowrap).
 * `label` is plain text (escaped here). `align` places the button; `margin` is the table's outer margin.
 */
export function goldButton(href: string, label: string, opts: { align?: "center" | "left"; margin?: string; fontSize?: number } = {}): string {
  const g = EMAIL_GOLD, t = EMAIL_BTN_TEXT, fs = opts.fontSize ?? 12;
  const text = escAttr(label).replace(/>/g, "&gt;");
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" ${opts.align === "left" ? "" : 'align="center" '}style="margin:${opts.margin ?? "22px auto 10px"};border-collapse:separate">
  <tr><td align="center" bgcolor="${g}" class="lr-gold" style="background:${g};background-color:${g};background-image:linear-gradient(${g},${g});border:1px solid ${g};border-radius:2px;mso-padding-alt:14px 16px">
    <a href="${escAttr(href)}" class="lr-gold-t" style="display:inline-block;padding:14px 16px;font-family:Arial,Helvetica,sans-serif;font-size:${fs}px;line-height:1.2;font-weight:bold;letter-spacing:.18em;text-transform:uppercase;white-space:nowrap;color:${t};-webkit-text-fill-color:${t};text-decoration:none">${text}</a>
  </td></tr></table>`;
}

/** Background for a dark block (a button): the colour plus a gradient of the same colour. */
export const darkBg = (hex = EMAIL_NAVY): string => `background:${hex};background-color:${hex};background-image:linear-gradient(${hex},${hex})`;

// Call-to-action buttons (owner, 18.11.2026): solid gold with near-black bold text - the navy button nearly vanished on a dark mail
// background. Kept gold with dark text in every mode: inline bgcolor + background-color + same-colour gradient (Gmail does not invert
// gradients), a 1px border of the same gold (still outlined if colours are inverted), and dark-mode / Outlook rules below.
export const EMAIL_GOLD = "#C9A961";
export const EMAIL_BTN_TEXT = "#111111";

export const EMAIL_DARK_CSS = `
  :root{color-scheme:light dark;supported-color-schemes:light dark}
  body{color:#1a1a1a}
  .lr-gold{background-color:${EMAIL_GOLD} !important;background-image:linear-gradient(${EMAIL_GOLD},${EMAIL_GOLD}) !important;border-color:${EMAIL_GOLD} !important}
  .lr-gold-t{color:${EMAIL_BTN_TEXT} !important;-webkit-text-fill-color:${EMAIL_BTN_TEXT} !important}
  @media (prefers-color-scheme: dark){
    .lr-gold{background-color:${EMAIL_GOLD} !important;background-image:linear-gradient(${EMAIL_GOLD},${EMAIL_GOLD}) !important;border-color:${EMAIL_GOLD} !important}
    .lr-gold-t{color:${EMAIL_BTN_TEXT} !important;-webkit-text-fill-color:${EMAIL_BTN_TEXT} !important}
  }
  [data-ogsb] .lr-gold{background-color:${EMAIL_GOLD} !important;background-image:linear-gradient(${EMAIL_GOLD},${EMAIL_GOLD}) !important}
  [data-ogsc] .lr-gold-t{color:${EMAIL_BTN_TEXT} !important}
  .lr-dark{background-color:${EMAIL_NAVY} !important;background-image:linear-gradient(${EMAIL_NAVY},${EMAIL_NAVY}) !important}
  .lr-light{color:#ffffff !important}
  [data-ogsb] .lr-dark,[data-ogsb] .lr-head{background-color:${EMAIL_NAVY} !important;background-image:linear-gradient(${EMAIL_NAVY},${EMAIL_NAVY}) !important}
  [data-ogsc] .lr-light,[data-ogsc] .lr-light a{color:#ffffff !important}
  [data-ogsc] .lr-logo-n,[data-ogsb] .lr-logo-n{display:none !important;max-height:0 !important}
  [data-ogsc] .lr-logo-w,[data-ogsb] .lr-logo-w{display:block !important;max-height:none !important;width:200px !important;height:auto !important;overflow:visible !important}`;

/** <head> with the light colour-scheme tags and the dark-mode rules. */
export function emailHead(title: string): string {
  return `<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${title}</title>
<style>${EMAIL_DARK_CSS}
</style>
</head>`;
}

/** The logo: navy on its white plate; the white-on-navy twin is hidden and only shown by Outlook's dark mode. */
export function emailLogo(): string {
  return `<img class="lr-logo-n" src="${EMAIL_LOGO_NAVY}" width="200" height="48" alt="LORENZO RICCI" style="display:block;margin:0 auto;width:200px;max-width:200px;height:auto;border:0;outline:none;text-decoration:none;color:${EMAIL_NAVY};font-family:Georgia,serif;font-size:20px;letter-spacing:.18em;font-weight:700">
        <!--[if !mso]><!--><img class="lr-logo-w" src="${EMAIL_LOGO_WHITE}" width="200" height="48" alt="LORENZO RICCI" style="display:none;margin:0 auto;width:0;max-height:0;overflow:hidden;border:0;outline:none;mso-hide:all"><!--<![endif]-->`;
}

/** The header row (a table row for a 560-600 px wide card): white block, logo centred. */
export function emailHeaderRow(_width = 560): string {
  return `<tr><td class="lr-head" align="center" bgcolor="#ffffff" style="background:#ffffff;background-color:#ffffff;padding:30px 40px 26px;text-align:center">
        ${emailLogo()}
      </td></tr>`;
}

/** Where customers reply: every order e-mail carries Reply-To so the answer lands in our inbox with "Re: Поръчка LR-…". */
export const ORDER_REPLY_TO = "info@lorenzo-ricci.com";

/** The order number, big, at the very top of a customer order e-mail (a table row right under the header). */
export function emailOrderRefRow(ref: string, label: string): string {
  const r = String(ref ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
  if (!r) return "";
  return `<tr><td align="center" style="padding:28px 40px 0;text-align:center">
        <p style="margin:0 0 6px;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#888">${label}</p>
        <p style="margin:0;font-family:Georgia,serif;font-size:28px;line-height:1.2;font-weight:bold;letter-spacing:.06em;color:${EMAIL_NAVY}">${r}</p>
      </td></tr>`;
}
