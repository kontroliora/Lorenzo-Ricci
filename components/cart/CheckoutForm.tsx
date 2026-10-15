"use client";
import { Fragment, useState, useRef, useEffect } from "react";
import type { CartItem } from "@/lib/types";
import { useCartStore } from "@/lib/store";
import { calcBundleDiscount } from "@/lib/bundles";
import { giftDisplayName } from "@/lib/gifts";
import { useGiftLines } from "@/lib/use-gifts";
import { trackFbEvent } from "@/lib/fbq";
import { requiresPrepayment, PREPAYMENT_THRESHOLD_EUR } from "@/lib/price";
import { CARD_PAYMENTS_ENABLED, PENDING_ORDER_KEY, type PaymentMethod } from "@/lib/payments";
import { saveCardCartSnapshot } from "@/lib/card-cart-snapshot";
import { newOrderRef } from "@/lib/order-ref";
import {
  BrandMark, CoCheck, CoField, CoRadioCard, CoSection, CoSubmit, CoSummary, CoTrust, IconHome, IconOffice, PaymentMarks, SecureNote, coInput,
  type SummaryLine, type SummaryRow,
} from "@/components/checkout/ui";

// ─── Shipping options ────────────────────────────────────────────────────────
const SHIPPING_OPTIONS = [
  { id: "econt-office",  label: "Доставка чрез Еконт до офис",  courier: "econt", price: 4.25 },
  { id: "home-address",  label: "Доставка чрез Еконт до адрес", courier: "home",  price: 5.45 },
] as const;

const FREE_SHIPPING_THRESHOLD = 60;

// Same contact as the product-page Viber fallback (ProductInfo.tsx) - kept as a
// local literal here since prepayment orders are an interim, manual-only path.
const PREPAYMENT_VIBER_LINK = "viber://chat?number=%2B359888081811";
const PREPAYMENT_PHONE = "+359 888 081 811";

type ShippingId = (typeof SHIPPING_OPTIONS)[number]["id"];

// ─── Props ───────────────────────────────────────────────────────────────────
interface CheckoutFormProps {
  items: CartItem[];
  total: number; // after bundle + promo discounts
  promoCode?: string;
  promoDiscount?: number;
  promoRate?: number; // fraction of the applied code - for the "-X%" label (10% / 5%)
  onSuccess: () => void;
}

export function CheckoutForm({ items, total, promoCode, promoDiscount = 0, promoRate = 0.10, onSuccess }: CheckoutFormProps) {
  const { clearCart } = useCartStore();
  const { totalDiscount, active: activeBundles } = calcBundleDiscount(items);
  // Free gift cardholders for the clutches - shown only; the order payload below still carries
  // just the paid lines, and the server adds (and stocks) the gifts itself.
  const giftLines = useGiftLines(items);

  // €1500+ items: cash-on-delivery is not offered - no card/PSP integration exists
  // yet, so the honest interim behaviour is to block normal checkout and route the
  // customer to arrange payment directly, rather than show a non-functional
  // "pay by card" control. Replace this block once a real prepayment flow exists.
  const needsPrepayment = items.some((i) => requiresPrepayment(i.product));

  // Seed contact fields from a recovered session (abandoned-cart link) so the
  // customer doesn't retype anything. Read once at mount from the store.
  const [form, setForm] = useState(() => {
    const p = useCartStore.getState().recoveryPrefill;
    return {
      name:  p?.name  ?? "",
      phone: p?.phone ?? "",
      email: p?.email ?? "",
      city: "",
      postCode: "",
      officeAddress: "",
      notes: "",
      smsMarketingConsent:   false,
      emailMarketingConsent: true,
    };
  });
  const [shippingId, setShippingId] = useState<ShippingId>("econt-office");
  // Cash on delivery stays the default; card (Stripe Checkout) is an opt-in and never offered for prepayment carts.
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cod");
  const [submitting, setSubmitting]         = useState(false);
  const [submitted, setSubmitted]           = useState(false);
  const purchaseFired  = useRef(false);
  const sessionIdRef   = useRef("");
  const saveTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phoneTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Generate a stable session ID for this checkout attempt
  useEffect(() => {
    let id = sessionStorage.getItem("lr_cart_session");
    if (!id) { id = crypto.randomUUID(); sessionStorage.setItem("lr_cart_session", id); }
    sessionIdRef.current = id;
  }, []);

  // Coming back from Stripe with the browser's Back button can restore this page frozen mid-redirect
  // (bfcache) - give the customer a working button again.
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => { if (e.persisted) setSubmitting(false); };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  const cartItemsPayload = () => items.map((i) => ({
    name:       i.product.name,
    sku:        i.product.sku,
    slug:       i.product.slug,
    price:      i.product.price,
    currency:   i.product.currency,
    quantity:   i.quantity,
    coverImage: i.product.coverImage,
  }));

  // Phone-first capture: fires as soon as phone has ≥10 digits, even before email.
  // Captured regardless of consent - the customer's real consent value is sent
  // along and stored; the send policy is decided server-side.
  useEffect(() => {
    if (form.phone.replace(/\D/g, "").length < 10) return;
    if (items.length === 0) return;

    if (phoneTimerRef.current) clearTimeout(phoneTimerRef.current);
    phoneTimerRef.current = setTimeout(() => {
      fetch("/api/cart-session", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId:    sessionIdRef.current,
          phone:        form.phone.trim(),
          name:         form.name || undefined,
          items:        cartItemsPayload(),
          subtotal:     total,
          emailConsent: form.emailMarketingConsent,
        }),
      }).catch(() => {});
    }, 1500);

    return () => { if (phoneTimerRef.current) clearTimeout(phoneTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.phone, form.emailMarketingConsent, form.name, items, total]);

  // Email capture: fires the moment the email looks valid - even if the customer
  // hasn't ticked consent or pressed submit. Adds email (+ phone if known).
  useEffect(() => {
    if (!form.email.includes("@")) return;
    if (items.length === 0) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      fetch("/api/cart-session", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId:    sessionIdRef.current,
          email:        form.email,
          phone:        form.phone.replace(/\D/g, "").length >= 10 ? form.phone.trim() : undefined,
          name:         form.name || undefined,
          items:        cartItemsPayload(),
          subtotal:     total,
          emailConsent: form.emailMarketingConsent,
        }),
      }).catch(() => {});
    }, 1200);

    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.email, form.emailMarketingConsent, form.phone, form.name, items, total]);
  const [errors, setErrors]                 = useState<Record<string, string>>({});
  const [submitError, setSubmitError]       = useState("");
  const [orderRef, setOrderRef]             = useState("");
  const [submittedTotal, setSubmittedTotal] = useState(0);
  // What the server actually gave as gifts (it can swap a sold-out cardholder for Bianco, or drop it).
  const [gifted, setGifted] = useState<{ gifts: { name: string; qty: number; forName: string }[]; notes: string[] }>({ gifts: [], notes: [] });

  // ── Derived values ─────────────────────────────────────────────────────────
  // Paying by card always ships free, whatever the order size.
  const isCardPay        = paymentMethod === "card" && !needsPrepayment;
  // Threshold is checked on the pre-promo amount so a discount code never adds shipping.
  const freeShipping     = isCardPay || (total + promoDiscount) >= FREE_SHIPPING_THRESHOLD;
  const selectedOption   = SHIPPING_OPTIONS.find((o) => o.id === shippingId)!;
  const shippingCost     = freeShipping ? 0 : selectedOption.price;
  const grandTotal       = total + shippingCost;
  const isHomeAddress    = shippingId === "home-address";

  const addressLabel       = isHomeAddress ? "Адрес за доставка" : "Адрес на офис или автомат";
  const addressPlaceholder =
    shippingId === "econt-office" ? "Еконт офис или автомат..." :
    "Вашият точен адрес...";

  // ── Validation ─────────────────────────────────────────────────────────────
  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim() || form.name.trim().length < 2) errs.name = "Въведете две имена";
    if (form.phone.replace(/\D/g, "").length < 10)        errs.phone = "Моля, въведете валиден телефонен номер.";
    if (!form.email.trim())                                errs.email = "Въведете имейл";
    else if (!form.email.includes("@"))                    errs.email = "Невалиден имейл";
    if (!form.city.trim())                                 errs.city = "Въведете град";
    if (isHomeAddress && !form.postCode.trim())            errs.postCode = "Моля, въведете пощенски код";
    if (!form.officeAddress.trim())                        errs.officeAddress = isHomeAddress ? "Въведете личен адрес" : "Въведете адрес на офис";
    return errs;
  };

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const clearError = (key: string) =>
    setErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });

  const handleViberContactClick = () => {
    trackFbEvent("Contact", { content_category: "prepayment_required" });
  };

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      const firstKey = Object.keys(errs)[0];
      setTimeout(() => {
        document.getElementById(`field-${firstKey}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
      return;
    }
    setErrors({});
    setSubmitError("");
    setSubmitting(true);

    const ref = newOrderRef("LR");
    const capturedTotal = grandTotal;

    const orderSummary = {
      orderRef:  ref,
      sessionId: sessionIdRef.current || undefined,
      customer: { ...form, shippingMethod: selectedOption.label, courier: selectedOption.courier },
      items: items.map((i) => ({
        sku:      i.product.sku,
        slug:     i.product.slug,
        name:     i.product.name,
        quantity: i.quantity,
        qty:      i.quantity,
        price:    i.product.price,
        currency: i.product.currency,
      })),
      bundles:      activeBundles.map(({ label, discount }) => ({ label, discount })),
      discount:     totalDiscount,
      promoCode:    promoCode || undefined,
      promoDiscount: promoDiscount || 0,
      subtotal:     total,
      shipping:     { method: selectedOption.label, courier: selectedOption.courier, cost: shippingCost },
      total:        grandTotal,
      paymentMethod: isCardPay ? "card" : "cod",
      timestamp:    new Date().toISOString(),
    };

    try {
      const res = await fetch("/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderSummary),
      });
      if (!res.ok) {
        let msg = "Възникна грешка при изпращането на поръчката. Моля, опитайте отново.";
        try { const body = await res.json(); if (body?.error) msg = body.error; } catch { /* ignore parse error */ }
        setSubmitError(msg);
        setSubmitting(false);
        return;
      }
      let cardCheckout: { url: string; ref: string } | null = null;
      try {
        const body = await res.json();
        if (isCardPay) {
          if (body?.paymentMethod === "card" && typeof body?.checkoutUrl === "string" && body.checkoutUrl) {
            cardCheckout = { url: body.checkoutUrl, ref: typeof body?.orderRef === "string" && body.orderRef ? body.orderRef : ref };
          }
        } else {
          setGifted({
            gifts: Array.isArray(body?.gifts) ? body.gifts : [],
            notes: Array.isArray(body?.giftNotes) ? body.giftNotes : [],
          });
        }
      } catch { /* an unreadable body doesn't undo an accepted order */ }

      if (isCardPay) {
        // Card: the order is only a reservation until Stripe confirms the payment - keep the cart, no Purchase,
        // no success screen. Remember the order for the return page and send the customer to Stripe.
        if (!cardCheckout) {
          setSubmitError("Не успяхме да отворим страницата за плащане. Моля, опитайте отново или изберете наложен платеж.");
          setSubmitting(false);
          return;
        }
        try { sessionStorage.setItem(PENDING_ORDER_KEY, cardCheckout.ref); } catch { /* private mode: the return page still has ?ref= */ }
        // The cart is in memory only: leave a snapshot so "Плащането не беше завършено" can bring it back.
        saveCardCartSnapshot(cardCheckout.ref, items, { name: form.name, email: form.email, phone: form.phone });
        window.location.assign(cardCheckout.url);
        return; // stay in the "redirecting" state until the browser leaves the page
      }
    } catch {
      setSubmitError("Възникна грешка при свързването. Моля, опитайте отново.");
      setSubmitting(false);
      return;
    }

    setOrderRef(ref);
    setSubmittedTotal(capturedTotal);
    setSubmitting(false);
    setSubmitted(true);
    clearCart();

    // Fire Purchase event exactly once - eventID=ref deduplicates with CAPI server event
    if (!purchaseFired.current) {
      purchaseFired.current = true;
      trackFbEvent("Purchase", {
        value:        capturedTotal,
        currency:     "EUR",
        content_ids:  items.map((i) => i.product.sku),
        contents:     items.map((i) => ({ id: i.product.sku, quantity: i.quantity })),
        content_type: "product",
        order_id:     ref,
      }, ref);
    }

    setTimeout(() => onSuccess(), 4000);
  };

  // ── Success screen ──────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-6 py-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[#1E5C37] bg-[#0F2A1A]">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#15803D" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <div>
          <h3 className="font-serif text-2xl text-white">Поръчката е получена!</h3>
          <p className="mt-1 font-sans text-sm text-[#B0B0B0]">Номер: {orderRef}</p>
        </div>

        <div className="flex w-full flex-col gap-2.5 rounded-[8px] border border-[#2F2F2F] bg-[#141414] p-4 text-left">
          <div className="flex justify-between font-sans text-sm">
            <span className="text-[#B0B0B0]">Сума за плащане</span>
            <span className="font-semibold text-white">€{submittedTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-sans text-sm">
            <span className="text-[#B0B0B0]">Начин на плащане</span>
            <span className="text-white">Наложен платеж</span>
          </div>
          {gifted.gifts.map((g) => (
            <div key={`${g.forName}-${g.name}`} className="flex justify-between font-sans text-sm">
              <span className="text-[#4ADE80]">Подарък към {g.forName}</span>
              <span className="text-[#4ADE80]">{g.name} × {g.qty}</span>
            </div>
          ))}
        </div>

        {gifted.notes.length > 0 && (
          <div className="flex w-full flex-col gap-1.5 rounded-[8px] border border-[#5C4A12] bg-[#241D0A] p-3 text-left">
            {gifted.notes.map((n) => (
              <p key={n} className="font-sans text-[13px] leading-relaxed text-[#F3D98B]">{n}</p>
            ))}
          </div>
        )}

        {form.email ? (
          <p className="font-sans text-sm leading-relaxed text-[#C9C9C9]">
            Изпратихме потвърждение на <span className="font-medium text-white">{form.email}</span>
          </p>
        ) : (
          <p className="font-sans text-sm leading-relaxed text-[#C9C9C9]">
            Ще се свържем с вас на <span className="font-medium text-white">{form.phone}</span> в рамките на 24ч.
          </p>
        )}

        <p className="font-sans text-xs text-[#A0A0A0]">Плащате при получаване · 30 дни лесна замяна</p>
      </div>
    );
  }

  // ── Order summary rows (everything is computed above; this only formats it) ─
  const summaryLines: SummaryLine[] = items.flatMap(({ product, quantity }) => {
    const gift = giftLines.find((g) => g.clutchSlug === product.slug);
    const onSale = typeof product.originalPrice === "number" && product.originalPrice > product.price;
    const line: SummaryLine = {
      key: product.id,
      image: product.coverImage.src,
      imageAlt: product.coverImage.alt,
      name: product.name,
      quantity,
      price: `${product.currency}${(product.price * quantity).toFixed(2)}`,
      compareAt: onSale ? `${product.currency}${((product.originalPrice as number) * quantity).toFixed(2)}` : undefined,
    };
    return gift
      ? [line, { key: `gift-${product.id}`, name: `Подарък: ${giftDisplayName(gift.giftSlug)}`, quantity: gift.qty, price: "Подарък", gift: true }]
      : [line];
  });
  const summaryRows: SummaryRow[] = [
    ...activeBundles.map(({ label, discount }) => ({ key: `bundle-${label}`, label: `${label} -10%`, value: `-€${discount.toFixed(2)}`, tone: "discount" as const })),
    ...(promoCode && promoDiscount > 0
      ? [{ key: "promo", label: `Промо ${promoCode} -${Math.round(promoRate * 100)}%`, value: `-€${promoDiscount.toFixed(2)}`, tone: "discount" as const }]
      : []),
    { key: "shipping", label: "Доставка", value: freeShipping ? "Безплатна" : `€${shippingCost.toFixed(2)}`, tone: freeShipping ? ("free" as const) : undefined },
  ];
  const inputProps = (key: string) => ({
    id: `bg-${key}`,
    "aria-invalid": errors[key] ? true : undefined,
    "aria-describedby": errors[key] ? `bg-${key}-err` : undefined,
  });

  // ── Form ────────────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-7" noValidate>
      {/* ── Order summary: first thing in the panel ─────────────────────────── */}
      <CoSummary
        lines={summaryLines}
        rows={summaryRows}
        totalLabel="Общо"
        total={`€${grandTotal.toFixed(2)}`}
        toggleLabel="Покажи поръчката"
        hideLabel="Скрий поръчката"
      />

      <div>
        <h3 className="font-serif text-xl text-white">{needsPrepayment ? "Поръчка с предплащане" : "Данни за доставка"}</h3>
        <p className="mt-1 font-sans text-sm text-[#B0B0B0]">
          {needsPrepayment ? "Урежда се директно с нас" : isCardPay ? "Плащане с карта - Безплатна доставка" : "Плащате при получаване - Наложен платеж"}
        </p>
      </div>

      {/* ── Form fields — none for a prepayment-only cart: those orders are arranged
             over Viber/phone, so only the note below is shown (owner, 2026-09-28). ── */}
      {!needsPrepayment && (
      <div className="flex flex-col gap-5">
        <CoField id="field-name" htmlFor="bg-name" label="Две имена" error={errors.name} errorId="bg-name-err">
          <input type="text" placeholder="Иван Иванов" value={form.name}
            onChange={(e) => { setForm((f) => ({ ...f, name: e.target.value })); clearError("name"); }}
            className={coInput(!!errors.name)} autoComplete="name" {...inputProps("name")} />
        </CoField>

        <CoField id="field-phone" htmlFor="bg-phone" label="Телефон" error={errors.phone} errorId="bg-phone-err">
          <input type="tel" placeholder="0888 123 456" value={form.phone}
            onChange={(e) => { setForm((f) => ({ ...f, phone: e.target.value })); clearError("phone"); }}
            className={coInput(!!errors.phone)} autoComplete="tel" inputMode="tel" {...inputProps("phone")} />
        </CoField>
        <div className="-mt-2">
          <CoCheck checked={form.smsMarketingConsent} onChange={(v) => setForm((f) => ({ ...f, smsMarketingConsent: v }))}>
            Искам да получавам ексклузивни оферти по SMS
          </CoCheck>
        </div>

        <CoField id="field-email" htmlFor="bg-email" label="Имейл" error={errors.email} errorId="bg-email-err">
          <input type="email" placeholder="your@email.com" value={form.email}
            onChange={(e) => { setForm((f) => ({ ...f, email: e.target.value })); clearError("email"); }}
            className={coInput(!!errors.email)} autoComplete="email" inputMode="email" {...inputProps("email")} />
        </CoField>
        <div className="-mt-2">
          <CoCheck checked={form.emailMarketingConsent} onChange={(v) => setForm((f) => ({ ...f, emailMarketingConsent: v }))}>
            Искам да получавам оферти и новини по имейл
          </CoCheck>
        </div>

        <CoField id="field-city" htmlFor="bg-city" label="Град" error={errors.city} errorId="bg-city-err">
          <input type="text" placeholder="София" value={form.city}
            onChange={(e) => { setForm((f) => ({ ...f, city: e.target.value })); clearError("city"); }}
            className={coInput(!!errors.city)} autoComplete="address-level2" {...inputProps("city")} />
        </CoField>

        {/* ── Payment method radio cards (only while the card option is switched on) ── */}
        {CARD_PAYMENTS_ENABLED && (
        <CoSection title="Начин на плащане">
          <div className="flex flex-col gap-2.5">
            <CoRadioCard
              name="paymentMethod" value="cod" selected={paymentMethod === "cod"}
              onSelect={() => { setPaymentMethod("cod"); setSubmitError(""); }}
              title="Наложен платеж" subtitle="Плащате при получаване. Прегледай преди да платиш."
            />
            <CoRadioCard
              name="paymentMethod" value="card" selected={paymentMethod === "card"}
              onSelect={() => { setPaymentMethod("card"); setSubmitError(""); }}
              title="Плащане с карта" subtitle="Безплатна доставка"
            >
              <PaymentMarks label="Приемани карти и портфейли" />
              {paymentMethod === "card" && (
                <SecureNote>Плащането се обработва сигурно от Stripe. Не съхраняваме данни за карти.</SecureNote>
              )}
            </CoRadioCard>
          </div>
        </CoSection>
        )}

        {/* ── Shipping method radio cards (hidden for prepayment-required orders) ── */}
        {!needsPrepayment && (
        <CoSection title="Начин на доставка" aside={<BrandMark name="econt" height={18} />}>
          <div className="flex flex-col gap-2.5">
            {SHIPPING_OPTIONS.map((option) => (
              <CoRadioCard
                key={option.id}
                name="shippingMethod" value={option.id} selected={shippingId === option.id}
                onSelect={() => {
                  setShippingId(option.id);
                  if (option.id !== "home-address") { setForm((f) => ({ ...f, postCode: "" })); clearError("postCode"); }
                }}
                icon={option.id === "econt-office" ? <IconOffice /> : <IconHome />}
                title={option.id === "econt-office" ? "До офис или автомат на Еконт" : "До адрес с Еконт"}
                subtitle="Срок: до 2 работни дни"
                right={freeShipping ? (
                  <span className="flex flex-col items-end leading-tight">
                    <span className="text-[#4ADE80]">Безплатна</span>
                    <span className="text-xs font-normal text-[#A0A0A0] line-through">€{option.price.toFixed(2)}</span>
                  </span>
                ) : `€${option.price.toFixed(2)}`}
              />
            ))}
          </div>
        </CoSection>
        )}

        {/* ── Address field (dynamic label) ────────────────────────────── */}
        <CoField id="field-officeAddress" htmlFor="bg-officeAddress" label={addressLabel} error={errors.officeAddress} errorId="bg-officeAddress-err">
          <input
            type="text"
            placeholder={addressPlaceholder}
            value={form.officeAddress}
            onChange={(e) => { setForm((f) => ({ ...f, officeAddress: e.target.value })); clearError("officeAddress"); }}
            className={coInput(!!errors.officeAddress)}
            autoComplete={isHomeAddress ? "street-address" : "off"}
            {...inputProps("officeAddress")}
          />
        </CoField>

        {isHomeAddress && (
          <CoField id="field-postCode" htmlFor="bg-postCode" label="Пощенски код" error={errors.postCode} errorId="bg-postCode-err">
            <input type="text" placeholder="1000" value={form.postCode}
              onChange={(e) => { setForm((f) => ({ ...f, postCode: e.target.value })); clearError("postCode"); }}
              className={coInput(!!errors.postCode)} autoComplete="postal-code" inputMode="numeric" {...inputProps("postCode")} />
          </CoField>
        )}

        <CoField htmlFor="bg-notes" label="Бележка" optional>
          <textarea
            id="bg-notes"
            placeholder="Специални инструкции..."
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            rows={2}
            className={`${coInput(false)} resize-none py-3`}
          />
        </CoField>
      </div>
      )}

      {submitError && (
        <p role="alert" className="rounded-[6px] border border-[#7A2A22] bg-[#2A1210] px-4 py-3 text-center font-sans text-[13px] leading-relaxed text-[#F87171]">
          {submitError}
        </p>
      )}

      {needsPrepayment ? (
        <div className="flex flex-col gap-3 rounded-[8px] border border-[#606060] bg-[#141414] px-5 py-5 text-center">
          <p className="font-sans text-sm leading-relaxed text-[#C9C9C9]">
            Продукти на цена от €{PREPAYMENT_THRESHOLD_EUR} нагоре се поръчват с предплащане и се уреждат директно с нас -
            наложен платеж не е наличен за тази поръчка.
          </p>
          <a
            href={PREPAYMENT_VIBER_LINK}
            onClick={handleViberContactClick}
            className="flex h-14 w-full items-center justify-center rounded-[6px] bg-[#0F2850] px-6 font-sans text-base font-medium text-white transition-colors hover:bg-[#1A3A6B]"
          >
            Свържете се по Viber
          </a>
          <p className="font-sans text-xs text-[#A0A0A0]">
            или на телефон <span className="font-medium text-white">{PREPAYMENT_PHONE}</span>
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <CoSubmit busy={submitting} busyLabel={isCardPay ? "Пренасочване към плащане..." : "Обработване..."}>
            {isCardPay ? `Плати €${grandTotal.toFixed(2)}` : `Завърши поръчката · €${grandTotal.toFixed(2)}`}
          </CoSubmit>

          <CoTrust
            points={isCardPay
              ? ["5 години гаранция", "30 дни замяна*"]
              : ["5 години гаранция", "30 дни замяна*", "Преглед преди плащане"]}
            note="* За стоки на редовна цена."
            links={[
              { href: "/policies/shipping", label: "Доставка" },
              { href: "/policies/returns", label: "Връщане" },
              { href: "/policies/privacy", label: "Поверителност" },
            ]}
          />
        </div>
      )}
    </form>
  );
}

