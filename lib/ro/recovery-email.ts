import { CARD_PAYMENTS_ENABLED } from "@/lib/payments";
import { EMAIL_SITE, EMAIL_NAVY, darkBg, emailHead, emailHeaderRow } from "@/lib/email-layout";
import { fmtRON, RO_DELIVERY_DAYS, RO_FREE_SHIPPING_RON, RO_RETURN_DAYS } from "./config";

// Abandoned-cart reminder for the Romanian site: Romanian text, prices in lei, the restore link goes to /ro/restabilire.
// Counterpart of lib/recovery-email.ts. Sent only to a cart that was captured on /ro WITH the customer's e-mail consent.
export type RoRecoveryItem = { name: string; sku?: string; slug?: string; price: number; quantity: number };
export type RoRecoverySession = { session_id: string; email: string; name: string | null; items: RoRecoveryItem[]; subtotal: number };

export const roRecoverySubject = "Coșul dumneavoastră vă așteaptă - Lorenzo Ricci";
const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function buildRoRecoveryEmail(session: RoRecoverySession): string {
  const first = (session.name ?? "").trim().split(/\s+/)[0];
  const greeting = first ? `Stimată/Stimate ${esc(first)},` : "Bună ziua,";
  const restoreUrl = `${EMAIL_SITE}/ro/restabilire?t=${encodeURIComponent(session.session_id)}`;

  const rows = session.items.map((i) => `
        <tr>
          <td style="padding:14px 0;border-bottom:1px solid #ede8de">
            <span style="font-family:Georgia,serif;font-size:14px;color:#1a1712;display:block;line-height:1.4">${esc(i.name)}</span>
            ${i.sku ? `<span style="font-size:10px;color:#a8a09a;letter-spacing:.12em;text-transform:uppercase">${esc(i.sku)}</span>` : ""}
          </td>
          <td style="padding:14px 0;border-bottom:1px solid #ede8de;text-align:center;vertical-align:top;padding-top:16px"><span style="font-size:12px;color:#a8a09a">×${i.quantity}</span></td>
          <td style="padding:14px 0;border-bottom:1px solid #ede8de;text-align:right;vertical-align:top;padding-top:16px"><span style="font-family:Georgia,serif;font-size:14px;color:#1a1712">${fmtRON(i.price * i.quantity)}</span></td>
        </tr>`).join("");

  return `<!DOCTYPE html>
<html lang="ro" xmlns="http://www.w3.org/1999/xhtml">
${emailHead("Coșul dumneavoastră vă așteaptă - Lorenzo Ricci")}
<body style="margin:0;padding:0;background:#ede9e0;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ede9e0;min-width:100%">
    <tr><td align="center" style="padding:48px 16px 56px">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background:#ffffff;box-shadow:0 2px 24px rgba(15,12,8,.09)">
        ${emailHeaderRow(560)}
        <tr><td style="padding:0;line-height:0;font-size:0"><div style="height:2px;background:linear-gradient(to right,#b8944a,#d4af6a,#e8c878,#d4af6a,#b8944a)"></div></td></tr>
        <tr><td style="padding:44px 48px 0">
          <p style="margin:0 0 6px;font-family:Georgia,serif;font-size:13px;color:#9c9489;letter-spacing:.12em;text-transform:uppercase">Lorenzo Ricci</p>
          <p style="margin:0 0 10px;font-family:Georgia,serif;font-size:26px;font-weight:400;color:${EMAIL_NAVY};line-height:1.3">Coșul dumneavoastră vă așteaptă.</p>
          <p style="margin:0 0 4px;font-size:13px;color:#6b6456;line-height:1.7">${greeting}</p>
          <p style="margin:0 0 36px;font-size:13px;color:#6b6456;line-height:1.7">Am păstrat produsele pe care le-ați ales. Puteți finaliza comanda oricând doriți. Livrarea este gratuită pentru comenzile de peste ${fmtRON(RO_FREE_SHIPPING_RON)}.</p>
          <p style="margin:0 0 4px;font-size:10px;letter-spacing:.25em;text-transform:uppercase;color:#b0a898">Coșul dumneavoastră</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tbody>${rows}</tbody>
            <tbody><tr>
              <td colspan="2" style="padding:16px 0 0;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:#b0a898">Total</td>
              <td style="padding:16px 0 0;text-align:right;font-family:Georgia,serif;font-size:20px;color:${EMAIL_NAVY}">${fmtRON(session.subtotal)}</td>
            </tr></tbody>
          </table>
          <div style="height:1px;background:#ede8de;margin:32px 0"></div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding:0 0 40px">
            <a href="${restoreUrl}" class="lr-dark lr-light" style="display:inline-block;${darkBg()};color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:400;letter-spacing:.3em;text-transform:uppercase;text-decoration:none;padding:18px 44px">Finalizați comanda</a>
          </td></tr></table>
        </td></tr>
        <tr><td style="padding:0 48px 0">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #ede8de;border-bottom:1px solid #ede8de"><tr>
            <td align="center" style="padding:22px 8px;width:33.33%;border-right:1px solid #ede8de"><p style="margin:0 0 4px;font-size:10px;letter-spacing:.15em;text-transform:uppercase;color:${EMAIL_NAVY}">${CARD_PAYMENTS_ENABLED ? "Card sau ramburs" : "Plata la livrare"}</p><p style="margin:0;font-size:11px;color:#9c9489;line-height:1.5">${CARD_PAYMENTS_ENABLED ? "Plată online securizată" : "Ramburs, la primirea coletului"}</p></td>
            <td align="center" style="padding:22px 8px;width:33.33%;border-right:1px solid #ede8de"><p style="margin:0 0 4px;font-size:10px;letter-spacing:.15em;text-transform:uppercase;color:${EMAIL_NAVY}">Livrare</p><p style="margin:0;font-size:11px;color:#9c9489;line-height:1.5">${RO_DELIVERY_DAYS} zile lucrătoare</p></td>
            <td align="center" style="padding:22px 8px;width:33.33%"><p style="margin:0 0 4px;font-size:10px;letter-spacing:.15em;text-transform:uppercase;color:${EMAIL_NAVY}">Retur</p><p style="margin:0;font-size:11px;color:#9c9489;line-height:1.5">${RO_RETURN_DAYS} zile, conform legii</p></td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:32px 48px 40px;text-align:center">
          <p style="margin:0 0 6px;font-family:Georgia,serif;font-size:12px;color:${EMAIL_NAVY};letter-spacing:.18em;text-transform:uppercase">Lorenzo Ricci</p>
          <p style="margin:0 0 16px;font-size:11px;color:#b0a898;line-height:1.8">info@lorenzo-ricci.com &nbsp;·&nbsp; <a href="${EMAIL_SITE}/ro" style="color:#b0a898;text-decoration:none">lorenzo-ricci.com</a></p>
          <p style="margin:0;font-size:10px;color:#c8c2ba;line-height:1.8">Primiți acest e-mail pentru că ați lăsat produse în coș pe lorenzo-ricci.com și ați fost de acord să primiți mementouri.<br>
            <a href="mailto:info@lorenzo-ricci.com?subject=Dezabonare%20de%20la%20e-mailuri" style="color:#c8c2ba;text-decoration:underline">Dezabonare</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
