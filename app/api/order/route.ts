import { NextRequest, NextResponse, after } from "next/server";
import { ATTR_COOKIE, attributionFromCookie } from "@/lib/attribution";
import { isValidFullName, FULL_NAME_ERROR_BG } from "@/lib/full-name";
import { isValidPhoneBg, PHONE_ERROR_BG } from "@/lib/phone-bg";
import { insertOrderResilient } from "@/lib/order-insert";
import { checkCustomer } from "@/lib/nekorekten";
import { langOf, mayEmail } from "@/lib/mail-policy";
import { supabase } from "@/lib/supabase";
import { buildAdminEmail, buildCustomerEmail, customerSubjects, sendAdminEmail, sendCustomerEmail, sendCapiPurchase, type CapiContext } from "@/lib/order-notify";
import { notifyPartnerOnce } from "@/lib/partner/email";
import { checkCheckoutDuplicate, notifyDuplicateOrder } from "@/lib/duplicate-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { CARD_PAYMENTS_ENABLED, PENDING_PAYMENT } from "@/lib/payments";
import { refreshStockPages } from "@/lib/stock-pages";
import { claimPromo, releaseOpenCardAttempts, releasePromo, restockLines, returnOrigin, startCardPayment } from "@/lib/payment-orders";
import { BG_ORDER_REF_RE } from "@/lib/order-ref";
import { SITE_URL } from "@/lib/site";
import { previewMarked, previewOrdersAllowed } from "@/lib/deploy-env";
import type { CardLine } from "@/lib/stripe";
import { getProductBySlug } from "@/lib/products";
import { getPriceOverrides, applyOverride } from "@/lib/price-overrides";
import { getOfficeList } from "@/lib/econt-offices";
import { officeLabel } from "@/lib/econt-label";
import { validateOrderPricing } from "@/lib/order-pricing";
import { checkOrderable } from "@/lib/order-availability";
import { checkPromoCode, PROMO_CODES_ENABLED, PROMO_DISABLED_ERROR, PROMO_NOT_ON_SALE } from "@/lib/promo";
import { reserveWithGifts, giftNotes, giftDisplayName, shortModelName, GIFT_FALLBACK, clutchGiftLabel, clutchGiftSlots, isClutchGiftChoice, isGiftClutch, type GiftLine, type GiftReservation, type MissedGift, type ReserveFn, type Shortfall } from "@/lib/gifts";
import { watchGiftSlots, WATCH_GIFT_CHOICES } from "@/lib/watch-gift";

// Node runtime (not edge): the Nekorekten check after the response uses undici's ProxyAgent (lib/nekorekten.ts).
export const runtime = "nodejs";

// Insert an order row. econt_office_code (supabase/orders_econt_office.sql) is optional: if the column is not there yet the order is saved
// without it (the readable address in orders.address already carries the office code) rather than lost.
type OrderInsertClient = { from: (t: string) => { insert: (row: Record<string, unknown>) => PromiseLike<{ error: { message: string } | null }> } };
// Optional columns (a migration may not have run yet): the order is saved without them rather than lost (lib/order-insert.ts).
const OPTIONAL_ORDER_COLUMNS = ["econt_office_code", "card_discount", "utm_source", "utm_medium", "utm_campaign", "fbclid"] as const;
async function insertOrderRow(sb: OrderInsertClient, row: Record<string, unknown>) {
  const r = await insertOrderResilient(sb, row, OPTIONAL_ORDER_COLUMNS);
  if (r.dropped.length) console.warn("[order] saved without optional column(s):", r.dropped.join(", "));
  return { error: r.error };
}

// Order line item shape.
type ItemPayload = { sku?: string; qty?: number; quantity?: number; slug?: string; name?: string; price?: number; currency?: string; giftSlugs?: unknown };


// The paid line a gift belongs to, as the customer reads it: a clutch by its model ("Toscana"), a watch by its full name.
const forNameOf = (slug: string): string => {
  const p = getProductBySlug(slug);
  return p?.category === "watches" ? p.name : shortModelName(slug);
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

// The same reference again (a retry after a 5xx / timeout, a double click that raced the first request): the order already exists,
// so the customer gets the SAME success answer as the first time (with its gifts), never an error and never a second row.
// null = there is no such order (or the lookup failed: the request goes on, the unique index on order_ref still stops a 2nd row).
async function existingOrderReply(ref: string): Promise<NextResponse | null> {
  const { data, error } = await supabaseAdmin().from("orders").select("id, items, status, payment_method").eq("order_ref", ref).limit(1);
  if (error || !data?.length) return null;
  const row = data[0] as { items?: unknown; payment_method?: string | null };
  const lines = (Array.isArray(row.items) ? row.items : []) as { gift?: boolean; name?: string; qty?: number; quantity?: number; giftFor?: string }[];
  const gifts = lines.filter((l) => l.gift).map((l) => ({
    name: String(l.name ?? "").replace(/^ПОДАРЪК:\s*/, ""), qty: Number(l.quantity ?? l.qty ?? 1), forName: l.giftFor ? forNameOf(String(l.giftFor)) : "",
  }));
  console.log("[order] same reference again - answered with the existing order:", ref);
  return NextResponse.json({ success: true, duplicate: true, gifts, giftNotes: [] });
}

// ─────────────────────────────────────────────────────────────
// POST /api/order
// ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    if (!previewOrdersAllowed()) return NextResponse.json({ success: false, error: "Това е тестова (preview) версия: поръчките са изключени." }, { status: 503 });
    // Extract matching context before body is consumed
    const capiCtx: CapiContext = {
      ip:        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
                 ?? req.headers.get("x-real-ip")
                 ?? undefined,
      userAgent: req.headers.get("user-agent") ?? undefined,
      fbc:       req.cookies.get("_fbc")?.value ?? undefined,
      fbp:       req.cookies.get("_fbp")?.value ?? undefined,
      externalId: req.cookies.get("lr_xid")?.value ?? undefined,   // random id of this browser (first-party cookie), sent hashed
      sourceUrl:  req.headers.get("referer") ?? undefined,         // the page the order was placed on (validated in meta-capi)
    };

    const order    = await req.json() as Record<string, unknown>;
    const customer = (order.customer ?? {}) as Record<string, unknown>;
    const customerAddress = String(customer.email ?? "").trim();
    const customerName    = String(customer.name  ?? "");
    if (!isValidFullName(customerName)) {
      return NextResponse.json({ success: false, error: FULL_NAME_ERROR_BG, code: "bad_name" }, { status: 400 });
    }
    // The same phone rule as the checkout form (lib/phone-bg.ts): a request that skipped the form gets no order with an unusable phone.
    if (!isValidPhoneBg(customer.phone)) {
      return NextResponse.json({ success: false, error: PHONE_ERROR_BG, code: "bad_phone" }, { status: 400 });
    }

    // The reference is minted by the browser: check its shape, and treat the same reference twice (double click, retry after a
    // timeout) as the same order - never a second reservation or a second row.
    const orderRefIn = String(order.orderRef ?? "");
    if (!BG_ORDER_REF_RE.test(orderRefIn)) {
      return NextResponse.json({ success: false, error: "Невалидна поръчка. Моля, презаредете страницата." }, { status: 400 });
    }
    {
      const existing = await existingOrderReply(orderRefIn);
      if (existing) return existing;
    }

    // ── ECONT OFFICE - the checkout's picker sends the office code from Econt's official list. A code that is not in the list is
    //    refused; a known one replaces the address text with the canonical label (name, code, address), so what is saved is what
    //    Econt knows. No code = the manual fallback field (the picker was unavailable): the typed text stays as it is. If the list
    //    itself cannot be loaded right now the order is NOT blocked (the label the browser built is kept).
    const econtOfficeCode = String(customer.econtOfficeCode ?? "").trim().slice(0, 20);
    if (econtOfficeCode) {
      if (!/^[A-Za-z0-9@_-]{1,20}$/.test(econtOfficeCode)) {
        return NextResponse.json({ success: false, code: "bad_office", error: "Невалиден офис на Еконт. Моля, изберете офис отново." }, { status: 400 });
      }
      const officeList = await getOfficeList();
      if (officeList) {
        const office = officeList.offices.find((o) => o.c === econtOfficeCode);
        if (!office) return NextResponse.json({ success: false, code: "bad_office", error: "Този офис на Еконт не е намерен. Моля, изберете офис отново." }, { status: 400 });
        customer.officeAddress = officeLabel(office);
        // the order's city is the city of the office Econt knows (the checkout asks for no separate city with the picker)
        customer.city = officeList.cities.find((c) => c.i === office.i)?.n ?? customer.city;
      }
    }
    if (!String(customer.city ?? "").trim()) {
      return NextResponse.json({ success: false, code: "bad_customer", error: "Моля, изберете град (или офис на Еконт от списъка)." }, { status: 400 });
    }

    // ── PRICE GUARD - the browser reports unit prices and totals; check them against
    //    the catalog first, before anything with a side effect (no stock reserved, no
    //    emails, no DB row). A stale tab or a tampered request gets a 409 and reloads.
    //    The promo rate comes from the database, not the browser (read-only lookup), so
    //    the guard can re-derive the promo discount: full-price items only, no stacking.
    //    A failed lookup caps at the highest rate in use (10%) instead of blocking a
    //    paying customer; an invalid / used / expired code gets no discount at all.
    // Promo codes are off (lib/promo.ts): an order that still claims a promo discount is refused before anything happens; a bare
    // code without a discount is simply dropped, so no code is ever saved on an order.
    if (!PROMO_CODES_ENABLED) {
      if (Number(order.promoDiscount ?? 0) > 0) {
        return NextResponse.json({ success: false, code: "promo_disabled", error: PROMO_DISABLED_ERROR }, { status: 409 });
      }
      order.promoCode = undefined;
      order.promoDiscount = 0;
    }
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
    const pricing = validateOrderPricing(order, findProductWithOverride, { promoRate, card: order.paymentMethod === "card" && CARD_PAYMENTS_ENABLED });
    if (!pricing.ok) {
      console.warn("[Order] price check failed:", pricing.reason);
      // A promo discount on more than the full-price items: the code never covers discounted products.
      if (pricing.reason.startsWith("promo discount mismatch")) {
        return NextResponse.json({ success: false, code: "promo_not_on_sale", error: PROMO_NOT_ON_SALE }, { status: 409 });
      }
      return NextResponse.json(
        { success: false, code: "price_mismatch", error: "Цените са обновени, моля презаредете страницата" },
        { status: 409 },
      );
    }

    // ── CARD PAYMENT (Stripe): same guards as cash on delivery, plus FREE delivery - the server enforces it, the browser
    //    only displays it. Nothing below sends e-mails or Meta events for a card order: that happens when it is PAID.
    const isCard = order.paymentMethod === "card";
    if (isCard && !CARD_PAYMENTS_ENABLED) {
      return NextResponse.json({ success: false, error: "Плащането с карта не е налично в момента. Моля, изберете наложен платеж." }, { status: 503 });
    }
    // Stripe refuses an invalid customer_email, which would look like "card payment unavailable": say what is wrong instead.
    if (isCard && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(customerAddress)) {
      return NextResponse.json({ success: false, code: "bad_email", error: "Моля, въведете валиден имейл адрес за плащане с карта." }, { status: 400 });
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

    // ── OPEN CARD ATTEMPTS - this customer's unpaid card payments (they went to Stripe, came back and now order again, by cash on
    //    delivery or a new card payment): cancelled now and their stock given back, before the guard below and the reservation, so
    //    the customer's own unpaid hold never blocks this order. One that was paid meanwhile becomes a real order and the guard asks.
    await releaseOpenCardAttempts(supabaseAdmin(), { email: customer.email, phone: customer.phone }, orderRefIn);

    // ── DOUBLE-ORDER GUARD - the same e-mail or phone already has a (not cancelled) order with one of these products from the last 24 h:
    //    ask the customer first (the checkout shows "Вече имате поръчка #… Искате ли да направите втора?"). Runs before the stock is
    //    reserved, so nothing is held for an order that may not happen. The customer's "Да, нова поръчка" resends with confirmDuplicate.
    //    A failed lookup never blocks the order (lib/duplicate-server.ts).
    if (order.confirmDuplicate !== true) {
      const slugs = ((order.items ?? []) as ItemPayload[]).map((i) => String(i.slug ?? "")).filter(Boolean);
      const prior = await checkCheckoutDuplicate({ email: customer.email, phone: customer.phone }, slugs);
      if (prior) {
        return NextResponse.json({ success: false, code: "possible_duplicate", existing: { ref: prior.ref, at: prior.at, total: prior.total, names: prior.names } }, { status: 409 });
      }
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
    //    Free cardholders ride on the same reservation. A clutch's (lib/gifts.ts) is the one the customer chose, reserved
    //    STRICTLY: if it ran out meanwhile the order is refused with code "gift_sold_out" and the cart sends the customer back to
    //    the choice (never a silent swap). A watch's (lib/watch-gift.ts) is swapped if short. A clutch line without a chosen
    //    cardholder (every one was sold out, or the customer added the clutch alone) is sold alone.
    let gifts: GiftLine[] = [];
    let missedGifts: MissedGift[] = [];
    {
      const lines = (order.items ?? []) as ItemPayload[];
      // A free cardholder exists only with a clutch (or a watch while its offer runs): giftSlugs anywhere else, or anything that is not
      // one cardholder per unit, is refused - the free cardholder can't be ordered on its own.
      const badGift = lines.find((i) => {
        if (i.giftSlugs === undefined) return false;
        const slug = String(i.slug ?? "");
        const isWatch = getProductBySlug(slug)?.category === "watches";
        if (!isGiftClutch(slug) && !isWatch) return true;
        if (!Array.isArray(i.giftSlugs) || i.giftSlugs.length > qtyOf(i)) return true;
        return isGiftClutch(slug) && !i.giftSlugs.every(isClutchGiftChoice);
      });
      if (badGift) {
        return NextResponse.json({ success: false, code: "gift_not_allowed", error: "Безплатният кардхолдър се поръчва само заедно с клъч. Моля, презаредете страницата и опитайте отново." }, { status: 400 });
      }
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
        // Watches (lib/watch-gift.ts, while it runs): the free cardholder the customer chose for each unit. If it is short, another
        // one goes instead (Bianco first, then the others) - the success screen and the e-mail say so.
        const watchGifts = watchGiftSlots(lines.filter((i) => i.slug).map((i) => ({
          slug: String(i.slug), qty: qtyOf(i), giftSlugs: i.giftSlugs, isWatch: getProductBySlug(String(i.slug))?.category === "watches",
        }))).map((g) => ({ forSlug: g.watchSlug, qty: g.qty, candidates: [g.giftSlug, GIFT_FALLBACK, ...WATCH_GIFT_CHOICES] }));
        // Clutches: the chosen cardholder only (strict).
        const clutchGifts = clutchGiftSlots(lines.filter((i) => i.slug).map((i) => ({ slug: String(i.slug), qty: qtyOf(i), giftSlugs: i.giftSlugs })))
          .map((g) => ({ forSlug: g.clutchSlug, qty: g.qty, candidates: [g.giftSlug], strict: true }));
        let reservation: GiftReservation;
        try {
          reservation = await reserveWithGifts(
            reserveItems.map(({ slug, qty }) => ({ slug, qty })),
            reserveStock,
            (slug) => findProductWithOverride(slug)?.inStock === true,
            [...clutchGifts, ...watchGifts],
          );
        } catch (e) {
          console.error("[Order] reserve_wallet_stock error:", e instanceof Error ? e.message : e);
          return NextResponse.json({ success: false, error: "Възникна проблем с проверката на наличността. Моля, опитайте отново." }, { status: 503 });
        }
        if (!reservation.ok && reservation.giftSoldOut?.length) {
          const g = reservation.giftSoldOut[0];
          return NextResponse.json({
            success: false,
            code: "gift_sold_out",
            giftSoldOut: reservation.giftSoldOut,
            error: `${giftDisplayName(g.giftSlug)}, който избрахте безплатно към клъч ${shortModelName(g.forSlug)}, току-що се изчерпа. Моля, изберете друг кардхолдър.`,
          }, { status: 409 });
        }
        if (!reservation.ok) {
          const named = reservation.shortfall.map((s) => ({ name: reserveItems.find((l) => l.slug === s.slug)?.name ?? s.slug, available: s.available }));
          return NextResponse.json({ success: false, error: stockErrorMessage(named) }, { status: 409 });
        }
        gifts = reservation.gifts;
        missedGifts = reservation.missed;
        await refreshStockPages([...reserveItems, ...gifts.map((g) => ({ slug: g.giftSlug, qty: g.qty }))], "reserved");
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
        // clutch: "ПОДАРЪК: Кардхолдър Zaffiro (безплатно) към клъч Capri" - the panel, the e-mails and fulfilment read both
        name: `ПОДАРЪК: ${isGiftClutch(g.clutchSlug) ? clutchGiftLabel(g.clutchSlug, g.giftSlug) : giftDisplayName(g.giftSlug)}`,
        quantity: g.qty,
        qty: g.qty,
        price: 0,
        currency: p?.currency ?? "€",
        gift: true,
        giftFor: g.clutchSlug,
      };
    });
    const notes = giftNotes({ gifts, missed: missedGifts }, forNameOf);
    // Only the server marks gifts: a client-sent gift / giftFor flag on a paid line is dropped (and the watches' chosen cardholders,
    // now real gift lines above).
    const paidItems = ((order.items ?? []) as Record<string, unknown>[]).map((i) => {
      const line = { ...i };
      delete line.gift;
      delete line.giftFor;
      delete line.giftSlugs;
      return line;
    });
    const savedOrder: Record<string, unknown> = {
      ...order,
      items: [...paidItems, ...giftItems],
      ...(notes.length ? { giftNotes: notes } : {}),
    };

    if (isCard) {
      const sbAdmin = supabaseAdmin();
      const shippingInfo = (order.shipping ?? {}) as Record<string, unknown>;
      const promoCodeCard = typeof order.promoCode === "string" ? order.promoCode.trim() : "";
      const orderRef = String(order.orderRef ?? "");
      const cardUnavailable = () => NextResponse.json({ success: false, error: "Плащането с карта не е налично в момента. Моля, опитайте с наложен платеж." }, { status: 503 });

      // 0. A single-use promo code is CLAIMED now (atomic), not when the money arrives: two open card orders can never both
      //    use it. It is given back if this order is not paid (expireOrder) or cannot be saved.
      let promoClaimed = false;
      if (promoCodeCard && promoRate !== null && Number(order.promoDiscount ?? 0) > 0) {
        try { promoClaimed = await claimPromo(sbAdmin, promoCodeCard); } catch (e) { console.error("[Order] promo claim failed:", e); }
        if (!promoClaimed) {
          await restockLines(sbAdmin, savedOrder.items);
          return NextResponse.json({ success: false, code: "promo_used", error: "Промо кодът вече е използван. Премахнете го и опитайте отново." }, { status: 409 });
        }
      }

      // 1. Save the order as PENDING_PAYMENT (stock is already reserved). It stays out of the fulfilment board and the Econt flows.
      const { error: insErr } = await insertOrderRow(sbAdmin, {
        ...attributionFromCookie(req.cookies.get(ATTR_COOKIE)?.value),   // utm_* / fbclid of the landing (lib/attribution.ts)
        order_ref:               orderRef,
        name:                    String(customer.name          ?? ""),
        phone:                   String(customer.phone         ?? ""),
        email:                   String(customer.email         ?? "") || null,
        city:                    String(customer.city          ?? ""),
        post_code:               String(customer.postCode      ?? ""),
        address:                 String(customer.officeAddress ?? ""),
        shipping_method:         String(customer.shippingMethod ?? ""),
        courier:                 String(customer.courier       ?? ""),
        items:                   savedOrder.items ?? [],
        subtotal:                pricing.subtotal,
        shipping_cost:           pricing.shippingCost,
        total:                   pricing.total,
        ...(pricing.cardDiscount > 0 ? { card_discount: pricing.cardDiscount } : {}),
        sms_marketing_consent:   Boolean(customer.smsMarketingConsent),
        email_marketing_consent: Boolean(customer.emailMarketingConsent),
        notes:                   previewMarked(String(customer.notes         ?? "")),
        promo_code:              promoClaimed ? promoCodeCard : null,
        promo_discount:          promoClaimed ? Number(order.promoDiscount ?? 0) || null : null,
        status:                  PENDING_PAYMENT,
        payment_method:          "card",
        payment_status:          "pending",
        payment_currency:        "EUR",
        ...(econtOfficeCode ? { econt_office_code: econtOfficeCode } : {}),
      });
      if (insErr) {
        console.error("[Order] card order insert failed (stripe_payments.sql run?):", insErr.message);
        await restockLines(sbAdmin, savedOrder.items);
        if (promoClaimed) await releasePromo(sbAdmin, promoCodeCard);
        return cardUnavailable();
      }

      // 2. Stripe Checkout lines = the paid lines at the SERVER's prices; bundle + promo discounts ride on one coupon.
      const cardLines: CardLine[] = [];
      for (const raw of (order.items ?? []) as ItemPayload[]) {
        const product = findProductWithOverride(String(raw.slug ?? ""));
        if (!product) continue;
        cardLines.push({
          name: product.name,
          sku: product.sku,
          quantity: qtyOf(raw),
          unitPrice: product.price,
          image: new URL(product.coverImage.src, SITE_URL).href,
        });
      }
      // delivery is a line of its own on the Stripe page (same price as for cash on delivery: free from EUR 60, else 4.25 / 5.45)
      if (pricing.shippingCost > 0) {
        const home = String(((order.shipping ?? {}) as Record<string, unknown>).courier ?? "") === "home";
        cardLines.push({ name: home ? "Доставка до адрес с Еконт" : "Доставка до офис или автомат на Еконт", sku: "SHIPPING", quantity: 1, unitPrice: pricing.shippingCost });
      }
      const started = await startCardPayment({
        sb: sbAdmin,
        orderRef,
        market: "bg",
        lines: cardLines,
        expectedTotal: pricing.total,
        discount: Math.round((pricing.catalogSubtotal - pricing.subtotal + pricing.cardDiscount) * 100) / 100,   // set + promo + card discount on one coupon
        discountLabel: pricing.cardDiscount > 0 && pricing.catalogSubtotal === pricing.subtotal ? "Отстъпка 5% за плащане с карта" : undefined,
        customerEmail: customerAddress || undefined,
        origin: returnOrigin(req.nextUrl.origin),
        heldItems: savedOrder.items,
        metadata: {
          ...(typeof order.sessionId === "string" ? { cart_session: order.sessionId.slice(0, 80) } : {}),
          ...(capiCtx.fbp ? { fbp: capiCtx.fbp.slice(0, 120) } : {}),
          ...(capiCtx.fbc ? { fbc: capiCtx.fbc.slice(0, 200) } : {}),
          ...(capiCtx.ip ? { client_ip: capiCtx.ip.slice(0, 64) } : {}),
          ...(capiCtx.userAgent ? { client_ua: capiCtx.userAgent.slice(0, 450) } : {}),
          ...(capiCtx.externalId ? { xid: capiCtx.externalId.slice(0, 100) } : {}),
        },
      });
      if (!started.ok) return cardUnavailable();
      return NextResponse.json({ success: true, paymentMethod: "card", orderRef, checkoutUrl: started.url }, { status: 200 });
    }

    // 3. Save to Supabase FIRST — the thank-you page, the team e-mail, the customer e-mail and the Meta Purchase event must
    //    only happen once the order actually exists; showing "success" first and saving after (the old order) let a DB
    //    failure put a paying customer on the thank-you screen for an order nobody could ever find in the panel.
    const shipping = (order.shipping ?? {}) as Record<string, unknown>;
    const promoCodeForRow = typeof order.promoCode === "string" ? order.promoCode.trim() : "";
    const orderRow: Record<string, unknown> = {
      ...attributionFromCookie(req.cookies.get(ATTR_COOKIE)?.value),   // utm_* / fbclid of the landing (lib/attribution.ts)
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
      notes:                   previewMarked(String(customer.notes         ?? "")),
      promo_code:              promoCodeForRow || null,
      promo_discount:          Number(order.promoDiscount ?? 0) || null,
      ...(econtOfficeCode ? { econt_office_code: econtOfficeCode } : {}),
    };
    let dbError: { message: string } | null = null;
    try {
      dbError = (await insertOrderRow(supabaseAdmin(), orderRow)).error;
      // If the promo columns aren't migrated yet, save the order WITHOUT them
      // rather than losing the whole order.
      if (dbError && /promo_(code|discount)|schema cache|column/i.test(dbError.message)) {
        const rowNoPromo: Record<string, unknown> = { ...orderRow };
        delete rowNoPromo.promo_code;
        delete rowNoPromo.promo_discount;
        dbError = (await insertOrderRow(supabaseAdmin(), rowNoPromo)).error;
      }
    } catch (err) {
      dbError = { message: err instanceof Error ? err.message : String(err) };
    }
    if (dbError) {
      // A concurrent request with the SAME reference saved it first (unique index orders_order_ref_uidx): this is not a lost order.
      // Give back what THIS request reserved and answer like the first one - no alarm, no error for the customer.
      if (/duplicate key|23505|order_ref/i.test(dbError.message)) {
        const existing = await existingOrderReply(String(order.orderRef ?? ""));
        if (existing) {
          await restockLines(supabaseAdmin(), savedOrder.items, "повторен опит на поръчка").catch((e) => console.error("[Order] restock after same-ref race failed:", e));
          return existing;
        }
      }
      const reason = dbError.message;
      console.error("[Supabase] Failed to save order:", reason);
      // Nothing was actually sold — give the reserved stock back so a retry (or the next customer) can have it.
      await restockLines(supabaseAdmin(), savedOrder.items, "поръчка в брой").catch((e) => console.error("[Order] restock after failed save also failed:", e));
      // The order exists nowhere but this e-mail now — send it with every detail so it can be entered manually if the customer doesn't retry.
      await sendAdminEmail(
        `🚨 [ПОРЪЧКАТА НЕ СЕ ЗАПИСА] ${customerName} - ${String(order.orderRef ?? "")}`,
        buildAdminEmail(savedOrder, `Поръчката НЕ успя да се запише в базата (${reason}). Клиентът видя грешка, а не "успешна поръчка" - може да опита отново, или добави я РЪЧНО в панела.`),
      ).catch((e) => console.error("[Supabase] alert email also failed:", e));
      return NextResponse.json(
        { success: false, code: "save_failed", error: "Възникна грешка при запазването на поръчката. Моля, опитайте отново или се свържете с нас." },
        { status: 503 },
      );
    }
    console.log("[Supabase] Order saved");

    // Send emails and the Meta event now that the order really exists - AFTER the response (next/server after(): Vercel keeps the
    // function alive until they finish), so a slow Resend / Meta never delays the customer's answer or turns it into a timeout
    // (which made the browser retry and, before the same-reference guard, could create a second order).
    const subject = `✅ Нова поръчка - ${customerName}`;
    after(() => Promise.allSettled([
      sendAdminEmail(subject, buildAdminEmail(savedOrder)),
      // The customer's confirmation is the BULGARIAN template: it only goes to a Bulgarian recipient (a Romanian order has its own
      // route, /api/order-ro, with a Romanian e-mail). Never a Bulgarian text to a Romanian.
      ...(customerAddress && mayEmail("order_confirmation", langOf({ order_ref: String(order.orderRef ?? "") }), "bg")
        ? [sendCustomerEmail(customerAddress, buildCustomerEmail(savedOrder), customerSubjects.received(String(order.orderRef ?? "")), { kind: "order_confirmation", lang: langOf({ order_ref: String(order.orderRef ?? "") }) })]
        : []),
      // Meta's Purchase value is the server-validated amount, not the browser's number.
      sendCapiPurchase(order, String(order.orderRef ?? ""), pricing.total, capiCtx),
    ]).then((r) => r.forEach((x) => { if (x.status === "rejected") console.error("[Order] notification failed:", x.reason); })));
    // Partner e-mail (women's jewellery only, lib/partner/email.ts): right after the order is SAVED, at most once; after the
    // response, so the customer never waits for it.
    const savedRef = String(order.orderRef ?? "");
    after(() => notifyPartnerOnce(savedRef));
    // Repeat order (same e-mail / phone / name+address within 72 h): tell the team right away (Telegram, else e-mail).
    after(() => notifyDuplicateOrder(savedRef));
    // Некоректни клиенти: ask Nekorekten.com about this phone (+ e-mail) AFTER the response - never slows the checkout; cached 7 days,
    // a dead API only writes last_error (lib/nekorekten.ts). Skipped silently while NEKOREKTEN_API_KEY is not set.
    after(() => checkCustomer(supabaseAdmin(), orderRow.phone, orderRow.email as string | null).then(() => undefined, () => undefined));

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
        gifts: gifts.map((g) => ({ name: giftDisplayName(g.giftSlug), qty: g.qty, forName: forNameOf(g.clutchSlug) })),
        giftNotes: notes,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Order error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
