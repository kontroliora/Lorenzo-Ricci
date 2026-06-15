import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

// ─────────────────────────────────────────────────────────────
// 0.  BigArena fulfillment integration
// ─────────────────────────────────────────────────────────────

type OrderPayload = Record<string, unknown>;
type ItemPayload  = { sku?: string; qty?: number; quantity?: number };

function buildBigArenaBody(order: OrderPayload): Record<string, unknown> {
  const customer = (order.customer ?? {}) as Record<string, unknown>;
  const items    = (order.items    ?? []) as ItemPayload[];
  const shipping = (order.shipping ?? {}) as Record<string, unknown>;

  // Map checkout couriers → BigArena courier codes
  const raw       = String(shipping.courier ?? "econt");
  const isHome    = raw === "home";
  const courier   = isHome ? "econt" : raw;                         // default home → econt
  const service   = isHome ? "econt_door" : `${courier}_office`;   // office vs door

  return {
    client_order_id:              `LR-${Date.now()}`,
    api_order_id:                 String(order.orderRef ?? `LR-${Date.now()}`),
    status:                       1,
    customer_name:                String(customer.name     ?? ""),
    customer_telephone:           String(customer.phone    ?? ""),
    country_code:                 "BG",
    shipping_address: {
      address_text:               String(customer.officeAddress ?? ""),
      city:                       String(customer.city          ?? ""),
      post_code:                  String(customer.postCode      ?? ""),
    },
    products: items.map((i) => ({
      sku:      String(i.sku      ?? ""),
      quantity: Number(i.qty ?? i.quantity ?? 1),
    })),
    courier,
    courier_service:              service,
    payment_method:               "cod",
    payment_amount:               String(Number(order.total ?? 0).toFixed(2)),
    order_payment_amount:         String(Number(order.total ?? 0).toFixed(2)),
    original_order_payment_amount: String(Number(order.total ?? 0).toFixed(2)),
    currency_code:                "EUR",
    note_customer:                String(customer.notes    ?? ""),
    original_order_payment_method: "cod",
  };
}

async function sendToBigArena(order: OrderPayload): Promise<void> {
  const rawKey = process.env.BIGARENA_API_KEY;
  if (!rawKey) {
    console.warn("[BigArena] BIGARENA_API_KEY not set — skipping fulfillment");
    return;
  }

  const apiKey = rawKey.trim();
  console.log(
    `[BigArena] API key length: ${apiKey.length}` +
    (apiKey.length !== rawKey.length ? ` (trimmed ${rawKey.length - apiKey.length} whitespace chars)` : "")
  );

  const body = buildBigArenaBody(order);

  const res = await fetch("https://my.bigarena.net/api/v1/orders", {
    method:  "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type":  "application/json",
      "Accept":        "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "(no body)");
    console.error(`[BigArena] API error ${res.status}:`, text);
    throw new Error(`BigArena ${res.status}: ${text.slice(0, 200)}`);
  }

  const result = await res.json();
  console.log("[BigArena] Order created →", result);
}

// ─────────────────────────────────────────────────────────────
// 1.  Blacklist check - nekorekten.com
// ─────────────────────────────────────────────────────────────
interface BlacklistResult {
  found: boolean;
  label: string;   // short human-readable verdict
  details: string; // extra context scraped from the page (empty if clean)
}

async function checkBlacklist(phone: string): Promise<BlacklistResult> {
  const clean = phone.replace(/\D/g, ""); // strip non-digits
  const url = `https://nekorekten.com/?s=${encodeURIComponent(clean)}`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; Lorenzo-Ricci-Bot/1.0)",
        Accept: "text/html",
      },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      return { found: false, label: "CHECK FAILED", details: `HTTP ${res.status}` };
    }

    const html = await res.text();

    // nekorekten.com shows "Няма намерени резултати" when clean
    const notFound =
      html.includes("Няма намерени резултати") ||
      html.includes("No results found") ||
      html.includes("no results");

    if (notFound) {
      return { found: false, label: "CLEAN", details: "" };
    }

    // Try to extract a snippet of the listing title from the HTML
    const titleMatch = html.match(/<h2[^>]*class="[^"]*entry-title[^"]*"[^>]*>([\s\S]*?)<\/h2>/i);
    const snippet = titleMatch
      ? titleMatch[1].replace(/<[^>]+>/g, "").trim().slice(0, 200)
      : "Found in database";

    return { found: true, label: "FOUND IN BLACKLIST", details: snippet };
  } catch (err) {
    console.error("Blacklist check error:", err);
    return { found: false, label: "CHECK ERROR", details: String(err) };
  }
}

// ─────────────────────────────────────────────────────────────
// 2.  Admin notification email (HTML)
// ─────────────────────────────────────────────────────────────
function buildAdminEmail(order: Record<string, unknown>, bl: BlacklistResult): string {
  const customer = (order.customer ?? {}) as Record<string, unknown>;
  const shipping  = (order.shipping  ?? {}) as Record<string, unknown>;

  const safeBlock = bl.found
    ? `<div style="background:#ff1a1a;color:#fff;padding:18px 24px;border-radius:6px;margin-bottom:28px">
        <p style="margin:0;font-size:20px;font-weight:700">🚨 DANGER - КЛИЕНТЪТ Е В БЛЕКЛИСТА!</p>
        <p style="margin:8px 0 0;font-size:14px">Намерен на nekorekten.com · Помисли два пъти преди изпращане.</p>
        ${bl.details ? `<p style="margin:8px 0 0;font-size:13px;opacity:.85">${bl.details}</p>` : ""}
      </div>`
    : `<div style="background:#16a34a;color:#fff;padding:18px 24px;border-radius:6px;margin-bottom:28px">
        <p style="margin:0;font-size:20px;font-weight:700">✅ SAFE - Не е намерен в блеклиста</p>
        <p style="margin:8px 0 0;font-size:14px">nekorekten.com: ${bl.label}</p>
      </div>`;

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
      ${safeBlock}

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
              <p style="margin:0 0 28px;color:#666;font-size:14px;line-height:1.6">Получихме Вашата поръчка. Ще се свържем с Вас по телефона за потвърждение.<br>Всички пратки се доставят чрез куриер в рамките на 1 до 2 работни дни. (Поръчки, направени след 14:00 ч., се обработват и изпращат на следващия работен ден).</p>

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
// 4.  Zoho SMTP helpers
// ─────────────────────────────────────────────────────────────
async function sendAdminEmailViaZoho(subject: string, html: string): Promise<void> {
  const user = process.env.ZOHO_EMAIL;
  const pass = process.env.ZOHO_PASSWORD;

  if (!user || !pass) {
    console.warn("[Zoho] ZOHO_EMAIL or ZOHO_PASSWORD not set — skipping admin email");
    return;
  }

  const transport = nodemailer.createTransport({
    host:   "smtp.zoho.eu",
    port:   465,
    secure: true,
    auth:   { user, pass },
  });

  try {
    await transport.sendMail({
      from:    `"Lorenzo Ricci Orders" <${user}>`,
      to:      ["info@lorenzo-ricci.com", "sodolos3@gmail.com"],
      subject,
      html,
    });
    console.log("[Zoho] Admin email sent successfully");
  } catch (err) {
    console.error("[Zoho] Admin email failed:", err);
    throw err;
  }
}

async function sendCustomerEmailViaZoho(to: string, html: string): Promise<void> {
  const user = process.env.ZOHO_EMAIL;
  const pass = process.env.ZOHO_PASSWORD;

  if (!user || !pass) {
    console.warn("[Zoho] ZOHO_EMAIL or ZOHO_PASSWORD not set — skipping customer email");
    return;
  }

  const transport = nodemailer.createTransport({
    host:   "smtp.zoho.eu",
    port:   465,
    secure: true,
    auth:   { user, pass },
  });

  try {
    await transport.sendMail({
      from:    `"Lorenzo Ricci" <${user}>`,
      to,
      subject: "Вашата поръчка е получена - Lorenzo Ricci",
      html,
    });
    console.log("[Zoho] Customer email sent to:", to);
  } catch (err) {
    console.error("[Zoho] Customer email failed:", err);
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────
// POST /api/order
// ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const order = await req.json() as Record<string, unknown>;
    const customer = (order.customer ?? {}) as Record<string, unknown>;

    // 1. Submit to BigArena — awaited so a non-2xx response returns 500 to the frontend
    await sendToBigArena(order);

    // 2. Blacklist check + emails fire concurrently after BigArena succeeds (best-effort)
    const customerAddress = String(customer.email ?? "").trim();
    const customerName    = String(customer.name  ?? "");

    Promise.allSettled([
      (async () => {
        const bl = await checkBlacklist(String(customer.phone ?? ""));
        await sendAdminEmailViaZoho(
          bl.found
            ? `🚨 [BLACKLIST] Нова поръчка - ${customerName}`
            : `✅ Нова поръчка - ${customerName}`,
          buildAdminEmail(order, bl),
        );
      })(),
      ...(customerAddress
        ? [sendCustomerEmailViaZoho(customerAddress, buildCustomerEmail(order))]
        : []),
    ]);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Order error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
