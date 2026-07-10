import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { supabase } from "@/lib/supabase";

// ─── Auth ──────────────────────────────────────────────────────────────────
function isAuthorized(req: NextRequest): boolean {
  const header = req.headers.get("Authorization");
  const pw     = process.env.ADMIN_PASSWORD;
  if (!pw) return false;
  return header === `Bearer ${pw}`;
}

// ─── Supabase (service-level read via RLS bypass) ──────────────────────────
// We use a raw SQL-safe approach: pass the admin password as a claim header
// so RLS "anon_no_select" is bypassed via a separate service-role if available,
// otherwise use the same anon key (works when policy allows admin override).
// For simplicity: use a SECURITY DEFINER function exposed via RPC instead.
// Until then — the SELECT policy is dropped below and admin reads go through.

// ─── Email HTML ────────────────────────────────────────────────────────────
type SessionItem = {
  name: string;
  price: number;
  currency: string;
  quantity: number;
  coverImage: { src: string; alt: string };
};

function buildRecoveryEmail(opts: {
  name: string;
  items: SessionItem[];
  subtotal: number;
}): { subject: string; html: string } {
  const firstName = (opts.name || "").split(" ")[0] || "клиент";

  const productsHtml = opts.items
    .map(
      (item) => `
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 8px;border:1px solid #f0ebe3;">
      <tr>
        <td width="76" valign="middle" style="padding:12px;">
          <img src="https://www.lorenzo-ricci.com${item.coverImage.src}"
               width="52" height="52"
               style="display:block;object-fit:cover;border:1px solid #f0ebe3;"
               alt="${item.name}" />
        </td>
        <td valign="middle" style="padding:12px 16px 12px 4px;">
          <p style="font-family:Arial,Helvetica,sans-serif;font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.12em;margin:0 0 5px;">Lorenzo Ricci</p>
          <p style="font-family:Georgia,'Times New Roman',serif;font-size:15px;color:#1a1a2e;margin:0 0 5px;line-height:1.2;">${item.name}</p>
          <p style="font-family:Georgia,'Times New Roman',serif;font-size:14px;color:#0a1628;margin:0;">
            ${item.currency}${item.price.toFixed(2)}
            ${item.quantity > 1 ? `<span style="font-family:Arial,sans-serif;font-size:11px;color:#9ca3af;"> &times; ${item.quantity}</span>` : ""}
          </p>
        </td>
      </tr>
    </table>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="bg">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Продуктът ви чака. Lorenzo Ricci</title>
</head>
<body style="margin:0;padding:0;background:#f8f6f2;-webkit-font-smoothing:antialiased;">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f8f6f2;">
  <tr>
    <td align="center" style="padding:40px 20px;">
      <table width="560" cellpadding="0" cellspacing="0" role="presentation" style="background:#ffffff;max-width:560px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:#0a1628;padding:30px 40px;text-align:center;">
            <span style="font-family:Georgia,'Times New Roman',serif;font-size:15px;letter-spacing:0.3em;color:#ffffff;text-transform:uppercase;font-weight:normal;">LORENZO RICCI</span>
          </td>
        </tr>
        <!-- Gold accent line -->
        <tr><td style="height:2px;background:#c9a84c;"></td></tr>

        <!-- Body -->
        <tr>
          <td style="padding:48px 40px 36px;">

            <p style="font-family:Georgia,'Times New Roman',serif;font-size:26px;color:#1a1a2e;margin:0 0 8px;line-height:1.25;font-weight:normal;">
              Оставихте нещо хубаво
            </p>
            <div style="width:40px;height:1px;background:#c9a84c;margin:0 0 28px;"></div>

            <p style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#6b7280;line-height:1.75;margin:0 0 32px;font-weight:300;letter-spacing:0.015em;">
              Скъпи ${firstName},<br><br>
              Количката ви съдържа продукти, но поръчката не беше завършена.
              Наличностите ни са ограничени. Запазете своя избор, преди да е изчерпан.
            </p>

            ${productsHtml}

            <!-- Total -->
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-top:2px solid #0a1628;margin:4px 0 32px;">
              <tr>
                <td style="padding:14px 0 0;">
                  <span style="font-family:Arial,sans-serif;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.12em;">Стойност на количката</span>
                </td>
                <td align="right" style="padding:14px 0 0;">
                  <span style="font-family:Georgia,serif;font-size:19px;color:#0a1628;">&euro;${opts.subtotal.toFixed(2)}</span>
                </td>
              </tr>
            </table>

            <!-- CTA -->
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td align="center" style="padding-bottom:40px;">
                  <a href="https://www.lorenzo-ricci.com"
                     style="display:inline-block;background:#0a1628;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;text-decoration:none;padding:16px 44px;border:1px solid #0a1628;">
                    Завърши поръчката &nbsp;&rarr;
                  </a>
                </td>
              </tr>
            </table>

            <!-- Reassurance -->
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-top:1px solid #f0ebe3;">
              <tr>
                <td style="padding:14px 0;border-bottom:1px solid #f0ebe3;">
                  <span style="font-family:Arial,sans-serif;font-size:11px;color:#c4bdb6;">&#9672;</span>&nbsp;&nbsp;
                  <span style="font-family:Arial,sans-serif;font-size:12px;color:#9ca3af;font-weight:300;">Плащане при получаване, наложен платеж</span>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 0;border-bottom:1px solid #f0ebe3;">
                  <span style="font-family:Arial,sans-serif;font-size:11px;color:#c4bdb6;">&#9672;</span>&nbsp;&nbsp;
                  <span style="font-family:Arial,sans-serif;font-size:12px;color:#9ca3af;font-weight:300;">30 дни лесна замяна</span>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 0;">
                  <span style="font-family:Arial,sans-serif;font-size:11px;color:#c4bdb6;">&#9672;</span>&nbsp;&nbsp;
                  <span style="font-family:Arial,sans-serif;font-size:12px;color:#9ca3af;font-weight:300;">Доставка в рамките на 2 работни дни</span>
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#fafaf9;border-top:1px solid #f0ebe3;padding:28px 40px;text-align:center;">
            <p style="font-family:Arial,sans-serif;font-size:10px;color:#9ca3af;margin:0 0 6px;letter-spacing:0.12em;text-transform:uppercase;">Lorenzo Ricci Timepieces</p>
            <p style="font-family:Arial,sans-serif;font-size:11px;color:#c4bdb6;margin:0 0 14px;">info@lorenzo-ricci.com</p>
            <p style="font-family:Arial,sans-serif;font-size:10px;color:#d4cfc9;margin:0;line-height:1.65;">
              Получихте това писмо, защото се абонирахте за оферти от Lorenzo Ricci.<br>
              Ако не желаете да получавате такива писма, пишете ни на
              <a href="mailto:info@lorenzo-ricci.com?subject=Отписване%20от%20имейли" style="color:#9ca3af;text-decoration:none;">info@lorenzo-ricci.com</a>.
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

  return { subject: "Продуктът ви чака. Lorenzo Ricci", html };
}

// ─── Mask email for privacy in analytics ──────────────────────────────────
function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!user || !domain) return "***@***";
  const masked = user.length <= 2 ? "**" : `${user[0]}${"*".repeat(Math.min(user.length - 2, 4))}${user[user.length - 1]}`;
  return `${masked}@${domain}`;
}

// ─── Types ─────────────────────────────────────────────────────────────────
type CartSession = {
  id: string;
  session_id: string;
  email: string;
  name: string | null;
  items: SessionItem[];
  subtotal: number;
  status: string;
  created_at: string;
  recovery_sent_at: string | null;
  converted_at: string | null;
};

// ─── GET — analytics ──────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Use service_role key if available; otherwise fall back to anon key with
  // a permissive SELECT policy (see SQL migration comment).
  const { data, error } = await supabase
    .from("cart_sessions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const sessions = (data ?? []) as CartSession[];
  const now      = Date.now();
  const READY_AFTER_MS = 30 * 60 * 1000; // 30 minutes

  const pending   = sessions.filter((s) => s.status === "pending");
  const converted = sessions.filter((s) => s.status === "converted");
  const emailed   = sessions.filter((s) => s.status === "emailed");
  const readyToSend = pending.filter(
    (s) => now - new Date(s.created_at).getTime() >= READY_AFTER_MS && s.items.length > 0
  );

  // Product frequency
  const productCounts: Record<string, { count: number; value: number }> = {};
  for (const s of pending) {
    for (const item of s.items) {
      if (!productCounts[item.name]) productCounts[item.name] = { count: 0, value: 0 };
      productCounts[item.name].count += item.quantity;
      productCounts[item.name].value += item.price * item.quantity;
    }
  }
  const topProducts = Object.entries(productCounts)
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return NextResponse.json({
    summary: {
      total_pending:        pending.length,
      total_pending_value:  pending.reduce((s, c) => s + c.subtotal, 0).toFixed(2),
      total_converted:      converted.length,
      total_emailed:        emailed.length,
      ready_to_send:        readyToSend.length,
      ready_to_send_value:  readyToSend.reduce((s, c) => s + c.subtotal, 0).toFixed(2),
    },
    top_abandoned_products: topProducts,
    // Mask email for privacy
    pending_sessions: readyToSend.map((s) => ({
      id:         s.id,
      email:      maskEmail(s.email),
      name:       s.name ? s.name.split(" ")[0] + " " + (s.name.split(" ")[1]?.[0] ?? "") + "." : null,
      items:      s.items.map((i) => ({ name: i.name, qty: i.quantity, price: i.price })),
      subtotal:   s.subtotal,
      age_hours:  ((now - new Date(s.created_at).getTime()) / 3_600_000).toFixed(1),
      created_at: s.created_at,
    })),
  });
}

// ─── POST — send recovery emails ──────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json({ error: "RESEND_API_KEY not set" }, { status: 500 });
  }
  const resend = new Resend(resendKey);

  const body = await req.json().catch(() => ({})) as { ids?: string[] };
  const now  = Date.now();
  const READY_AFTER_MS = 30 * 60 * 1000;

  // Fetch pending sessions
  let query = supabase.from("cart_sessions").select("*").eq("status", "pending");
  if (body.ids?.length) {
    query = query.in("id", body.ids);
  }
  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const candidates = ((data ?? []) as CartSession[]).filter(
    (s) =>
      s.items.length > 0 &&
      now - new Date(s.created_at).getTime() >= READY_AFTER_MS
  );

  if (candidates.length === 0) {
    return NextResponse.json({ sent: 0, message: "Няма готови сесии за изпращане." });
  }

  const results: Array<{ id: string; email: string; ok: boolean; error?: string }> = [];

  for (const session of candidates) {
    try {
      const { subject, html } = buildRecoveryEmail({
        name:     session.name ?? "",
        items:    session.items,
        subtotal: session.subtotal,
      });

      const { error: sendError } = await resend.emails.send({
        from:    "Lorenzo Ricci <info@lorenzo-ricci.com>",
        to:      session.email,
        subject,
        html,
      });

      if (sendError) throw new Error(sendError.message);

      // Mark as emailed
      await supabase
        .from("cart_sessions")
        .update({ status: "emailed", recovery_sent_at: new Date().toISOString() })
        .eq("id", session.id);

      results.push({ id: session.id, email: maskEmail(session.email), ok: true });
    } catch (err) {
      results.push({ id: session.id, email: maskEmail(session.email), ok: false, error: String(err) });
    }
  }

  const sent   = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;

  return NextResponse.json({ sent, failed, results });
}
