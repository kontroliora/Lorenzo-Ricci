export interface RecoveryCartItem {
  name:        string;
  sku?:        string;
  slug?:       string;
  price:       number;
  currency:    string;
  quantity:    number;
  coverImage?: { src: string; alt: string };
}

export interface RecoverySession {
  session_id:  string;
  email:       string;
  name:        string | null;
  phone:       string | null;
  items:       RecoveryCartItem[];
  subtotal:    number;
  updated_at:  string;
}

export function buildRecoveryEmail(session: RecoverySession): string {
  const rawName   = session.name?.trim() ?? "";
  const firstName = rawName ? rawName.split(" ")[0] : "";

  const greeting = firstName
    ? `Уважаеми ${firstName},`
    : "Уважаеми клиент,";

  const itemRows = session.items
    .map(
      (i) => `
        <tr>
          <td style="padding:14px 0;border-bottom:1px solid #ede8de">
            <span style="font-family:Georgia,serif;font-size:14px;color:#1a1712;display:block;line-height:1.4">${i.name}</span>
            ${i.sku ? `<span style="font-size:10px;color:#a8a09a;letter-spacing:.12em;text-transform:uppercase">${i.sku}</span>` : ""}
          </td>
          <td style="padding:14px 0;border-bottom:1px solid #ede8de;text-align:center;vertical-align:top;padding-top:16px">
            <span style="font-size:12px;color:#a8a09a">×${i.quantity}</span>
          </td>
          <td style="padding:14px 0;border-bottom:1px solid #ede8de;text-align:right;vertical-align:top;padding-top:16px">
            <span style="font-family:Georgia,serif;font-size:14px;color:#1a1712">${i.currency ?? "€"}${(i.price * i.quantity).toFixed(2)}</span>
          </td>
        </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="bg" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>Вашата количка ви очаква — Lorenzo Ricci</title>
</head>
<body style="margin:0;padding:0;background:#ede9e0;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%">

  <!--[if mso]><table width="100%" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background:#ede9e0;min-width:100%">
    <tr>
      <td align="center" style="padding:48px 16px 56px">

        <!-- ── Card ──────────────────────────────────────────────────── -->
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0"
               style="max-width:560px;width:100%;background:#ffffff;box-shadow:0 2px 24px rgba(15,12,8,.09)">

          <!-- HEADER: dark navy -->
          <tr>
            <td style="background:#0a0e1f;padding:36px 48px 30px;text-align:center">
              <img src="https://lorenzo-ricci.com/email-logo.png" alt="Lorenzo Ricci"
                   width="180" height="auto"
                   style="display:block;margin:0 auto;max-width:180px;height:auto;border:0">
            </td>
          </tr>

          <!-- Gold accent line -->
          <tr>
            <td style="padding:0;line-height:0;font-size:0">
              <div style="height:2px;background:linear-gradient(to right,#b8944a,#d4af6a,#e8c878,#d4af6a,#b8944a)"></div>
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="padding:44px 48px 0">

              <!-- Greeting -->
              <p style="margin:0 0 6px;font-family:Georgia,serif;font-size:13px;color:#9c9489;letter-spacing:.12em;text-transform:uppercase">
                Lorenzo Ricci
              </p>
              <p style="margin:0 0 10px;font-family:Georgia,serif;font-size:26px;font-weight:400;color:#0a0e1f;line-height:1.3">
                Вашата количка ви очаква.
              </p>
              <p style="margin:0 0 4px;font-size:13px;color:#6b6456;line-height:1.7">
                ${greeting}
              </p>
              <p style="margin:0 0 36px;font-size:13px;color:#6b6456;line-height:1.7">
                Запазихме вашите избрани артикули. Завършете поръчката, когато сте готови — доставката е безплатна за поръчки над €60.
              </p>

              <!-- Section label -->
              <p style="margin:0 0 4px;font-size:10px;letter-spacing:.25em;text-transform:uppercase;color:#b0a898">
                Вашата количка
              </p>

              <!-- Items table -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tbody>${itemRows}</tbody>
                <tbody>
                  <tr>
                    <td colspan="2" style="padding:16px 0 0;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:#b0a898">
                      Общо
                    </td>
                    <td style="padding:16px 0 0;text-align:right;font-family:Georgia,serif;font-size:20px;color:#0a0e1f">
                      €${session.subtotal.toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>

              <!-- Divider -->
              <div style="height:1px;background:#ede8de;margin:32px 0"></div>

              <!-- CTA -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding:0 0 40px">
                    <a href="https://lorenzo-ricci.com"
                       style="display:inline-block;background:#0a0e1f;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:400;letter-spacing:.3em;text-transform:uppercase;text-decoration:none;padding:16px 52px;border:none;mso-padding-alt:0">
                      <!--[if mso]><i style="letter-spacing:.3em;mso-font-width:-100%">&nbsp;</i><![endif]-->
                      Завърши поръчката
                      <!--[if mso]><i style="letter-spacing:.3em;mso-font-width:-100%">&nbsp;</i><![endif]-->
                    </a>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- TRUST STRIP -->
          <tr>
            <td style="padding:0 48px 0">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="border-top:1px solid #ede8de;border-bottom:1px solid #ede8de">
                <tr>
                  <td align="center" style="padding:22px 8px;width:33.33%;border-right:1px solid #ede8de">
                    <p style="margin:0 0 4px;font-size:10px;letter-spacing:.15em;text-transform:uppercase;color:#0a0e1f">Наложен платеж</p>
                    <p style="margin:0;font-size:11px;color:#9c9489;line-height:1.5">Плащате при доставка</p>
                  </td>
                  <td align="center" style="padding:22px 8px;width:33.33%;border-right:1px solid #ede8de">
                    <p style="margin:0 0 4px;font-size:10px;letter-spacing:.15em;text-transform:uppercase;color:#0a0e1f">Доставка</p>
                    <p style="margin:0;font-size:11px;color:#9c9489;line-height:1.5">До 2 работни дни</p>
                  </td>
                  <td align="center" style="padding:22px 8px;width:33.33%">
                    <p style="margin:0 0 4px;font-size:10px;letter-spacing:.15em;text-transform:uppercase;color:#0a0e1f">Замяна</p>
                    <p style="margin:0;font-size:11px;color:#9c9489;line-height:1.5">30 дни, без въпроси</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="padding:32px 48px 40px;text-align:center">
              <p style="margin:0 0 6px;font-family:Georgia,serif;font-size:12px;color:#0a0e1f;letter-spacing:.18em;text-transform:uppercase">
                Lorenzo Ricci
              </p>
              <p style="margin:0 0 16px;font-size:11px;color:#b0a898;line-height:1.8">
                info@lorenzo-ricci.com &nbsp;·&nbsp;
                <a href="https://lorenzo-ricci.com" style="color:#b0a898;text-decoration:none">lorenzo-ricci.com</a>
              </p>
              <p style="margin:0;font-size:10px;color:#c8c2ba;line-height:1.8">
                Получавате това писмо, защото сте дали съгласие за маркетингови съобщения.
                <br>
                <a href="https://lorenzo-ricci.com" style="color:#c8c2ba;text-decoration:underline">Отпишете се</a>
              </p>
            </td>
          </tr>

        </table>
        <!-- ── /Card ─────────────────────────────────────────────────── -->

      </td>
    </tr>
  </table>
  <!--[if mso]></td></tr></table><![endif]-->

</body>
</html>`;
}
