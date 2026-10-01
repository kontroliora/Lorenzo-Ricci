import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createHash } from "crypto";
import { getProductBySlug } from "@/lib/products";
import { getPriceOverrides, applyOverride } from "@/lib/price-overrides";
import { validateOrderPricing } from "@/lib/order-pricing";
import { checkOrderable } from "@/lib/order-availability";
import { checkPromoCode } from "@/lib/promo";
import { reserveWithGifts, giftNotes, giftDisplayName, shortModelName, type GiftLine, type GiftReservation, type MissedGift, type ReserveFn, type Shortfall } from "@/lib/gifts";

// Order line item shape.
type ItemPayload = { sku?: string; qty?: number; quantity?: number; slug?: string; name?: string; price?: number; currency?: string };

// A gift line shows "Подарък" where a price would be (it is stored at 0).
const priceCell = (i: { gift?: boolean; currency?: string; price?: number }): string =>
  i.gift ? "Подарък" : `${i.currency ?? "€"}${Number(i.price ?? 0).toFixed(2)}`;

// Extra lines under the items when the customer's gift changed (swapped / sold out).
const giftNotesHtml = (order: Record<string, unknown>, style: string): string => {
  const notes = Array.isArray(order.giftNotes) ? (order.giftNotes as string[]) : [];
  return notes.length ? `<p style="${style}">${notes.join("<br>")}</p>` : "";
};

const qtyOf = (i: ItemPayload) => Math.max(1, Number(i.quantity ?? i.qty ?? 1));

// Customer-facing message when an order can't be fully stocked.
function stockErrorMessage(items: { name: string; available: number }[]): string {
  // Phrased so the adjective agrees with "брой/броя" (masculine), never the
  // product name - otherwise gender would be wrong (колие→изчерпанО, гривна→изчерпанА).
  const parts = items.map((s) =>
    s.available <= 0
      ? `За ${s.name} вече няма наличност`
      : `От ${s.name} е наличен само ${s.available} ${s.available === 1 ? "брой" : "броя"}`
  );
  return `${parts.join(". ")}. Моля, коригирайте количеството в количката.`;
}

// ─────────────────────────────────────────────────────────────
// Admin notification email (HTML)
// ─────────────────────────────────────────────────────────────
function buildAdminEmail(order: Record<string, unknown>, alertMessage?: string | null): string {
  const customer = (order.customer ?? {}) as Record<string, unknown>;
  const shipping  = (order.shipping  ?? {}) as Record<string, unknown>;

  // Generic manual-processing alert (e.g. the order failed to save to the DB).
  const alertBlock = alertMessage
    ? `<div style="background:#b91c1c;color:#fff;padding:18px 24px;border-radius:6px;margin-bottom:16px">
        <p style="margin:0;font-size:18px;font-weight:700">⚠️ ВНИМАНИЕ - РЪЧНА ОБРАБОТКА</p>
        <p style="margin:8px 0 0;font-size:13px;opacity:.9">${alertMessage}</p>
      </div>`
    : "";

  const items = Array.isArray(order.items)
    ? (order.items as Array<{ name?: string; sku?: string; quantity?: number; qty?: number; price?: number; currency?: string; gift?: boolean }>)
        .map((i) => `<tr${i.gift ? ' style="background:#ecfdf5"' : ""}>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb${i.gift ? ";color:#047857;font-weight:600" : ""}">${i.name ?? "-"}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-family:monospace;font-size:12px;color:#555">${i.sku ?? "-"}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center">${i.quantity ?? i.qty ?? 1}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right${i.gift ? ";color:#047857;font-weight:600" : ""}">${priceCell(i)}</td>
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

      ${giftNotesHtml(order, "margin:0 0 20px;padding:12px 14px;background:#fffbeb;border:1px solid #fcd34d;border-radius:6px;font-size:13px;color:#92400e")}

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
    ? (order.items as Array<{ name?: string; quantity?: number; price?: number; currency?: string; gift?: boolean }>)
        .map(
          (i) =>
            `<tr>
              <td style="padding:12px 0;border-bottom:1px solid #e8dfc8;font-family:'Georgia',serif;color:${i.gift ? "#047857" : "#1a1a1a"};font-size:14px">${i.name ?? "-"}</td>
              <td style="padding:12px 0;border-bottom:1px solid #e8dfc8;text-align:center;color:#555;font-size:14px">×${i.quantity ?? 1}</td>
              <td style="padding:12px 0;border-bottom:1px solid #e8dfc8;text-align:right;font-family:'Georgia',serif;color:${i.gift ? "#047857" : "#1a1a1a"};font-size:14px">${priceCell(i)}</td>
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
              ${giftNotesHtml(order, "margin:18px 0 0;font-size:13px;line-height:1.6;color:#7a5c1e")}

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
                    <span style="font-size:12px">Доживотна за бижута · 5 г. търговска за часовници</span>
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
    console.warn("[Resend] RESEND_API_KEY not set - skipping email");
    return null;
  }
  return new Resend(key);
}

// Order-notification recipients. These three, and only these three.
const ADMIN_RECIPIENTS = ["info@lorenzo-ricci.com", "sodolos3@gmail.com", "pavelserbezov03@gmail.com"];

function adminRecipients(): string[] {
  return ADMIN_RECIPIENTS;
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
    console.warn("[CAPI] META_CAPI_ACCESS_TOKEN not set - skipping");
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

    // ── PRICE GUARD - the browser reports unit prices and totals; check them against
    //    the catalog first, before anything with a side effect (no stock reserved, no
    //    emails, no DB row). A stale tab or a tampered request gets a 409 and reloads.
    //    The promo rate comes from the database, not the browser (read-only lookup), so
    //    the guard can re-derive the promo discount: full-price items only, no stacking.
    //    A failed lookup caps at the highest rate in use (10%) instead of blocking a
    //    paying customer; an invalid / used / expired code gets no discount at all.
    let promoRate: number | null = null;
    if (Number(order.promoDiscount ?? 0) > 0) {
      try {
        const promo = await checkPromoCode(order.promoCode);
        promoRate = promo.valid ? promo.discount : null;
      } catch (e) {
        console.error("[Order] promo lookup failed - capping at 10%:", e);
        promoRate = 0.10;
      }
    }
    // Never trust a client-submitted override price — re-fetch the durable overrides
    // (supabase/product_price_overrides.sql) server-side so the price check matches
    // whatever the storefront just displayed (catalog price, or a discounted price
    // if the admin has applied one).
    const overrides = await getPriceOverrides();
    const findProductWithOverride = (slug: string) => {
      const product = getProductBySlug(slug);
      return product ? applyOverride(product, overrides) : undefined;
    };
    const pricing = validateOrderPricing(order, findProductWithOverride, { promoRate });
    if (!pricing.ok) {
      console.warn("[Order] price check failed:", pricing.reason);
      return NextResponse.json(
        { success: false, code: "price_mismatch", error: "Цените са обновени, моля презаредете страницата" },
        { status: 409 },
      );
    }

    // ── CATALOG GATES - a product switched off in lib/products.ts (inStock: false)
    //    is never orderable, and a prepayment item can't use this cash-on-delivery
    //    checkout. Same position as the price guard: before any side effect.
    const gate = checkOrderable((order.items ?? []) as { slug?: unknown }[], findProductWithOverride);
    if (!gate.ok) {
      const error = gate.code === "not_for_sale"
        ? stockErrorMessage(gate.names.map((name) => ({ name, available: 0 })))
        : `${gate.names.join(", ")} се поръчва с предплащане - наложен платеж не е наличен. Свържете се с нас, за да уредим поръчката.`;
      return NextResponse.json({ success: false, code: gate.code, error }, { status: 409 });
    }

    // ── STOCK GUARD - final defence against overselling. Runs BEFORE emails and
    //    the DB insert, so an impossible order is never created. UNIFIED model:
    //    EVERY tracked item (watches, jewellery, leather) goes through the atomic
    //    reserve_wallet_stock - it row-locks each slug, and if ANY item is short it
    //    decrements nothing and returns the shortfall. Fail-CLOSED: block on
    //    shortfall OR error, so we never oversell. Slugs absent from wallet_inventory
    //    are skipped by the RPC. (Was: watches on a fail-open KV read-check; unified
    //    onto the stricter leather model so watches can no longer oversell either.)
    //
    //    Clutch gifts (lib/gifts.ts) ride on the same reservation: each clutch also reserves
    //    its gift cardholder (swapped for Bianco if the matching one is short, dropped if
    //    nothing is left). A gift never blocks the paid goods - only a short PAID item does.
    let gifts: GiftLine[] = [];
    let missedGifts: MissedGift[] = [];
    {
      const lines = (order.items ?? []) as ItemPayload[];
      const reserveItems = lines
        .filter((i) => i.slug)
        .map((i) => ({ slug: String(i.slug), qty: qtyOf(i), name: String(i.name ?? i.slug) }));
      if (reserveItems.length) {
        // Server key, not the public one: once supabase/close_public_functions.sql
        // runs, the public key can no longer call the stock functions.
        const reserveStock: ReserveFn = async (items) => {
          const { data: res, error: resErr } = await supabaseAdmin().rpc("reserve_wallet_stock", { p_items: items });
          if (resErr) throw new Error(resErr.message);
          if (res && (res as { ok?: boolean }).ok === false) {
            return { ok: false, shortfall: (res as { shortfall?: Shortfall[] }).shortfall ?? [] };
          }
          return { ok: true };
        };
        let reservation: GiftReservation;
        try {
          reservation = await reserveWithGifts(
            reserveItems.map(({ slug, qty }) => ({ slug, qty })),
            reserveStock,
            (slug) => findProductWithOverride(slug)?.inStock === true,
          );
        } catch (e) {
          console.error("[Order] reserve_wallet_stock error:", e instanceof Error ? e.message : e);
          return NextResponse.json({ success: false, error: "Възникна проблем с проверката на наличността. Моля, опитайте отново." }, { status: 503 });
        }
        if (!reservation.ok) {
          const named = reservation.shortfall.map((s) => ({ name: reserveItems.find((l) => l.slug === s.slug)?.name ?? s.slug, available: s.available }));
          return NextResponse.json({ success: false, error: stockErrorMessage(named) }, { status: 409 });
        }
        gifts = reservation.gifts;
        missedGifts = reservation.missed;
      }
    }

    // Gifts become real order lines (price 0, gift: true) so the emails, the panel and every
    // later restock (cancel / return / Econt) see them like any other line. They are added
    // AFTER the price guard and never reach the Meta events: those keep using the browser's
    // paid lines, so value and content_ids stay exactly what the customer pays for.
    const giftItems = gifts.map((g) => {
      const p = getProductBySlug(g.giftSlug);
      return {
        sku: p?.sku ?? g.giftSlug,
        slug: g.giftSlug,
        name: `ПОДАРЪК: ${giftDisplayName(g.giftSlug)}`,
        quantity: g.qty,
        qty: g.qty,
        price: 0,
        currency: p?.currency ?? "€",
        gift: true,
        giftFor: g.clutchSlug,
      };
    });
    const notes = giftNotes({ gifts, missed: missedGifts });
    // Only the server marks gifts: a client-sent gift / giftFor flag on a paid line is dropped.
    const paidItems = ((order.items ?? []) as Record<string, unknown>[]).map((i) => {
      const line = { ...i };
      delete line.gift;
      delete line.giftFor;
      return line;
    });
    const savedOrder: Record<string, unknown> = {
      ...order,
      items: [...paidItems, ...giftItems],
      ...(notes.length ? { giftNotes: notes } : {}),
    };

    // Send emails and await them - without await they are killed by Vercel before sending
    const subject = `✅ Нова поръчка - ${customerName}`;

    await Promise.allSettled([
      sendAdminEmail(subject, buildAdminEmail(savedOrder)),
      ...(customerAddress
        ? [sendCustomerEmail(customerAddress, buildCustomerEmail(savedOrder))]
        : []),
      // Meta's Purchase value is the server-validated amount, not the browser's number.
      sendCapiPurchase(order, String(order.orderRef ?? ""), pricing.total, capiCtx),
    ]);

    // 3. Save to Supabase. If this fails the order is NOT in the admin panel -
    //    the customer already saw success, so make failure LOUD (alert email)
    //    instead of silently swallowing it.
    try {
      const shipping = (order.shipping ?? {}) as Record<string, unknown>;
      const promoCode = typeof order.promoCode === "string" ? order.promoCode.trim() : "";
      const orderRow: Record<string, unknown> = {
        order_ref:               String(order.orderRef ?? ""),
        name:                    String(customer.name          ?? ""),
        phone:                   String(customer.phone         ?? ""),
        email:                   String(customer.email         ?? "") || null,
        city:                    String(customer.city          ?? ""),
        post_code:               String(customer.postCode      ?? ""),
        address:                 String(customer.officeAddress ?? ""),
        shipping_method:         String(customer.shippingMethod ?? ""),
        courier:                 String(customer.courier       ?? ""),
        items:                   savedOrder.items ?? [],
        subtotal:                Number(order.subtotal         ?? 0),
        shipping_cost:           Number(shipping.cost          ?? 0),
        total:                   Number(order.total            ?? 0),
        sms_marketing_consent:   Boolean(customer.smsMarketingConsent),
        email_marketing_consent: Boolean(customer.emailMarketingConsent),
        notes:                   String(customer.notes         ?? "") || null,
        promo_code:              promoCode || null,
        promo_discount:          Number(order.promoDiscount ?? 0) || null,
      };
      let dbError = (await supabase.from("orders").insert(orderRow)).error;
      // If the promo columns aren't migrated yet, save the order WITHOUT them
      // rather than losing the whole order (it's already shown as success).
      if (dbError && /promo_(code|discount)|schema cache|column/i.test(dbError.message)) {
        const rowNoPromo: Record<string, unknown> = { ...orderRow };
        delete rowNoPromo.promo_code;
        delete rowNoPromo.promo_discount;
        dbError = (await supabase.from("orders").insert(rowNoPromo)).error;
      }
      if (dbError) throw dbError;
      console.log("[Supabase] Order saved");
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.error("[Supabase] Failed to save order:", reason);
      // Order won't appear in the panel - send a distinct alert so it isn't lost.
      await sendAdminEmail(
        `🚨 [НЕ Е ЗАПИСАНА В ПАНЕЛА] ${customerName} - ${String(order.orderRef ?? "")}`,
        buildAdminEmail(savedOrder, `Поръчката НЕ се записа в базата (${reason}). Добави я РЪЧНО в панела.`),
      ).catch((e) => console.error("[Supabase] alert email also failed:", e));
    }

    // 4. Mark cart session as converted (best-effort). Uses the service key -
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

    // 5. Mark promo code as used - atomic (best-effort)
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

    // 6. Leather stock was already decremented atomically by the STOCK GUARD at
    //    the top (reserve_wallet_stock) - nothing to do here. (Watches/jewellery
    //    follow the reservation model; this new order becomes the reservation.)

    // The storefront shows what was really given (and why it changed) on the success screen.
    return NextResponse.json(
      {
        success: true,
        gifts: gifts.map((g) => ({ name: giftDisplayName(g.giftSlug), qty: g.qty, forName: shortModelName(g.clutchSlug) })),
        giftNotes: notes,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Order error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
