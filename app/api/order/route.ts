import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createHash } from "crypto";

// Order line item shape (used for the wallet-inventory decrement below).
type ItemPayload = { sku?: string; qty?: number; quantity?: number; slug?: string; name?: string; price?: number; currency?: string };

// ─────────────────────────────────────────────────────────────
// Admin notification email (HTML)
// ─────────────────────────────────────────────────────────────
function buildAdminEmail(order: Record<string, unknown>, alertMessage?: string | null): string {
  const customer = (order.customer ?? {}) as Record<string, unknown>;
  const shipping  = (order.shipping  ?? {}) as Record<string, unknown>;

  // Generic manual-processing alert (e.g. the order failed to save to the DB).
  const alertBlock = alertMessage
    ? `<div style="background:#b91c1c;color:#fff;padding:18px 24px;border-radius:6px;margin-bottom:16px">
        <p style="margin:0;font-size:18px;font-weight:700">⚠️ ВНИМАНИЕ — РЪЧНА ОБРАБОТКА</p>
        <p style="margin:8px 0 0;font-size:13px;opacity:.9">${alertMessage}</p>
      </div>`
    : "";

  const items = Array.isArray(order.items)
    ? (order.items as Array<{ name?: string; sku?: string; quantity?: number; qty?: number; price?: number; currency?: string }>)
        .map((i) => `<tr>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb">${i.name ?? "-"}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-family:monospace;font-size:12px;color:#555">${i.sku ?? "-"}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center">${i.quantity ?? i.qty ?? 1}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right">${i.currency ?? "€"}${Number(i.price ?? 0).toFixed(2)}</td>
        </tr>`)
        .join("")
    : `<tr><td colspan="4" style="padding:10px 12px">-</td></tr>`;

  return `<!DOCTYPE html>
<html lang="bg">
<head><meta charset="UTF-8"><title>Нова поръчка</title></head>
<body style="margin:0;padding:24px;font-family:Arial,sans-serif;background:#f9fafb;color:#111">
  <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
    <div style="background:#0a0e1f;padding:24px 32px;text-align:center">
      <img src="https://lorenzo-ricci.com/email-logo.png" alt="Lorenzo Ricci" width="160" style="max-width:160px;height:auto;display:block;margin:0 auto 10px">
      <p style="margin:0;color:rgba(255,255,255,.5);font-size:11px;letter-spacing:.25em;text-transform:uppercase">Нова поръчка</p>
    </div>
    <div style="padding:32px">
      ${alertBlock}

      <h3 style="margin:0 0 16px;font-size:16px;text-transform:uppercase;letter-spacing:.08em;color:#374151">Данни на клиента</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:28px;font-size:14px">
        <tr style="background:#f3f4f6">
          <td style="padding:10px 12px;font-weight:600;width:160px">Имена</td>
          <td style="padding:10px 12px">${customer.name ?? "-"}</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;font-weight:600">Телефон</td>
          <td style="padding:10px 12px"><a href="tel:${customer.phone}" style="color:#0a0e1f;font-weight:600">${customer.phone ?? "-"}</a></td>
        </tr>
        <tr style="background:#f3f4f6">
          <td style="padding:10px 12px;font-weight:600">Имейл</td>
          <td style="padding:10px 12px">${customer.email ?? "-"}</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;font-weight:600">Град</td>
          <td style="padding:10px 12px">${customer.city ?? "-"}</td>
        </tr>
        <tr style="background:#f3f4f6">
          <td style="padding:10px 12px;font-weight:600">Пощенски код</td>
          <td style="padding:10px 12px">${customer.postCode ?? "-"}</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;font-weight:600">Начин на доставка</td>
          <td style="padding:10px 12px">${String(shipping.method ?? customer.shippingMethod ?? "-")}</td>
        </tr>
        <tr style="background:#f3f4f6">
          <td style="padding:10px 12px;font-weight:600">Офис / Адрес</td>
          <td style="padding:10px 12px">${customer.officeAddress ?? "-"}</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;font-weight:600">Бележка</td>
          <td style="padding:10px 12px">${String(customer.notes || "-")}</td>
        </tr>
      </table>

      <h3 style="margin:0 0 16px;font-size:16px;text-transform:uppercase;letter-spacing:.08em;color:#374151">Продукти</h3>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:28px">
        <thead>
          <tr style="background:#0a0e1f;color:#fff">
            <th style="padding:10px 12px;text-align:left">Продукт</th>
            <th style="padding:10px 12px;text-align:left">SKU</th>
            <th style="padding:10px 12px;text-align:center">Бр.</th>
            <th style="padding:10px 12px;text-align:right">Цена</th>
          </tr>
        </thead>
        <tbody>${items}</tbody>
        <tfoot>
          <tr style="background:#f3f4f6;font-weight:700">
            <td colspan="3" style="padding:10px 12px">ОБЩО</td>
            <td style="padding:10px 12px;text-align:right">€${Number(order.total ?? 0).toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>

      <p style="margin:0;font-size:12px;color:#9ca3af">Получено: ${new Date().toLocaleString("bg-BG", { timeZone: "Europe/Sofia" })}</p>
    </div>
  </div>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────
// 3.  Customer confirmation email (luxury HTML)
// ─────────────────────────────────────────────────────────────
function buildCustomerEmail(order: Record<string, unknown>): string {
  const customer  = (order.customer ?? {}) as Record<string, unknown>;
  const shipping  = (order.shipping  ?? {}) as Record<string, unknown>;
  const firstName = String(customer.name ?? "").split(" ")[0];

  const items = Array.isArray(order.items)
    ? (order.items as Array<{ name?: string; quantity?: number; price?: number; currency?: string }>)
        .map(
          (i) =>
            `<tr>
              <td style="padding:12px 0;border-bottom:1px solid #e8dfc8;font-family:'Georgia',serif;color:#1a1a1a;font-size:14px">${i.name ?? "-"}</td>
              <td style="padding:12px 0;border-bottom:1px solid #e8dfc8;text-align:center;color:#555;font-size:14px">×${i.quantity ?? 1}</td>
              <td style="padding:12px 0;border-bottom:1px solid #e8dfc8;text-align:right;font-family:'Georgia',serif;color:#1a1a1a;font-size:14px">${i.currency ?? "€"}${Number(i.price ?? 0).toFixed(2)}</td>
            </tr>`
        )
        .join("")
    : "";

  return `<!DOCTYPE html>
<html lang="bg">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Вашата поръчка от Lorenzo Ricci</title>
</head>
<body style="margin:0;padding:0;background:#f5f0e8;font-family:Arial,sans-serif">

  <!-- Wrapper -->
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
            <td style="padding:40px 40px 0">
              <p style="margin:0 0 6px;font-family:'Georgia',serif;font-size:22px;color:#0a0e1f">Благодарим Ви, ${firstName}!</p>
              <p style="margin:0 0 28px;color:#666;font-size:14px;line-height:1.6">Получихме Вашата поръчка. Наш представител ще се свърже с Вас по телефона за потвърждение. Доставката се извършва чрез куриер в рамките на 1 до 2 работни дни.</p>

              <!-- Divider -->
              <div style="border-top:1px solid #e8dfc8;margin-bottom:28px"></div>

              <!-- Order summary -->
              <p style="margin:0 0 16px;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#888">Вашата поръчка</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tbody>${items}</tbody>
                <tfoot>
                  <tr>
                    <td colspan="2" style="padding:14px 0 0;font-size:12px;letter-spacing:.15em;text-transform:uppercase;color:#888">Сума за плащане при доставка</td>
                    <td style="padding:14px 0 0;text-align:right;font-family:'Georgia',serif;font-size:20px;color:#0a0e1f;font-weight:700">€${Number(order.total ?? 0).toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>

              <!-- Divider -->
              <div style="border-top:1px solid #e8dfc8;margin:28px 0"></div>

              <!-- Delivery info -->
              <p style="margin:0 0 16px;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#888">Доставка</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:#444">
                <tr>
                  <td style="padding:4px 0;width:130px;color:#888">Куриер</td>
                  <td style="padding:4px 0">${String(shipping.method ?? customer.shippingMethod ?? "-")}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0;color:#888">Офис / Адрес</td>
                  <td style="padding:4px 0">${String(customer.officeAddress ?? "-")}</td>
                </tr>
              </table>

              <!-- Divider -->
              <div style="border-top:1px solid #e8dfc8;margin:28px 0"></div>

              <!-- Guarantees -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:0 8px;font-size:12px;color:#666;line-height:1.5">
                    <p style="margin:0 0 4px;font-size:18px">🛡</p>
                    <strong style="display:block;color:#0a0e1f;font-size:11px;letter-spacing:.1em;text-transform:uppercase">Гаранция</strong>
                    <span style="font-size:12px">Доживотна за бижута · 2г. за часовници</span>
                  </td>
                  <td align="center" style="padding:0 8px;font-size:12px;color:#666;line-height:1.5">
                    <p style="margin:0 0 4px;font-size:18px">📦</p>
                    <strong style="display:block;color:#0a0e1f;font-size:11px;letter-spacing:.1em;text-transform:uppercase">Доставка</strong>
                    <span style="font-size:12px">До 2 работни дни · Преглед преди плащане</span>
                  </td>
                  <td align="center" style="padding:0 8px;font-size:12px;color:#666;line-height:1.5">
                    <p style="margin:0 0 4px;font-size:18px">🔄</p>
                    <strong style="display:block;color:#0a0e1f;font-size:11px;letter-spacing:.1em;text-transform:uppercase">Връщане</strong>
                    <span style="font-size:12px">30 дни лесна замяна</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:32px 40px 40px;text-align:center">
              <div style="border-top:1px solid #e8dfc8;padding-top:28px">
                <p style="margin:0 0 6px;font-family:'Georgia',serif;font-size:13px;color:#0a0e1f;letter-spacing:.08em">LORENZO RICCI</p>
                <p style="margin:0;font-size:11px;color:#aaa;line-height:1.8">
                  info@lorenzo-ricci.com<br>
                  <a href="https://lorenzo-ricci.com" style="color:#aaa;text-decoration:none">lorenzo-ricci.com</a>
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

// ─────────────────────────────────────────────────────────────
// 4.  Resend email helpers
// ─────────────────────────────────────────────────────────────
function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn("[Resend] RESEND_API_KEY not set — skipping email");
    return null;
  }
  return new Resend(key);
}

// Order-notification recipients. protataotos@gmail.com is an EXTRA recipient
// added ONLY through the end of 20 July 2026 in Bulgarian time — from 21 July it
// drops off automatically, no manual edit needed. (Europe/Sofia is UTC+3 in
// July, so "end of 20 July" = 21 July 00:00:00 +03:00.) The other three
// recipients are always included. To extend/shorten later, change the date in
// TEMP_RECIPIENT_UNTIL below (keep the +03:00 offset so it's Bulgarian time).
const ADMIN_RECIPIENTS = ["info@lorenzo-ricci.com", "sodolos3@gmail.com", "pavelserbezov03@gmail.com"];
const TEMP_RECIPIENT = "protataotos@gmail.com";
const TEMP_RECIPIENT_UNTIL = Date.parse("2026-07-21T00:00:00+03:00"); // = end of 20 Jul 2026, Sofia

function adminRecipients(): string[] {
  return Date.now() < TEMP_RECIPIENT_UNTIL
    ? [...ADMIN_RECIPIENTS, TEMP_RECIPIENT]
    : ADMIN_RECIPIENTS;
}

async function sendAdminEmail(subject: string, html: string): Promise<void> {
  const resend = getResend();
  if (!resend) return;
  const { error } = await resend.emails.send({
    from:    "Lorenzo Ricci Orders <orders@lorenzo-ricci.com>",
    to:      adminRecipients(),
    subject,
    html,
  });
  if (error) {
    console.error("[Resend] Admin email failed:", error);
    throw new Error(String(error));
  }
  console.log("[Resend] Admin email sent");
}

async function sendCustomerEmail(to: string, html: string): Promise<void> {
  const resend = getResend();
  if (!resend) return;
  const { error } = await resend.emails.send({
    from:    "Lorenzo Ricci <info@lorenzo-ricci.com>",
    to,
    subject: "Вашата поръчка е получена - Lorenzo Ricci",
    html,
  });
  if (error) {
    console.error("[Resend] Customer email failed:", error);
    throw new Error(String(error));
  }
  console.log("[Resend] Customer email sent to:", to);
}

// ─────────────────────────────────────────────────────────────
// 5.  Meta Conversions API (server-side Purchase event)
// ─────────────────────────────────────────────────────────────
const META_PIXEL_ID = "661480326560209";

function sha256(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

type CapiContext = {
  ip?:        string;
  userAgent?: string;
  fbc?:       string;
  fbp?:       string;
};

async function sendCapiPurchase(
  order: Record<string, unknown>,
  orderRef: string,
  total: number,
  ctx: CapiContext = {}
): Promise<void> {
  const token = process.env.META_CAPI_ACCESS_TOKEN;
  if (!token) {
    console.warn("[CAPI] META_CAPI_ACCESS_TOKEN not set — skipping");
    return;
  }

  const customer = (order.customer ?? {}) as Record<string, unknown>;
  const items    = (order.items    ?? []) as Array<{ sku?: string; quantity?: number }>;

  const nameParts = String(customer.name ?? "").trim().split(" ");
  const firstName = nameParts[0] ?? "";
  const lastName  = nameParts.slice(1).join(" ");

  const userData: Record<string, unknown> = { country: ["bg"] };
  const email = String(customer.email ?? "").trim();
  const phone = String(customer.phone ?? "").replace(/\D/g, "");
  if (email)     userData.em = [sha256(email)];
  if (phone)     userData.ph = [sha256(phone)];
  if (firstName) userData.fn = [sha256(firstName.toLowerCase())];
  if (lastName)  userData.ln = [sha256(lastName.toLowerCase())];

  // Enhanced matching parameters
  if (ctx.ip)        userData.client_ip_address = ctx.ip;
  if (ctx.userAgent) userData.client_user_agent = ctx.userAgent;
  if (ctx.fbc)       userData.fbc = ctx.fbc;
  if (ctx.fbp)       userData.fbp = ctx.fbp;

  // City + zipcode (hashed per Meta spec)
  const city = String(customer.city     ?? "").trim().toLowerCase().replace(/\s+/g, "");
  const zip  = String(customer.postCode ?? "").trim().replace(/\s+/g, "").toLowerCase();
  if (city) userData.ct = [sha256(city)];
  if (zip)  userData.zp = [sha256(zip)];

  const payload = {
    data: [{
      event_name:       "Purchase",
      event_time:       Math.floor(Date.now() / 1000),
      event_id:         orderRef,            // deduplicates with browser pixel eventID
      event_source_url: "https://lorenzo-ricci.com",
      action_source:    "website",
      user_data:        userData,
      custom_data: {
        value:        total,
        currency:     "EUR",
        content_ids:  items.map((i) => i.sku ?? "").filter(Boolean),
        content_type: "product",
        order_id:     orderRef,
      },
    }],
    access_token: token,
  };

  const res = await fetch(
    `https://graph.facebook.com/v18.0/${META_PIXEL_ID}/events`,
    {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
      signal:  AbortSignal.timeout(5000),
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`CAPI ${res.status}: ${text.slice(0, 200)}`);
  }

  const result = await res.json();
  console.log("[CAPI] Purchase sent:", JSON.stringify(result));
}

// ─────────────────────────────────────────────────────────────
// POST /api/order
// ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    // Extract matching context before body is consumed
    const capiCtx: CapiContext = {
      ip:        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
                 ?? req.headers.get("x-real-ip")
                 ?? undefined,
      userAgent: req.headers.get("user-agent") ?? undefined,
      fbc:       req.cookies.get("_fbc")?.value ?? undefined,
      fbp:       req.cookies.get("_fbp")?.value ?? undefined,
    };

    const order    = await req.json() as Record<string, unknown>;
    const customer = (order.customer ?? {}) as Record<string, unknown>;
    const customerAddress = String(customer.email ?? "").trim();
    const customerName    = String(customer.name  ?? "");

    // Send emails and await them — without await they are killed by Vercel before sending
    const subject = `✅ Нова поръчка - ${customerName}`;

    await Promise.allSettled([
      sendAdminEmail(subject, buildAdminEmail(order)),
      ...(customerAddress
        ? [sendCustomerEmail(customerAddress, buildCustomerEmail(order))]
        : []),
      sendCapiPurchase(order, String(order.orderRef ?? ""), Number(order.total ?? 0), capiCtx),
    ]);

    // 3. Save to Supabase. If this fails the order is NOT in the admin panel —
    //    the customer already saw success, so make failure LOUD (alert email)
    //    instead of silently swallowing it.
    try {
      const shipping = (order.shipping ?? {}) as Record<string, unknown>;
      const { error: dbError } = await supabase.from("orders").insert({
        order_ref:               String(order.orderRef ?? ""),
        name:                    String(customer.name          ?? ""),
        phone:                   String(customer.phone         ?? ""),
        email:                   String(customer.email         ?? "") || null,
        city:                    String(customer.city          ?? ""),
        post_code:               String(customer.postCode      ?? ""),
        address:                 String(customer.officeAddress ?? ""),
        shipping_method:         String(customer.shippingMethod ?? ""),
        courier:                 String(customer.courier       ?? ""),
        items:                   order.items ?? [],
        subtotal:                Number(order.subtotal         ?? 0),
        shipping_cost:           Number(shipping.cost          ?? 0),
        total:                   Number(order.total            ?? 0),
        sms_marketing_consent:   Boolean(customer.smsMarketingConsent),
        email_marketing_consent: Boolean(customer.emailMarketingConsent),
        notes:                   String(customer.notes         ?? "") || null,
      });
      if (dbError) throw dbError;
      console.log("[Supabase] Order saved");
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.error("[Supabase] Failed to save order:", reason);
      // Order won't appear in the panel — send a distinct alert so it isn't lost.
      await sendAdminEmail(
        `🚨 [НЕ Е ЗАПИСАНА В ПАНЕЛА] ${customerName} — ${String(order.orderRef ?? "")}`,
        buildAdminEmail(order, `Поръчката НЕ се записа в базата (${reason}). Добави я РЪЧНО в панела.`),
      ).catch((e) => console.error("[Supabase] alert email also failed:", e));
    }

    // 4. Mark cart session as converted (best-effort). Uses the service key —
    //    anon can't UPDATE cart_sessions under RLS, so this silently no-op'd
    //    before and recovery emails kept going out after a purchase.
    const sessionId = order.sessionId as string | undefined;
    if (sessionId) {
      try {
        await supabaseAdmin()
          .from("cart_sessions")
          .update({ status: "converted", converted_at: new Date().toISOString() })
          .eq("session_id", sessionId)
          .eq("status", "pending");
      } catch { /* ignore */ }
    }

    // 5. Mark promo code as used — atomic (best-effort)
    const promoCode = order.promoCode as string | undefined;
    if (promoCode) {
      try {
        const { data: redeemed } = await supabase
          .rpc("promo_mark_used", { p_code: promoCode });
        if (redeemed) console.log("[Promo] Code redeemed");
        else console.warn("[Promo] Code already used or not found");
      } catch (err) {
        console.error("[Promo] Failed to redeem code:", err);
      }
    }

    // 6. Decrement wallet/cardholder inventory (best-effort, per-unit quantity)
    const walletItems = (order.items as ItemPayload[] ?? [])
      .filter((i) => {
        const s = String(i.slug ?? "");
        return s.startsWith("wallet-") || s.startsWith("cardholder-");
      });

    for (const item of walletItems) {
      const slug = String(item.slug);
      const qty  = Math.max(1, Number(item.quantity ?? item.qty ?? 1));
      for (let j = 0; j < qty; j++) {
        try {
          const { data: newStock, error: rpcError } = await supabase.rpc(
            "decrement_wallet_stock",
            { p_slug: slug }
          );
          if (rpcError) console.error(`[Inventory] Error decrementing ${slug}:`, rpcError);
          else console.log(`[Inventory] ${slug} unit ${j + 1}/${qty} → stock now ${newStock}`);
        } catch (err) {
          console.error(`[Inventory] Failed to decrement ${slug}:`, err);
        }
      }
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Order error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
