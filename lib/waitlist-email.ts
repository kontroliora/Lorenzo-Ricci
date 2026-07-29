// Soft-decline ("temporarily out of stock") email for the international test
// market. Restrained luxury tone — a warm, brief acknowledgement, an honest
// out-of-stock note, and a private code offered as a quiet gesture (not a loud
// apology, not a marketing push). Matches the confirmation email's HTML shell
// (navy header, cream ground, Georgia serif, #e8dfc8 dividers). English copy.
//
// DRAFT copy — pending owner polish of the luxury tone.

export const waitlistSubject = "A note on your Lorenzo Ricci order";

export function buildWaitlistEmail(opts: {
  firstName: string;
  itemNames: string[];
  promoCode: string;
  discountPct: number; // e.g. 5
}): string {
  const { firstName, itemNames, promoCode, discountPct } = opts;
  const name  = firstName?.trim() || "there";
  const piece = itemNames.length > 1 ? "the pieces you selected" : "the piece you selected";
  const list  = itemNames.filter(Boolean).join(" · ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>A note on your Lorenzo Ricci order</title>
</head>
<body style="margin:0;padding:0;background:#f5f0e8;font-family:Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f0e8;padding:40px 16px">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;max-width:560px;width:100%">

          <!-- Header -->
          <tr>
            <td style="background:#0a0e1f;padding:36px 40px;text-align:center">
              <img src="https://lorenzo-ricci.com/email-logo.png" alt="Lorenzo Ricci" width="200" style="max-width:200px;height:auto;display:block;margin:0 auto">
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 8px">
              <p style="margin:0 0 20px;font-family:'Georgia',serif;font-size:22px;color:#0a0e1f">Dear ${name},</p>

              <p style="margin:0 0 20px;color:#444;font-size:15px;line-height:1.7">
                Thank you for your order, and for your interest in Lorenzo Ricci.
              </p>

              <p style="margin:0 0 20px;color:#444;font-size:15px;line-height:1.7">
                ${piece}${list ? ` &mdash; <span style="color:#0a0e1f">${list}</span>` : ""} is temporarily out of stock.
                We are preparing the next production and will write to you personally the moment it is available again.
              </p>

              <p style="margin:0 0 28px;color:#444;font-size:15px;line-height:1.7">
                With our thanks for your patience, please keep the code below. It is yours to use toward your order when the piece returns.
              </p>

              <!-- Code -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="border:1px solid #e8dfc8;padding:22px 20px">
                    <p style="margin:0 0 8px;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#888">${discountPct}% &mdash; with our compliments</p>
                    <p style="margin:0;font-family:'Georgia',serif;font-size:26px;letter-spacing:.14em;color:#0a0e1f">${promoCode}</p>
                    <p style="margin:10px 0 0;font-size:12px;color:#999">Yours to keep &mdash; no expiry</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Sign-off -->
          <tr>
            <td style="padding:28px 40px 40px">
              <div style="border-top:1px solid #e8dfc8;margin-bottom:24px"></div>
              <p style="margin:0;color:#444;font-size:15px;line-height:1.7">With warm regards,</p>
              <p style="margin:2px 0 0;font-family:'Georgia',serif;font-size:16px;color:#0a0e1f">Lorenzo Ricci</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
