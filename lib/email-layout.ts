// Shared pieces for the customer HTML e-mails. Every e-mail is LIGHT (ivory page, white card, navy text), like the marketing e-mails,
// and looks the same in every mail app:
//   - color-scheme "light" only: Apple Mail (macOS/iOS) then keeps the e-mail light in dark mode instead of re-colouring it;
//   - the header is a white block with the logo as a PNG (public/email-logo-navy.png, 400x96 = 200 px at 2x) whose white plate is
//     baked in: Gmail iOS/Android and Zoho invert the page in dark mode but never an image, so the navy wordmark always sits on
//     white and never blends into a dark background;
//   - Outlook (outlook.com, Outlook iOS/Android/Mac) darkens the page anyway and marks it with [data-ogsc]/[data-ogsb]: there the header
//     turns navy and the logo swaps to public/email-logo-white.png (white wordmark on navy).
//     No @media (prefers-color-scheme: dark) swap on purpose: Apple Mail matches that query but (thanks to the meta) keeps the e-mail
//     light, so a swap there would put a navy bar on a light e-mail - the opposite of "the same everywhere";
//   - dark buttons carry background-image:linear-gradient(c,c) next to their colour (Gmail does not invert gradients).
// The logos are made by scripts/make-email-logos.mjs.
export const EMAIL_SITE = "https://lorenzo-ricci.com";
export const EMAIL_NAVY = "#0a0e1f";
export const EMAIL_IVORY = "#f5f0e8";
export const EMAIL_LOGO_NAVY = `${EMAIL_SITE}/email-logo-navy.png`;
export const EMAIL_LOGO_WHITE = `${EMAIL_SITE}/email-logo-white.png`;

/** Background for a dark block (a button): the colour plus a gradient of the same colour. */
export const darkBg = (hex = EMAIL_NAVY): string => `background:${hex};background-color:${hex};background-image:linear-gradient(${hex},${hex})`;

export const EMAIL_DARK_CSS = `
  :root{color-scheme:light;supported-color-schemes:light}
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
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
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
