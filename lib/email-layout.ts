// Shared pieces for the HTML e-mails (dark-mode safe). Mail apps (Gmail iOS/Android, Outlook, Apple Mail) re-colour e-mails in dark
// mode; a navy header with white text then turns light and the text is lost. So:
//   - the header is a PNG with its dark background and the white wordmark baked in (public/email-header.png, 1200x240 = 600 wide at 2x);
//   - color-scheme meta + :root declaration (light dark);
//   - every dark block carries background-image:linear-gradient(c,c) next to its background colour (Gmail does not invert gradients);
//   - @media (prefers-color-scheme: dark) and [data-ogsc]/[data-ogsb] rules keep light text on dark blocks.
export const EMAIL_SITE = "https://lorenzo-ricci.com";
export const EMAIL_NAVY = "#0a0e1f";

/** Background for a dark block: the colour plus a gradient of the same colour. */
export const darkBg = (hex = EMAIL_NAVY): string => `background:${hex};background-color:${hex};background-image:linear-gradient(${hex},${hex})`;

export const EMAIL_DARK_CSS = `
  :root{color-scheme:light dark;supported-color-schemes:light dark}
  .lr-dark{background-color:${EMAIL_NAVY} !important;background-image:linear-gradient(${EMAIL_NAVY},${EMAIL_NAVY}) !important}
  .lr-light{color:#ffffff !important}
  @media (prefers-color-scheme: dark){
    .lr-dark{background-color:${EMAIL_NAVY} !important;background-image:linear-gradient(${EMAIL_NAVY},${EMAIL_NAVY}) !important}
    .lr-light,.lr-light a{color:#ffffff !important}
  }
  [data-ogsb] .lr-dark{background-color:${EMAIL_NAVY} !important;background-image:linear-gradient(${EMAIL_NAVY},${EMAIL_NAVY}) !important}
  [data-ogsc] .lr-light,[data-ogsc] .lr-light a{color:#ffffff !important}`;

/** <head> with the colour-scheme tags and the dark-mode rules. */
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

/** The header row (a table row for a 560-600 px wide card): the PNG with its dark background and the white wordmark baked in. */
export function emailHeaderRow(width = 560): string {
  return `<tr><td class="lr-dark" bgcolor="${EMAIL_NAVY}" style="${darkBg()};padding:0;line-height:0;font-size:0">
        <img src="${EMAIL_SITE}/email-header.png" width="${width}" alt="LORENZO RICCI" style="display:block;width:100%;max-width:${width}px;height:auto;border:0">
      </td></tr>`;
}
