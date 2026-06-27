import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { supabase } from "@/lib/supabase";

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars (0/O, 1/I)
  let code = "LR-";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function buildPromoEmail(code: string): string {
  return `<!DOCTYPE html>
<html lang="bg">
<head><meta charset="UTF-8"><title>Вашият промо код</title></head>
<body style="margin:0;padding:0;background:#f4f1eb;font-family:Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1eb;padding:40px 0">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;max-width:560px;width:100%">

        <!-- Header -->
        <tr>
          <td style="background:#08091A;padding:32px 40px;text-align:center">
            <p style="margin:0;color:rgba(255,255,255,0.55);font-size:10px;letter-spacing:0.3em;text-transform:uppercase;font-family:Georgia,serif">Lorenzo Ricci</p>
            <div style="margin:12px auto 0;width:32px;height:1px;background:rgba(255,255,255,0.15)"></div>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:48px 48px 0">
            <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.25em;text-transform:uppercase;color:#999">Вашият ексклузивен код</p>
            <p style="margin:0 0 24px;font-family:Georgia,serif;font-size:26px;color:#0a0e1f;line-height:1.3">Добре дошли в Lorenzo Ricci</p>
            <p style="margin:0 0 32px;font-size:14px;color:#666;line-height:1.7">
              Благодарим Ви, че се абонирахте за нашия бюлетин.<br>
              Ето Вашия личен промо код за <strong style="color:#0a0e1f">10% отстъпка</strong> от следващата поръчка:
            </p>

            <!-- Code box -->
            <div style="border:1.5px solid #0a0e1f;padding:24px;text-align:center;margin-bottom:32px">
              <p style="margin:0 0 6px;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#999">Промо код</p>
              <p style="margin:0;font-family:Georgia,serif;font-size:32px;letter-spacing:0.15em;color:#0a0e1f;font-weight:700">${code}</p>
            </div>

            <p style="margin:0 0 12px;font-size:13px;color:#555;line-height:1.7">
              <strong style="color:#0a0e1f">Как да го използвате:</strong><br>
              При поръчка, в количката има поле "Промо код" — въведете кода и ще видите 10% отстъпка автоматично.
            </p>
            <p style="margin:0 0 40px;font-size:12px;color:#999">
              Кодът е еднократен и е личен за Вас.
            </p>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="padding:0 48px 48px;text-align:center">
            <a href="https://lorenzo-ricci.com" style="display:inline-block;background:#0a0e1f;color:#ffffff;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;text-decoration:none;padding:16px 40px">
              Пазарувай сега
            </a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="border-top:1px solid #e8dfc8;padding:28px 48px;text-align:center">
            <p style="margin:0 0 6px;font-family:Georgia,serif;font-size:12px;color:#0a0e1f;letter-spacing:0.08em">LORENZO RICCI</p>
            <p style="margin:0;font-size:11px;color:#aaa;line-height:1.8">
              info@lorenzo-ricci.com &nbsp;·&nbsp;
              <a href="https://lorenzo-ricci.com" style="color:#aaa;text-decoration:none">lorenzo-ricci.com</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json() as { email?: string };
    const clean = (email ?? "").trim().toLowerCase();

    if (!clean || !clean.includes("@")) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    // Check if already subscribed — resend their existing code, don't generate new
    const { data: existing } = await supabase
      .from("newsletter_subscribers")
      .select("promo_code")
      .eq("email", clean)
      .single();

    const code = existing?.promo_code ?? generateCode();

    if (!existing) {
      // New subscriber — save to DB first
      const { error: insertErr } = await supabase
        .from("newsletter_subscribers")
        .insert({ email: clean, promo_code: code, code_used: false });

      if (insertErr) throw insertErr;
      console.log("[Newsletter] New subscriber:", clean, "code:", code);
    } else {
      console.log("[Newsletter] Existing subscriber resend:", clean, "code:", code);
    }

    // Send promo code email
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: "Lorenzo Ricci <info@lorenzo-ricci.com>",
      to: clean,
      subject: "Вашият промо код за 10% отстъпка — Lorenzo Ricci",
      html: buildPromoEmail(code),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Newsletter] Error:", err);
    return NextResponse.json({ error: "Failed to subscribe" }, { status: 500 });
  }
}
