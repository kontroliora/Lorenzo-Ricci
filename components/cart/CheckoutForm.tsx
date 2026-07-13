"use client";
import { useState, useRef, useEffect } from "react";
import type { CartItem } from "@/lib/types";
import { useCartStore } from "@/lib/store";
import { calcBundleDiscount } from "@/lib/bundles";
import { trackFbEvent } from "@/lib/fbq";

// ─── Shipping options ────────────────────────────────────────────────────────
const SHIPPING_OPTIONS = [
  { id: "econt-office",  label: "Доставка чрез Еконт до офис",  courier: "econt", price: 4.25 },
  { id: "home-address",  label: "Доставка чрез Еконт до адрес", courier: "home",  price: 5.45 },
] as const;

const FREE_SHIPPING_THRESHOLD = 60;

type ShippingId = (typeof SHIPPING_OPTIONS)[number]["id"];

// ─── Props ───────────────────────────────────────────────────────────────────
interface CheckoutFormProps {
  items: CartItem[];
  total: number; // after bundle + promo discounts
  promoCode?: string;
  promoDiscount?: number;
  onSuccess: () => void;
}

export function CheckoutForm({ items, total, promoCode, promoDiscount = 0, onSuccess }: CheckoutFormProps) {
  const { clearCart } = useCartStore();
  const { totalDiscount, active: activeBundles } = calcBundleDiscount(items);

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
  // Captured regardless of consent — the customer's real consent value is sent
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

  // Email capture: fires the moment the email looks valid — even if the customer
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

  // ── Derived values ─────────────────────────────────────────────────────────
  // Threshold is checked on the pre-promo amount so a discount code never adds shipping.
  const freeShipping     = (total + promoDiscount) >= FREE_SHIPPING_THRESHOLD;
  const selectedOption   = SHIPPING_OPTIONS.find((o) => o.id === shippingId)!;
  const shippingCost     = freeShipping ? 0 : selectedOption.price;
  const grandTotal       = total + shippingCost;
  const isHomeAddress    = shippingId === "home-address";

  const addressLabel       = isHomeAddress ? "Адрес за доставка *" : "Адрес на офис / Автомат *";
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

    const ref = `LR-${Date.now().toString(36).slice(-6).toUpperCase()}`;
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

    // Fire Purchase event exactly once — eventID=ref deduplicates with CAPI server event
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
      <div className="flex flex-col items-center text-center gap-6 py-8">
        <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <div>
          <h3 className="font-serif text-2xl text-white mb-1.5">Поръчката е получена!</h3>
          <p className="font-sans text-[10px] text-white/35 tracking-[0.22em] uppercase">
            Номер: {orderRef}
          </p>
        </div>

        <div className="w-full bg-white/5 border border-white/8 p-4 flex flex-col gap-2.5">
          <div className="flex justify-between text-sm">
            <span className="font-sans text-white/50">Сума за плащане</span>
            <span className="font-serif text-white">€{submittedTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="font-sans text-white/40">Начин на плащане</span>
            <span className="font-sans text-white/60">Наложен платеж</span>
          </div>
        </div>

        {form.email ? (
          <p className="font-sans text-xs text-white/45 leading-relaxed">
            Изпратихме потвърждение на{" "}
            <span className="text-white/70">{form.email}</span>
          </p>
        ) : (
          <p className="font-sans text-xs text-white/45 leading-relaxed">
            Ще се свържем с вас на{" "}
            <span className="text-white/70">{form.phone}</span> в рамките на 24ч.
          </p>
        )}

        <p className="font-sans text-[10px] text-white/25 tracking-wide">
          Плащате при получаване · 30 дни лесна замяна
        </p>
      </div>
    );
  }

  // ── Form ────────────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
      <div>
        <h3 className="font-serif text-xl text-white mb-1">Данни за доставка</h3>
        <p className="font-sans text-xs text-white/40 tracking-wide">Плащате при получаване - Наложен платеж</p>
      </div>

      {/* ── Order summary ─────────────────────────────────────────────────── */}
      <div className="bg-white/5 border border-white/8 p-4 flex flex-col gap-2">
        {items.map(({ product, quantity }) => (
          <div key={product.id} className="flex justify-between text-xs">
            <span className="font-sans text-white/60 tracking-wide">{product.name} × {quantity}</span>
            <span className="font-serif text-white">{product.currency}{(product.price * quantity).toFixed(2)}</span>
          </div>
        ))}

        {activeBundles.map(({ label, discount }) => (
          <div key={label} className="flex justify-between text-xs">
            <span className="font-sans text-navy-light tracking-wide">◈ {label} -10%</span>
            <span className="font-sans text-navy-light">-€{discount.toFixed(2)}</span>
          </div>
        ))}

        {promoCode && promoDiscount > 0 && (
          <div className="flex justify-between text-xs">
            <span className="font-sans text-emerald-400/70 tracking-wide">◈ Промо {promoCode} -10%</span>
            <span className="font-sans text-emerald-400/70">-€{promoDiscount.toFixed(2)}</span>
          </div>
        )}

        <div className="h-px bg-white/8 my-1" />

        {/* Shipping line */}
        <div className="flex justify-between text-xs">
          <span className="font-sans text-white/60 tracking-wide">Доставка</span>
          {freeShipping ? (
            <span className="font-sans text-green-400 tracking-wide font-medium">БЕЗПЛАТНА</span>
          ) : (
            <span className="font-serif text-white">€{shippingCost.toFixed(2)}</span>
          )}
        </div>

        <div className="h-px bg-white/8 my-1" />

        <div className="flex justify-between text-sm">
          <span className="font-sans font-medium text-white tracking-wide">Общо</span>
          <span className="font-serif text-white text-base">€{grandTotal.toFixed(2)}</span>
        </div>
      </div>

      {/* ── Form fields ───────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-5">
        <Field id="field-name" label="Две имена *" error={errors.name}>
          <input type="text" placeholder="Иван Иванов" value={form.name}
            onChange={(e) => { setForm((f) => ({ ...f, name: e.target.value })); clearError("name"); }}
            className="input-luxury" autoComplete="name"
            style={errors.name ? { borderBottomColor: "rgba(239,68,68,0.65)" } : undefined} />
        </Field>

        <Field id="field-phone" label="Телефон *" error={errors.phone}>
          <input type="tel" placeholder="0888 123 456" value={form.phone}
            onChange={(e) => { setForm((f) => ({ ...f, phone: e.target.value })); clearError("phone"); }}
            className="input-luxury" autoComplete="tel" inputMode="tel"
            style={errors.phone ? { borderBottomColor: "rgba(239,68,68,0.65)" } : undefined} />
        </Field>
        <label className="flex items-start gap-2.5 cursor-pointer -mt-2">
          <input
            type="checkbox"
            checked={form.smsMarketingConsent}
            onChange={(e) => setForm((f) => ({ ...f, smsMarketingConsent: e.target.checked }))}
            className="mt-0.5 flex-shrink-0 w-3.5 h-3.5 accent-white cursor-pointer"
          />
          <span className="font-sans text-[10px] text-white/40 leading-relaxed tracking-wide">
            Искам да получавам ексклузивни оферти по SMS
          </span>
        </label>

        <Field id="field-email" label="Имейл *" error={errors.email}>
          <input type="email" placeholder="your@email.com" value={form.email}
            onChange={(e) => { setForm((f) => ({ ...f, email: e.target.value })); clearError("email"); }}
            className="input-luxury" autoComplete="email" inputMode="email"
            style={errors.email ? { borderBottomColor: "rgba(239,68,68,0.65)" } : undefined} />
        </Field>
        <label className="flex items-start gap-2.5 cursor-pointer -mt-2">
          <input
            type="checkbox"
            checked={form.emailMarketingConsent}
            onChange={(e) => setForm((f) => ({ ...f, emailMarketingConsent: e.target.checked }))}
            className="mt-0.5 flex-shrink-0 w-3.5 h-3.5 accent-white cursor-pointer"
          />
          <span className="font-sans text-[10px] text-white/40 leading-relaxed tracking-wide">
            Искам да получавам оферти и новини по имейл
          </span>
        </label>

        <Field id="field-city" label="Град *" error={errors.city}>
          <input type="text" placeholder="София" value={form.city}
            onChange={(e) => { setForm((f) => ({ ...f, city: e.target.value })); clearError("city"); }}
            className="input-luxury" autoComplete="address-level2"
            style={errors.city ? { borderBottomColor: "rgba(239,68,68,0.65)" } : undefined} />
        </Field>

        {/* ── Shipping method radio cards ──────────────────────────────── */}
        <div className="flex flex-col gap-1.5">
          <span className="font-sans text-[10px] font-medium tracking-[0.18em] uppercase text-white/40">
            Начин на доставка
          </span>

          <div className="border border-white/10 overflow-hidden mt-1">
            {SHIPPING_OPTIONS.map((option) => {
              const isSelected = shippingId === option.id;
              return (
                <label
                  key={option.id}
                  className={`flex items-center justify-between p-4 border-b border-white/8 last:border-b-0 cursor-pointer transition-colors duration-200 ${
                    isSelected ? "bg-white/8" : "hover:bg-white/4"
                  }`}
                >
                  {/* Left: radio + label */}
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="shippingMethod"
                      value={option.id}
                      checked={isSelected}
                      onChange={() => {
                        setShippingId(option.id);
                        if (option.id !== "home-address") { setForm((f) => ({ ...f, postCode: "" })); clearError("postCode"); }
                      }}
                      className="sr-only"
                    />
                    {/* Custom radio circle */}
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors duration-200 ${
                      isSelected ? "border-white" : "border-white/25"
                    }`}>
                      {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                    <span className={`font-sans text-xs tracking-wide transition-colors duration-200 ${
                      isSelected ? "text-white" : "text-white/55"
                    }`}>
                      {option.label}
                    </span>
                  </div>

                  {/* Right: price */}
                  <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                    {freeShipping ? (
                      <>
                        <span className="font-sans text-[11px] text-white/25 line-through">{option.price.toFixed(2)} €</span>
                        <span className="font-sans text-[11px] text-green-400 font-medium">0.00 €</span>
                      </>
                    ) : (
                      <span className={`font-serif text-sm transition-colors duration-200 ${isSelected ? "text-white" : "text-white/55"}`}>
                        {option.price.toFixed(2)} €
                      </span>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {/* ── Address field (dynamic label) ────────────────────────────── */}
        <Field id="field-officeAddress" label={addressLabel} error={errors.officeAddress}>
          <input
            type="text"
            placeholder={addressPlaceholder}
            value={form.officeAddress}
            onChange={(e) => { setForm((f) => ({ ...f, officeAddress: e.target.value })); clearError("officeAddress"); }}
            className="input-luxury"
            style={errors.officeAddress ? { borderBottomColor: "rgba(239,68,68,0.65)" } : undefined}
            autoComplete={isHomeAddress ? "street-address" : "off"}
          />
        </Field>

        {isHomeAddress && (
          <Field id="field-postCode" label="Пощенски код *" error={errors.postCode}>
            <input type="text" placeholder="1000" value={form.postCode}
              onChange={(e) => { setForm((f) => ({ ...f, postCode: e.target.value })); clearError("postCode"); }}
              className="input-luxury" autoComplete="postal-code" inputMode="numeric"
              style={errors.postCode ? { borderBottomColor: "rgba(239,68,68,0.65)" } : undefined} />
          </Field>
        )}

        <Field label="Бележка (незадължително)" error={undefined}>
          <textarea
            placeholder="Специални инструкции..."
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            rows={2}
            className="input-luxury resize-none"
          />
        </Field>
      </div>

      {submitError && (
        <p className="font-sans text-xs text-red-400 text-center leading-relaxed border border-red-400/20 bg-red-400/5 px-4 py-3">
          {submitError}
        </p>
      )}

      <button type="submit" disabled={submitting} className="btn-primary w-full justify-center mt-2">
        {submitting ? (
          <span className="flex items-center gap-2">
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Обработване...
          </span>
        ) : (
          `Потвърди поръчката - €${grandTotal.toFixed(2)}`
        )}
      </button>

      <p className="font-sans text-[10px] text-center text-white/25 tracking-wide leading-relaxed">
        Плащате при получаване. Имате право на преглед и тест преди да заплатите.
        <br />30 дни лесна замяна.
      </p>
    </form>
  );
}

function Field({ label, error, id, children }: { label: string; error?: string; id?: string; children: React.ReactNode }) {
  return (
    <div id={id} className="flex flex-col gap-1.5">
      <label className="font-sans text-[10px] font-medium tracking-[0.18em] uppercase text-white/40">
        {label}
      </label>
      {children}
      {error && <p className="font-sans text-[10px] text-red-400 tracking-wide">{error}</p>}
    </div>
  );
}
