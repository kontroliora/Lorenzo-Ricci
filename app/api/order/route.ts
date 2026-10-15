import { NextRequest, NextResponse } from "next/server";
import { langOf, mayEmail } from "@/lib/mail-policy";
import { supabase } from "@/lib/supabase";
import { buildAdminEmail, buildCustomerEmail, sendAdminEmail, sendCustomerEmail, sendCapiPurchase, type CapiContext } from "@/lib/order-notify";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { CARD_PAYMENTS_ENABLED, PENDING_PAYMENT } from "@/lib/payments";
import { claimPromo, releasePromo, restockLines, returnOrigin, startCardPayment } from "@/lib/payment-orders";
import { BG_ORDER_REF_RE } from "@/lib/order-ref";
import { SITE_URL } from "@/lib/site";
import { previewMarked, previewOrdersAllowed } from "@/lib/deploy-env";
import type { CardLine } from "@/lib/stripe";
import { getProductBySlug } from "@/lib/products";
import { getPriceOverrides, applyOverride } from "@/lib/price-overrides";
import { validateOrderPricing } from "@/lib/order-pricing";
import { checkOrderable } from "@/lib/order-availability";
import { checkPromoCode } from "@/lib/promo";
import { reserveWithGifts, giftNotes, giftDisplayName, shortModelName, type GiftLine, type GiftReservation, type MissedGift, type ReserveFn, type Shortfall } from "@/lib/gifts";

// Order line item shape.
type ItemPayload = { sku?: string; qty?: number; quantity?: number; slug?: string; name?: string; price?: number; currency?: string };


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
    };

    const order    = await req.json() as Record<string, unknown>;
    const customer = (order.customer ?? {}) as Record<string, unknown>;
    const customerAddress = String(customer.email ?? "").trim();
    const customerName    = String(customer.name  ?? "");

    // The reference is minted by the browser: check its shape, and treat the same reference twice (double click, retry after a
    // timeout) as the same order - never a second reservation or a second row.
    const orderRefIn = String(order.orderRef ?? "");
    if (!BG_ORDER_REF_RE.test(orderRefIn)) {
      return NextResponse.json({ success: false, error: "Невалидна поръчка. Моля, презаредете страницата." }, { status: 400 });
    }
    {
      const dup = await supabaseAdmin().from("orders").select("id").eq("order_ref", orderRefIn).limit(1);
      if (!dup.error && dup.data && dup.data.length > 0) return NextResponse.json({ success: true, duplicate: true, gifts: [], giftNotes: [] });
    }

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
    if (isCard && (Number(((order.shipping ?? {}) as Record<string, unknown>).cost ?? 0) !== 0 || pricing.shippingCost !== 0)) {
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
      const { error: insErr } = await sbAdmin.from("orders").insert({
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
        shipping_cost:           0,
        total:                   pricing.total,
        sms_marketing_consent:   Boolean(customer.smsMarketingConsent),
        email_marketing_consent: Boolean(customer.emailMarketingConsent),
        notes:                   previewMarked(String(customer.notes         ?? "")),
        promo_code:              promoClaimed ? promoCodeCard : null,
        promo_discount:          promoClaimed ? Number(order.promoDiscount ?? 0) || null : null,
        status:                  PENDING_PAYMENT,
        payment_method:          "card",
        payment_status:          "pending",
        payment_currency:        "EUR",
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
      const started = await startCardPayment({
        sb: sbAdmin,
        orderRef,
        market: "bg",
        lines: cardLines,
        expectedTotal: pricing.total,
        discount: Math.round((pricing.catalogSubtotal - pricing.subtotal) * 100) / 100,
        customerEmail: customerAddress || undefined,
        origin: returnOrigin(req.nextUrl.origin),
        heldItems: savedOrder.items,
        metadata: {
          ...(typeof order.sessionId === "string" ? { cart_session: order.sessionId.slice(0, 80) } : {}),
          ...(capiCtx.fbp ? { fbp: capiCtx.fbp.slice(0, 120) } : {}),
          ...(capiCtx.fbc ? { fbc: capiCtx.fbc.slice(0, 200) } : {}),
          ...(capiCtx.ip ? { client_ip: capiCtx.ip.slice(0, 64) } : {}),
          ...(capiCtx.userAgent ? { client_ua: capiCtx.userAgent.slice(0, 450) } : {}),
        },
      });
      if (!started.ok) return cardUnavailable();
      return NextResponse.json({ success: true, paymentMethod: "card", orderRef, checkoutUrl: started.url }, { status: 200 });
    }

    // Send emails and await them - without await they are killed by Vercel before sending
    const subject = `✅ Нова поръчка - ${customerName}`;

    await Promise.allSettled([
      sendAdminEmail(subject, buildAdminEmail(savedOrder)),
      // The customer's confirmation is the BULGARIAN template: it only goes to a Bulgarian recipient (a Romanian order has its own
      // route, /api/order-ro, with a Romanian e-mail). Never a Bulgarian text to a Romanian.
      ...(customerAddress && mayEmail("order_confirmation", langOf({ order_ref: String(order.orderRef ?? "") }), "bg")
        ? [sendCustomerEmail(customerAddress, buildCustomerEmail(savedOrder), undefined, { kind: "order_confirmation", lang: langOf({ order_ref: String(order.orderRef ?? "") }) })]
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
        notes:                   previewMarked(String(customer.notes         ?? "")),
        promo_code:              promoCode || null,
        promo_discount:          Number(order.promoDiscount ?? 0) || null,
      };
      let dbError = (await supabaseAdmin().from("orders").insert(orderRow)).error;
      // If the promo columns aren't migrated yet, save the order WITHOUT them
      // rather than losing the whole order (it's already shown as success).
      if (dbError && /promo_(code|discount)|schema cache|column/i.test(dbError.message)) {
        const rowNoPromo: Record<string, unknown> = { ...orderRow };
        delete rowNoPromo.promo_code;
        delete rowNoPromo.promo_discount;
        dbError = (await supabaseAdmin().from("orders").insert(rowNoPromo)).error;
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
