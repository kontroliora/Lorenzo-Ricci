import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getProductBySlug } from "@/lib/products";
import { getPriceOverrides, applyOverride } from "@/lib/price-overrides";
import { checkOrderable } from "@/lib/order-availability";
import { ronOf, ronOriginalOf } from "@/lib/ro/config";
import { roName } from "@/lib/ro/names-ro";
import { roAmounts } from "@/lib/ro/pricing";
import { previewMarked, previewOrdersAllowed } from "@/lib/deploy-env";
import { RO_COUNTIES } from "@/lib/ro/counties";
import { CARD_PAYMENTS_ENABLED, PENDING_PAYMENT } from "@/lib/payments";
import { returnOrigin, startCardPayment } from "@/lib/payment-orders";
import { SITE_URL } from "@/lib/site";
import { buildRoCustomerEmail, buildRoAdminEmail, roCustomerSubject, type RoOrderEmailData } from "@/lib/ro/emails";
import { sendMail, sendCapiPurchase, RO_ADMIN_RECIPIENTS } from "@/lib/ro/order-notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/order-ro - Romanian market test: cash on delivery (ramburs), prices in lei.
//
// A PARALLEL path to /api/order (the Bulgarian COD/Econt flow is untouched). Same safety rules:
//   1. every price, total and the delivery fee are RE-DERIVED here from the catalog + price overrides
//      (EUR price x 5.25, whole lei) - the browser's numbers must match to the leu, else 409;
//   2. catalog gates (inStock off switch, Romanian assortment) before anything with a side effect;
//   3. stock is reserved with the same atomic reserve_wallet_stock (all-or-nothing under a row lock);
//   4. the order is inserted BEFORE the e-mails; if the insert fails the stock is put back and the customer is told;
//   5. a repeated orderRef is answered with success without reserving or inserting twice.
// The order is stored with is_international = true and ship_country = 'RO': it stays out of the Bulgarian board and
// out of every Econt cron, and appears in the panel tab "Румъния". Amounts in `total`/`subtotal`/`shipping_cost` are lei.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_QTY = 10;

const fail = (status: number, code: string, error: string) => NextResponse.json({ success: false, code, error }, { status });
const str = (v: unknown, max = 300) => String(v ?? "").trim().slice(0, max);

function stockMessage(items: { name: string; available: number }[]): string {
  const parts = items.map((s) => (s.available <= 0 ? `Pentru ${s.name} nu mai există stoc` : `Din ${s.name} mai sunt disponibile doar ${s.available} ${s.available === 1 ? "bucată" : "bucăți"}`));
  return `${parts.join(". ")}. Vă rugăm să ajustați cantitatea din coș.`;
}

// Romanian mobile numbers: 07xxxxxxxx, +407xxxxxxxx, 00407xxxxxxxx, 407xxxxxxxx -> 07xxxxxxxx.
function normalizePhone(raw: string): string | null {
  const d = raw.replace(/[^\d+]/g, "").replace(/^\+/, "");
  const national = d.startsWith("0040") ? "0" + d.slice(4) : d.startsWith("40") && d.length === 11 ? "0" + d.slice(2) : d;
  return /^07\d{8}$/.test(national) ? national : null;
}

export async function POST(req: NextRequest) {
  try {
    if (!previewOrdersAllowed()) return fail(503, "preview", "Aceasta este o versiune de previzualizare: comenzile sunt dezactivate.");
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return fail(400, "bad_request", "Cerere invalidă. Vă rugăm să reîncercați."); }

    // ── 1. Shape of the request ───────────────────────────────────────────────
    const ref = str(body.orderRef, 20);
    if (!/^LRRO-[A-Z0-9]{4,10}$/.test(ref)) return fail(400, "bad_request", "Cerere invalidă. Vă rugăm să reîncărcați pagina.");

    const cu = (body.customer ?? {}) as Record<string, unknown>;
    const name = str(cu.name, 120);
    const phone = normalizePhone(str(cu.phone, 30));
    const email = str(cu.email, 160).toLowerCase();
    const county = str(cu.county, 60);
    const city = str(cu.city, 100);
    const address = str(cu.address, 240);
    const postCode = str(cu.postCode, 12).replace(/\s+/g, "");
    if (name.length < 2) return fail(400, "bad_customer", "Vă rugăm să introduceți numele complet.");
    if (!phone) return fail(400, "bad_customer", "Vă rugăm să introduceți un număr de telefon mobil valid (ex. 07xx xxx xxx).");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(400, "bad_customer", "Vă rugăm să introduceți o adresă de e-mail validă.");
    if (!RO_COUNTIES.includes(county)) return fail(400, "bad_customer", "Vă rugăm să alegeți județul.");
    if (city.length < 2 || address.length < 5) return fail(400, "bad_customer", "Vă rugăm să completați localitatea și adresa de livrare.");
    if (postCode && !/^\d{6}$/.test(postCode)) return fail(400, "bad_customer", "Codul poștal trebuie să aibă 6 cifre.");
    if (cu.termsAccepted !== true) return fail(400, "terms", "Pentru a plasa comanda trebuie să acceptați Termenii și condițiile.");

    const rawItems = Array.isArray(body.items) ? (body.items as Record<string, unknown>[]) : [];
    if (rawItems.length === 0 || rawItems.length > 20) return fail(400, "bad_request", "Coșul este gol.");

    // ── 2. PRICE GUARD + catalog gates (before any side effect) ───────────────
    const overrides = await getPriceOverrides();
    const findProduct = (slug: string) => {
      const p = getProductBySlug(slug);
      return p ? applyOverride(p, overrides) : undefined;
    };

    const lines: { slug: string; sku: string; name: string; quantity: number; ron: number; onSale: boolean }[] = [];
    for (const it of rawItems) {
      const slug = str(it.slug, 80);
      const product = slug ? findProduct(slug) : undefined;
      if (!product) return fail(409, "not_for_sale", "Unul dintre produse nu este disponibil în această comandă. Vă rugăm să reîncărcați pagina.");
      const quantity = Number(it.quantity);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QTY) return fail(400, "bad_request", "Cantitate invalidă în coș.");
      const unit = Number(it.price);
      if (!Number.isFinite(unit) || unit !== ronOf(product)) {
        console.warn(`[order-ro] price mismatch for ${slug}: client ${String(it.price)}, server ${ronOf(product)}`);
        return fail(409, "price_mismatch", "Prețurile au fost actualizate, vă rugăm să reîncărcați pagina.");
      }
      lines.push({ slug, sku: product.sku, name: roName(product), quantity, ron: unit, onSale: ronOriginalOf(product) !== undefined });
    }
    if (new Set(lines.map((l) => l.slug)).size !== lines.length) return fail(400, "bad_request", "Coș invalid. Vă rugăm să reîncărcați pagina.");

    const gate = checkOrderable(lines, (slug) => { const p = findProduct(slug); return p ? { ...p, name: roName(p) } : undefined; }); // messages carry the Romanian product name
    if (!gate.ok) {
      return fail(409, gate.code, gate.code === "not_for_sale"
        ? stockMessage(gate.names.map((n) => ({ name: n, available: 0 })))
        : `${gate.names.join(", ")} nu se poate comanda cu plata la livrare.`);
    }

    // Card payment: delivery is FREE whatever the size of the order (the browser only displays it, the server enforces it)
    // and nothing is sent to Meta or the customer until Stripe confirms the payment (webhook).
    const isCard = body.paymentMethod === "card";
    if (isCard && !CARD_PAYMENTS_ENABLED) return fail(503, "unavailable", "Plata cu cardul nu este disponibilă momentan. Vă rugăm să alegeți plata la livrare.");
    // Every amount comes from ONE function (lib/ro/pricing.ts, shared with the cart): lines at the current lei prices, set
    // discounts, delivery judged on the amount after discounts. The browser's numbers must match to the leu.
    const { discount, goods: subtotal, shipping: shippingCost, total } = roAmounts(lines, { card: isCard });
    const sh = (body.shipping ?? {}) as Record<string, unknown>;
    if (Number(body.subtotal) !== subtotal || Number(body.discount ?? 0) !== discount || Number(sh.cost) !== shippingCost || Number(body.total) !== total) {
      console.warn(`[order-ro] total mismatch: client ${String(body.subtotal)}/${String(body.discount)}/${String(sh.cost)}/${String(body.total)}, server ${subtotal}/${discount}/${shippingCost}/${total}`);
      return fail(409, "price_mismatch", "Prețurile au fost actualizate, vă rugăm să reîncărcați pagina.");
    }

    // ── 3. Idempotency: the same reference is never reserved or inserted twice ─
    const sb = supabaseAdmin();
    const dup = await sb.from("orders").select("id").eq("order_ref", ref).limit(1);
    if (dup.error) { console.error("[order-ro] duplicate check failed:", dup.error.message); return fail(503, "unavailable", "Serviciul este temporar indisponibil. Vă rugăm să reîncercați."); }
    if (dup.data && dup.data.length > 0) return NextResponse.json({ success: true, duplicate: true });

    // ── 4. STOCK GUARD - atomic, all-or-nothing, fail-closed (same function as the Bulgarian order) ──
    const reserveItems = lines.map((l) => ({ slug: l.slug, qty: l.quantity }));
    const { data: res, error: resErr } = await sb.rpc("reserve_wallet_stock", { p_items: reserveItems });
    if (resErr) { console.error("[order-ro] reserve_wallet_stock error:", resErr.message); return fail(503, "unavailable", "A apărut o problemă la verificarea stocului. Vă rugăm să reîncercați."); }
    if (res && (res as { ok?: boolean }).ok === false) {
      const shortfall = ((res as { shortfall?: { slug: string; available: number }[] }).shortfall ?? []).map((s) => ({ name: lines.find((l) => l.slug === s.slug)?.name ?? s.slug, available: s.available }));
      return fail(409, "stock", stockMessage(shortfall));
    }

    // ── 5. Save the order (BEFORE the e-mails). A failed insert gives the stock back and tells the customer. ──
    const orderItems = lines.map((l) => ({ sku: l.sku, slug: l.slug, name: l.name, quantity: l.quantity, qty: l.quantity, price: l.ron, currency: "lei" }));
    const notes = str(cu.notes, 500);
    const { error: insErr } = await sb.from("orders").insert({
      ...(isCard ? { status: PENDING_PAYMENT, payment_method: "card", payment_status: "pending", payment_currency: "RON" } : {}),
      order_ref: ref,
      name,
      phone,
      email,
      city,
      post_code: postCode,
      address: `jud. ${county}, ${address}`,
      shipping_method: "Livrare la domiciliu",
      courier: "ro-curier",
      items: orderItems,
      subtotal,
      shipping_cost: shippingCost,
      total,
      sms_marketing_consent: cu.smsMarketingConsent === true,
      email_marketing_consent: cu.emailMarketingConsent === true,
      notes: previewMarked(notes),
      is_international: true,
      ship_country: "RO",
    });
    if (insErr) {
      console.error("[order-ro] insert failed:", insErr.message);
      const { error: restockErr } = await sb.rpc("restock_wallet_stock", { p_items: reserveItems });
      if (restockErr) console.error("[order-ro] restock after failed insert ALSO failed:", restockErr.message, ref);
      return fail(503, "unavailable", "Nu am putut înregistra comanda. Vă rugăm să reîncercați în câteva momente.");
    }

    // ── 5b. Card: open the Stripe session. E-mails, Meta Purchase and the panel only come after the webhook says PAID. ──
    const capiCtx = {
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? undefined,
      userAgent: req.headers.get("user-agent") ?? undefined,
      fbc: req.cookies.get("_fbc")?.value,
      fbp: req.cookies.get("_fbp")?.value,
    };
    if (isCard) {
      const started = await startCardPayment({
        sb,
        orderRef: ref,
        market: "ro",
        lines: lines.map((l) => ({ name: l.name, sku: l.sku, quantity: l.quantity, unitPrice: l.ron, image: new URL(getProductBySlug(l.slug)!.coverImage.src, SITE_URL).href })),
        expectedTotal: total,
        discount,
        customerEmail: email,
        origin: returnOrigin(req.nextUrl.origin),
        heldItems: orderItems,
        metadata: {
          ...(capiCtx.fbp ? { fbp: capiCtx.fbp.slice(0, 120) } : {}),
          ...(capiCtx.fbc ? { fbc: capiCtx.fbc.slice(0, 200) } : {}),
          ...(capiCtx.ip ? { client_ip: capiCtx.ip.slice(0, 64) } : {}),
          ...(capiCtx.userAgent ? { client_ua: capiCtx.userAgent.slice(0, 450) } : {}),
        },
      });
      if (!started.ok) return fail(503, "unavailable", "Plata cu cardul nu este disponibilă momentan. Vă rugăm să alegeți plata la livrare sau să reîncercați.");
      return NextResponse.json({ success: true, paymentMethod: "card", orderRef: ref, checkoutUrl: started.url });
    }

    // ── 6. E-mails + Meta Purchase (awaited: Vercel kills un-awaited work). Best effort: the order is already saved. ──
    const data: RoOrderEmailData = { orderRef: ref, customer: { name, phone, email, county, city, address, postCode, notes }, items: orderItems, subtotal, discount, shippingCost, total };
    const results = await Promise.allSettled([
      sendMail({ from: "Lorenzo Ricci Orders <orders@lorenzo-ricci.com>", to: RO_ADMIN_RECIPIENTS, subject: `🇷🇴 Нова поръчка (Румъния) - ${name} - ${ref}`, html: buildRoAdminEmail(data) }),
      sendMail({ from: "Lorenzo Ricci <info@lorenzo-ricci.com>", to: [email], subject: roCustomerSubject, html: buildRoCustomerEmail(data) }),
      sendCapiPurchase({ ...data, skus: lines.map((l) => l.sku) }, capiCtx),
    ]);
    results.forEach((r, i) => { if (r.status === "rejected") console.error(`[order-ro] ${["admin e-mail", "customer e-mail", "CAPI Purchase"][i]} failed:`, r.reason); });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[order-ro] error:", error);
    return fail(500, "error", "A apărut o eroare. Vă rugăm să reîncercați.");
  }
}
