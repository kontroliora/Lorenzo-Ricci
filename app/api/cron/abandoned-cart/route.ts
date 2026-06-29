import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { supabase } from "@/lib/supabase";

// ── Types ────────────────────────────────────────────────────────────────────

interface CartItem {
  name:       string;
  sku?:       string;
  slug?:      string;
  price:      number;
  currency:   string;
  quantity:   number;
  coverImage?: { src: string; alt: string };
}

interface AbandonedSession {
  session_id:  string;
  email:       string;
  name:        string | null;
  phone:       string | null;
  items:       CartItem[];
  subtotal:    number;
  updated_at:  string;
}

// ── Recovery email HTML ───────────────────────────────────────────────────────

function buildRecoveryEmail(session: AbandonedSession): string {
  const firstName = session.name
    ? session.name.trim().split(" ")[0]
    : "скъпи клиент";

  const itemRows = session.items
    .map(
      (i) => `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #e8dfc8;font-family:'Georgia',serif;color:#1a1a1a;font-size:14px">
          ${i.name}
        </td>
        <td style="padding:12px 0;border-bottom:1px solid #e8dfc8;text-align:center;color:#555;font-size:14px">
          ×${i.quantity}
        </td>
        <td style="padding:12px 0;border-bottom:1px solid #e8dfc8;text-align:right;font-family:'Georgia',serif;color:#1a1a1a;font-size:14px">
          ${i.currency ?? "€"}${(i.price * i.quantity).toFixed(2)}
        </td>
      </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="bg">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Забравихте нещо — Lorenzo Ricci</title>
</head>
<body style="margin:0;padding:0;background:#f5f0e8;font-family:Arial,sans-serif">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f0e8;padding:40px 16px">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;max-width:560px;width:100%">

          <!-- Header -->
          <tr>
            <td style="background:#0a0e1f;padding:36px 40px;text-align:center">
              <img src="https://lorenzo-ricci.com/email-logo.png" alt="Lorenzo Ricci" width="200"
                style="max-width:200px;height:auto;display:block;margin:0 auto">
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 0">
              <p style="margin:0 0 8px;font-family:'Georgia',serif;font-size:22px;color:#0a0e1f">
                Забравихте нещо, ${firstName}?
              </p>
              <p style="margin:0 0 28px;color:#666;font-size:14px;line-height:1.7">
                Оставихте продукти в количката си. Те все още ви чакат — но наличностите ни са ограничени.
              </p>

              <div style="border-top:1px solid #e8dfc8;margin-bottom:28px"></div>

              <p style="margin:0 0 16px;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#888">
                Вашата количка
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tbody>${itemRows}</tbody>
                <tfoot>
                  <tr>
                    <td colspan="2" style="padding:14px 0 0;font-size:12px;letter-spacing:.15em;text-transform:uppercase;color:#888">
                      Подсума
                    </td>
                    <td style="padding:14px 0 0;text-align:right;font-family:'Georgia',serif;font-size:18px;color:#0a0e1f;font-weight:700">
                      €${session.subtotal.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>

              <div style="border-top:1px solid #e8dfc8;margin:28px 0"></div>

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:0 0 28px">
                    <a href="https://lorenzo-ricci.com"
                       style="display:inline-block;background:#0a0e1f;color:#fff;font-family:Arial,sans-serif;font-size:11px;letter-spacing:.22em;text-transform:uppercase;text-decoration:none;padding:16px 40px">
                      Завърши поръчката
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Trust strip -->
              <div style="background:#f9f6f0;padding:20px 24px;border:1px solid #e8dfc8;margin-bottom:28px">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center" style="padding:0 8px;font-size:12px;color:#666;line-height:1.5;width:33%">
                      <strong style="display:block;color:#0a0e1f;font-size:11px;letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px">
                        Наложен платеж
                      </strong>
                      Плащате при получаване
                    </td>
                    <td align="center" style="padding:0 8px;font-size:12px;color:#666;line-height:1.5;width:33%">
                      <strong style="display:block;color:#0a0e1f;font-size:11px;letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px">
                        Доставка
                      </strong>
                      До 2 работни дни
                    </td>
                    <td align="center" style="padding:0 8px;font-size:12px;color:#666;line-height:1.5;width:33%">
                      <strong style="display:block;color:#0a0e1f;font-size:11px;letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px">
                        Замяна
                      </strong>
                      30 дни лесна замяна
                    </td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:0 40px 40px;text-align:center">
              <div style="border-top:1px solid #e8dfc8;padding-top:28px">
                <p style="margin:0 0 6px;font-family:'Georgia',serif;font-size:13px;color:#0a0e1f;letter-spacing:.08em">
                  LORENZO RICCI
                </p>
                <p style="margin:0;font-size:11px;color:#aaa;line-height:1.8">
                  info@lorenzo-ricci.com<br>
                  <a href="https://lorenzo-ricci.com" style="color:#aaa;text-decoration:none">lorenzo-ricci.com</a>
                </p>
                <p style="margin:12px 0 0;font-size:10px;color:#ccc">
                  Получавате този имейл, защото сте дали съгласие за маркетингови съобщения.<br>
                  <a href="https://lorenzo-ricci.com" style="color:#ccc">Отпишете се</a>
                </p>
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── GET /api/cron/abandoned-cart ─────────────────────────────────────────────
// Called by Vercel Cron every 10 minutes.
// Vercel automatically passes Authorization: Bearer ${CRON_SECRET}.

export async function GET(req: NextRequest) {
  // Protect: only Vercel Cron or an internal call with the secret may trigger this
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.warn("[AbandonedCart] RESEND_API_KEY not set — skipping");
    return NextResponse.json({ ok: true, sent: 0 });
  }

  // Sessions that are pending, older than 1 hour, haven't received recovery email yet
  const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { data: sessions, error } = await supabase
    .from("cart_sessions")
    .select("session_id, email, name, phone, items, subtotal, updated_at")
    .eq("status", "pending")
    .is("recovery_sent_at", null)
    .not("email", "is", null)
    .lt("updated_at", cutoff)
    .limit(50);

  if (error) {
    console.error("[AbandonedCart] Query error:", error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  if (!sessions?.length) {
    console.log("[AbandonedCart] No sessions to process");
    return NextResponse.json({ ok: true, sent: 0 });
  }

  const resend = new Resend(resendKey);
  let sent = 0;

  for (const session of sessions as AbandonedSession[]) {
    try {
      const { error: emailError } = await resend.emails.send({
        from:    "Lorenzo Ricci <info@lorenzo-ricci.com>",
        to:      session.email,
        subject: "Забравихте нещо в количката си 🛒",
        html:    buildRecoveryEmail(session),
      });

      if (emailError) {
        console.error(`[AbandonedCart] Email failed for ${session.session_id}:`, emailError);
        continue;
      }

      // Mark recovery email as sent
      await supabase
        .from("cart_sessions")
        .update({ recovery_sent_at: new Date().toISOString() })
        .eq("session_id", session.session_id);

      sent++;
      console.log(`[AbandonedCart] Recovery email sent to ${session.email}`);
    } catch (err) {
      console.error(`[AbandonedCart] Unexpected error for session ${session.session_id}:`, err);
    }
  }

  return NextResponse.json({ ok: true, sent });
}
