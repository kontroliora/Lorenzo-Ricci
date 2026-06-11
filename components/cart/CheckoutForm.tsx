"use client";
import { useState } from "react";
import type { CartItem } from "@/lib/types";
import { useCartStore } from "@/lib/store";
import { calcBundleDiscount } from "@/lib/bundles";

// ─── Shipping options ────────────────────────────────────────────────────────
const SHIPPING_OPTIONS = [
  { id: "speedy-office", label: "Доставка чрез Спиди до офис", courier: "speedy", price: 3.95 },
  { id: "econt-office",  label: "Доставка чрез Еконт до офис", courier: "econt",  price: 4.25 },
  { id: "home-address",  label: "Доставка до адрес",            courier: "home",   price: 5.45 },
] as const;

const FREE_SHIPPING_THRESHOLD = 80;

type ShippingId = (typeof SHIPPING_OPTIONS)[number]["id"];

// ─── Props ───────────────────────────────────────────────────────────────────
interface CheckoutFormProps {
  items: CartItem[];
  total: number; // already discounted subtotal from CartDrawer
  onSuccess: () => void;
}

export function CheckoutForm({ items, total, onSuccess }: CheckoutFormProps) {
  const { clearCart } = useCartStore();
  const { totalDiscount, active: activeBundles } = calcBundleDiscount(items);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    city: "",
    postCode: "",
    officeAddress: "",
    notes: "",
  });
  const [shippingId, setShippingId] = useState<ShippingId>("speedy-office");
  const [submitting, setSubmitting]  = useState(false);
  const [submitted, setSubmitted]    = useState(false);
  const [errors, setErrors]          = useState<Record<string, string>>({});

  // ── Derived values ─────────────────────────────────────────────────────────
  const freeShipping     = total >= FREE_SHIPPING_THRESHOLD;
  const selectedOption   = SHIPPING_OPTIONS.find((o) => o.id === shippingId)!;
  const shippingCost     = freeShipping ? 0 : selectedOption.price;
  const grandTotal       = total + shippingCost;
  const isHomeAddress    = shippingId === "home-address";

  const addressLabel       = isHomeAddress ? "Личен адрес *"              : "Адрес на офис / Автомат *";
  const addressPlaceholder = isHomeAddress ? "ул. Витоша 12, ет. 3, ап. 15" : "Еконт офис кв. Лозенец, ул. ...";

  // ── Validation ─────────────────────────────────────────────────────────────
  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim() || form.name.trim().length < 2) errs.name = "Въведете две имена";
    if (!form.phone.match(/^(\+359|0)\d{8,9}$/))         errs.phone = "Невалиден телефон";
    if (!form.city.trim())                                 errs.city = "Въведете град";
    if (!form.postCode.match(/^\d{4}$/))                  errs.postCode = "4-цифрен пощенски код";
    if (!form.officeAddress.trim())                        errs.officeAddress = isHomeAddress ? "Въведете личен адрес" : "Въведете адрес на офис";
    return errs;
  };

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    setSubmitting(true);

    const orderSummary = {
      customer: { ...form, shippingMethod: selectedOption.label, courier: selectedOption.courier },
      items: items.map((i) => ({
        sku:   i.product.sku,
        name:  i.product.name,
        qty:   i.quantity,
        price: i.product.price,
      })),
      bundles:      activeBundles.map(({ label, discount }) => ({ label, discount })),
      discount:     totalDiscount,
      subtotal:     total,
      shipping:     { method: selectedOption.label, courier: selectedOption.courier, cost: shippingCost },
      total:        grandTotal,
      timestamp:    new Date().toISOString(),
    };

    try {
      await fetch("/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderSummary),
      });
    } catch { /* silent - don't block UX */ }

    setSubmitting(false);
    setSubmitted(true);
    clearCart();
    setTimeout(onSuccess, 2500);
  };

  // ── Success screen ──────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="flex flex-col items-center text-center gap-5 py-10">
        <div className="text-white text-5xl">✓</div>
        <h3 className="font-serif text-2xl text-white">Поръчката е приета!</h3>
        <p className="font-sans text-sm text-white/60 leading-relaxed max-w-xs">
          Ще се свържем с вас на{" "}
          <strong className="text-white">{form.phone}</strong> в рамките на 24ч за потвърждение.
        </p>
        <p className="font-sans text-xs text-white/30 tracking-wide">Плащате при получаване.</p>
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
        <Field label="Две имена *" error={errors.name}>
          <input type="text" placeholder="Иван Иванов" value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="input-luxury" autoComplete="name" />
        </Field>

        <Field label="Телефон *" error={errors.phone}>
          <input type="tel" placeholder="0888 123 456" value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            className="input-luxury" autoComplete="tel" inputMode="tel" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Град *" error={errors.city}>
            <input type="text" placeholder="София" value={form.city}
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              className="input-luxury" autoComplete="address-level2" />
          </Field>
          <Field label="Пощенски код *" error={errors.postCode}>
            <input type="text" placeholder="1000" value={form.postCode}
              onChange={(e) => setForm((f) => ({ ...f, postCode: e.target.value }))}
              className="input-luxury" autoComplete="postal-code" inputMode="numeric" maxLength={4} />
          </Field>
        </div>

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
                      onChange={() => setShippingId(option.id)}
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
        <Field label={addressLabel} error={errors.officeAddress}>
          <input
            type="text"
            placeholder={addressPlaceholder}
            value={form.officeAddress}
            onChange={(e) => setForm((f) => ({ ...f, officeAddress: e.target.value }))}
            className="input-luxury"
            autoComplete={isHomeAddress ? "street-address" : "off"}
          />
        </Field>

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

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="font-sans text-[10px] font-medium tracking-[0.18em] uppercase text-white/40">
        {label}
      </label>
      {children}
      {error && <p className="font-sans text-[10px] text-red-400 tracking-wide">{error}</p>}
    </div>
  );
}
