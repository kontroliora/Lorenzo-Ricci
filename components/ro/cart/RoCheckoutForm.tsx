"use client";
import { useEffect, useRef, useState } from "react";
import { useRoCart, type RoCartLine } from "@/lib/ro/store";
import { roAmounts } from "@/lib/ro/pricing";
import { RO_COUNTIES } from "@/lib/ro/counties";
import {
  RO_COD_FEE_RON,
  RO_DELIVERY_DAYS,
  RO_INSPECT_BEFORE_PAY,
  RO_RETURN_DAYS,
  RO_SHIPPING_FEE_RON,
  fmtRON,
} from "@/lib/ro/config";
import { trackFbEvent } from "@/lib/fbq";
import { PREPAYMENT_THRESHOLD_TEXT, bundleLineLabel } from "./shared";

// Romania checkout (cash on delivery / ramburs). Port of components/cart/CheckoutForm.tsx: same look, one shipping
// option, one payment method, GDPR-clean consent (nothing pre-ticked), no abandoned-cart capture. All money comes from
// lib/ro/pricing.ts roAmounts, the same function /api/order-ro uses, so the server agrees to the leu.
//
// A cart holding a product that needs advance payment (EUR 1500 and up, line.prepay) gets NO ramburs form: like the
// Bulgarian checkout, it shows the interim contact flow (Viber / phone / e-mail), the order is arranged with the shop.

const SHIPPING_LABEL = "Livrare la domiciliu cu curierul"; // what the customer reads
const SHIPPING_METHOD = "Livrare la domiciliu";              // what the API receives (contract)

// Same contact as the Bulgarian checkout's prepayment flow (components/cart/CheckoutForm.tsx): the Viber link and number.
const PREPAYMENT_VIBER_LINK = "viber://chat?number=%2B359888081811";
const PREPAYMENT_PHONE = "+359 888 081 811";
const PREPAYMENT_EMAIL = "info@lorenzo-ricci.com";

const FALLBACK_ERROR = "A apărut o eroare la trimiterea comenzii. Vă rugăm să încercați din nou.";
const NETWORK_ERROR = "Nu am putut trimite comanda. Verificați conexiunea la internet și încercați din nou.";
const PRICE_MISMATCH_ERROR = "Prețurile produselor s-au actualizat.";
const PRICE_RELOAD_HINT = "Reîncărcați pagina pentru a vedea prețurile actualizate, apoi încercați din nou.";
const CART_RELOAD_HINT = "Reîncărcați pagina pentru a actualiza coșul, apoi încercați din nou.";

/** Romanian mobile -> 10 national digits (07xxxxxxxx), or null. Accepts 07.., +407.., 00407.., 407.., spaces/dots/dashes/(). */
function normalizeRoPhone(raw: string): string | null {
  let s = raw.trim().replace(/[\s().\-–]/g, "");
  let national: string;
  if (s.startsWith("+")) {
    s = s.slice(1);
    if (!/^\d+$/.test(s) || !s.startsWith("40")) return null;
    national = s.slice(2);
  } else {
    if (!/^\d+$/.test(s)) return null;
    if (s.startsWith("0040")) national = s.slice(4);
    else if (s.startsWith("40") && s.length === 11) national = s.slice(2);
    else national = s;
  }
  national = national.replace(/^0/, "");
  return /^7\d{8}$/.test(national) ? `0${national}` : null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

interface RoCheckoutFormProps {
  items: RoCartLine[];
  onSuccess: () => void;
}

type FormState = {
  name: string;
  phone: string;
  email: string;
  county: string;
  city: string;
  address: string;
  postCode: string;
  notes: string;
  smsMarketingConsent: boolean;
  emailMarketingConsent: boolean;
  termsAccepted: boolean;
};

const ERR_BORDER = { borderBottomColor: "rgba(239,68,68,0.65)" } as const;

export function RoCheckoutForm({ items, onSuccess }: RoCheckoutFormProps) {
  const clearCart = useRoCart((s) => s.clear);

  // Marketing consents default to UNCHECKED (GDPR); the terms box is required and also starts unchecked.
  const [form, setForm] = useState<FormState>({
    name: "",
    phone: "",
    email: "",
    county: "",
    city: "",
    address: "",
    postCode: "",
    notes: "",
    smsMarketingConsent: false,
    emailMarketingConsent: false,
    termsAccepted: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState("");
  const [reloadHint, setReloadHint] = useState(""); // non-empty: the cart is stale, offer a page reload with this text
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [orderRef, setOrderRef] = useState("");
  const [submittedTotal, setSubmittedTotal] = useState(0);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const purchaseFired = useRef(false);
  const submittingRef = useRef(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A pending auto-close must not outlive the form (e.g. the customer closed the drawer or reopened it meanwhile).
  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  // ── Derived values (the only money maths: lib/ro/pricing.ts roAmounts) ─────
  const { shipping: shippingCost, total: grandTotal, bundles } = roAmounts(items);
  const freeShipping = shippingCost === 0;
  const needsPrepayment = items.some((i) => i.prepay);

  // Same signal as the Bulgarian "prepayment_required" Contact event (Viber link click).
  const handleViberContactClick = () => {
    trackFbEvent("Contact", { content_category: "prepayment_required" });
  };

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));
  const clearError = (key: string) =>
    setErrors((prev) => { if (!(key in prev)) return prev; const n = { ...prev }; delete n[key]; return n; });
  const fieldProps = (key: string) => ({
    id: `ro-${key}`,
    "aria-invalid": errors[key] ? true : undefined,
    "aria-describedby": errors[key] ? `ro-${key}-err` : undefined,
    style: errors[key] ? ERR_BORDER : undefined,
  });

  // ── Validation ─────────────────────────────────────────────────────────────
  // Keys are inserted in on-screen order, so the first key is the first field to scroll to.
  const validate = () => {
    const errs: Record<string, string> = {};
    const name = form.name.trim().replace(/\s+/g, " ");
    if (name.length < 3 || !name.includes(" ")) errs.name = "Introduceți numele complet (nume și prenume).";
    if (!normalizeRoPhone(form.phone)) errs.phone = "Introduceți un număr de mobil valid, de exemplu 0712 345 678.";
    const email = form.email.trim();
    if (!email) errs.email = "Introduceți adresa de e-mail.";
    else if (!EMAIL_RE.test(email)) errs.email = "Adresa de e-mail nu este validă.";
    if (!RO_COUNTIES.includes(form.county)) errs.county = "Alegeți județul.";
    if (form.city.trim().length < 2) errs.city = "Introduceți localitatea.";
    if (form.address.trim().length < 5) errs.address = "Introduceți adresa completă (stradă, număr, bloc/scară/apartament).";
    const postCode = form.postCode.replace(/\s/g, "");
    if (postCode && !/^\d{6}$/.test(postCode)) errs.postCode = "Codul poștal are 6 cifre.";
    if (!form.termsAccepted) errs.terms = "Trebuie să acceptați Termenii și condițiile și Politica de confidențialitate.";
    return errs;
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current || needsPrepayment) return; // advance-payment carts are arranged with the shop, never posted

    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      const firstKey = Object.keys(errs)[0];
      setTimeout(() => {
        document.getElementById(`field-${firstKey}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
        document.getElementById(`ro-${firstKey}`)?.focus({ preventScroll: true });
      }, 50);
      return;
    }
    if (items.length === 0) {
      setSubmitError("Coșul este gol. Adăugați un produs pentru a plasa comanda.");
      return;
    }

    setErrors({});
    setSubmitError("");
    setReloadHint("");
    submittingRef.current = true;
    setSubmitting(true);

    const ref = `LRRO-${Date.now().toString(36).slice(-6).toUpperCase()}`;
    // Snapshot everything the order and the tracking need: the cart is cleared the moment the order is accepted.
    const lines = items.map((i) => ({ ...i }));
    const amounts = roAmounts(lines);
    const orderTotal = amounts.total;
    const phone = normalizeRoPhone(form.phone) as string;
    const email = form.email.trim();

    const payload = {
      orderRef: ref,
      customer: {
        name: form.name.trim().replace(/\s+/g, " "),
        phone,
        email,
        county: form.county,
        city: form.city.trim(),
        address: form.address.trim(),
        postCode: form.postCode.replace(/\s/g, ""),
        notes: form.notes.trim(),
        smsMarketingConsent: form.smsMarketingConsent,
        emailMarketingConsent: form.emailMarketingConsent,
        termsAccepted: true,
      },
      items: lines.map((i) => ({ slug: i.slug, sku: i.sku, name: i.name, quantity: i.quantity, price: i.ron })),
      discount: amounts.discount,                              // set discount in lei (0 if none)
      shipping: { method: SHIPPING_METHOD, cost: amounts.shipping },
      subtotal: amounts.goods,                                 // goods AFTER the set discount
      total: amounts.total,
      timestamp: new Date().toISOString(),
    };

    const fail = (msg: string, reload = "") => {
      setSubmitError(msg);
      setReloadHint(reload);
      setSubmitting(false);
      submittingRef.current = false;
    };

    let res: Response;
    try {
      res = await fetch("/api/order-ro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      fail(NETWORK_ERROR);
      return;
    }

    let body: { success?: boolean; code?: string; error?: string } | null = null;
    try { body = await res.json(); } catch { /* an unreadable body doesn't undo an accepted order (see below) */ }

    if (!res.ok || body?.success === false) {
      const serverMsg = typeof body?.error === "string" ? body.error.trim() : "";
      if (body?.code === "price_mismatch") fail(serverMsg || PRICE_MISMATCH_ERROR, PRICE_RELOAD_HINT);
      // A stale cart without the advance-payment flag: a reload refreshes the lines and the checkout then shows the contact flow.
      else if (body?.code === "prepayment_required") fail(serverMsg || FALLBACK_ERROR, CART_RELOAD_HINT);
      else fail(serverMsg || FALLBACK_ERROR);
      return;
    }

    // Accepted. Show the confirmation first, clear the cart, then fire Purchase exactly once
    // (event_id = ref, so Meta de-duplicates it against the server-side CAPI event).
    setOrderRef(ref);
    setSubmittedTotal(orderTotal);
    setSubmittedEmail(email);
    setSubmitting(false);
    setSubmitted(true);
    clearCart();

    if (!purchaseFired.current) {
      purchaseFired.current = true;
      trackFbEvent("Purchase", {
        value: orderTotal,
        currency: "RON",
        content_ids: lines.map((i) => i.sku),
        contents: lines.map((i) => ({ id: i.sku, quantity: i.quantity })),
        content_type: "product",
        content_category: "RO",
        order_id: ref,
      }, ref);
    }

    closeTimer.current = setTimeout(() => onSuccess(), 4000);
  };

  // ── Success screen ─────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="flex flex-col items-center text-center gap-6 py-8">
        <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <div>
          <h3 className="font-serif text-2xl text-white mb-1.5">Comanda a fost primită!</h3>
          <p className="font-sans text-[10px] text-white/35 tracking-[0.22em] uppercase">
            Număr comandă: {orderRef}
          </p>
        </div>

        <div className="w-full bg-white/5 border border-white/8 p-4 flex flex-col gap-2.5">
          <div className="flex justify-between text-sm">
            <span className="font-sans text-white/50">Sumă de plată</span>
            <span className="font-serif text-white">{fmtRON(submittedTotal)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="font-sans text-white/40">Metodă de plată</span>
            <span className="font-sans text-white/60">Plata la livrare</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="font-sans text-white/40">Livrare estimată</span>
            <span className="font-sans text-white/60">{RO_DELIVERY_DAYS} zile lucrătoare de la expediere</span>
          </div>
        </div>

        <p className="font-sans text-xs text-white/45 leading-relaxed">
          Am trimis confirmarea la{" "}
          <span className="text-white/70 break-all">{submittedEmail}</span>
        </p>

        <p className="font-sans text-[10px] text-white/25 tracking-wide">
          Plătiți la primirea coletului · Retur în {RO_RETURN_DAYS} zile conform legii
        </p>
      </div>
    );
  }

  // ── Form ───────────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
      <div>
        <h3 className="font-serif text-xl text-white mb-1">{needsPrepayment ? "Comandă cu plată în avans" : "Date pentru livrare"}</h3>
        <p className="font-sans text-xs text-white/40 tracking-wide">
          {needsPrepayment ? "Se stabilește direct cu noi" : "Plătiți la livrare - ramburs"}
        </p>
      </div>

      {/* ── Order summary ─────────────────────────────────────────────────── */}
      <div className="bg-white/5 border border-white/8 p-4 flex flex-col gap-2">
        {items.map((i) => (
          <div key={i.slug} className="flex justify-between gap-3 text-xs">
            <span className="font-sans text-white/60 tracking-wide">{i.name} × {i.quantity}</span>
            <span className="font-serif text-white whitespace-nowrap">{fmtRON(i.ron * i.quantity)}</span>
          </div>
        ))}

        {bundles.map(({ id, label, discount }) => (
          <div key={id} className="flex justify-between gap-3 text-xs">
            <span className="font-sans text-navy-light tracking-wide">◈ {bundleLineLabel(label)}</span>
            <span className="font-sans text-navy-light whitespace-nowrap">-{fmtRON(discount)}</span>
          </div>
        ))}

        <div className="h-px bg-white/8 my-1" />

        <div className="flex justify-between text-xs">
          <span className="font-sans text-white/60 tracking-wide">Livrare</span>
          {freeShipping ? (
            <span className="font-sans text-green-400 tracking-wide font-medium">GRATUITĂ</span>
          ) : (
            <span className="font-serif text-white">{fmtRON(shippingCost)}</span>
          )}
        </div>

        {RO_COD_FEE_RON > 0 && (
          <div className="flex justify-between text-xs">
            <span className="font-sans text-white/60 tracking-wide">Taxă ramburs</span>
            <span className="font-serif text-white">{fmtRON(RO_COD_FEE_RON)}</span>
          </div>
        )}

        <div className="h-px bg-white/8 my-1" />

        <div className="flex justify-between text-sm">
          <span className="font-sans font-medium text-white tracking-wide">{needsPrepayment ? "Total" : "Total de plată"}</span>
          <span className="font-serif text-white text-base">{fmtRON(grandTotal)}</span>
        </div>
      </div>

      {/* ── Fields (none for an advance-payment cart: those orders are arranged over Viber / phone / e-mail) ── */}
      {!needsPrepayment && (<>
      <div className="flex flex-col gap-5">
        <Field id="name" label="Nume complet *" error={errors.name}>
          <input type="text" placeholder="Ion Popescu" value={form.name} maxLength={100}
            onChange={(e) => { set("name", e.target.value); clearError("name"); }}
            className="input-luxury" autoComplete="name" {...fieldProps("name")} />
        </Field>

        <Field id="phone" label="Telefon *" error={errors.phone}>
          <input type="tel" placeholder="07xx xxx xxx" value={form.phone} maxLength={20}
            onChange={(e) => { set("phone", e.target.value); clearError("phone"); }}
            className="input-luxury" autoComplete="tel" inputMode="tel" {...fieldProps("phone")} />
        </Field>
        <label className="flex items-start gap-2.5 cursor-pointer -mt-2">
          <input
            type="checkbox"
            checked={form.smsMarketingConsent}
            onChange={(e) => set("smsMarketingConsent", e.target.checked)}
            className="mt-0.5 flex-shrink-0 w-3.5 h-3.5 accent-white cursor-pointer"
          />
          <span className="font-sans text-[10px] text-white/40 leading-relaxed tracking-wide">
            Vreau să primesc oferte exclusive prin SMS (opțional)
          </span>
        </label>

        <Field id="email" label="E-mail *" error={errors.email}>
          <input type="email" placeholder="adresa@email.ro" value={form.email} maxLength={120}
            onChange={(e) => { set("email", e.target.value); clearError("email"); }}
            className="input-luxury" autoComplete="email" inputMode="email" {...fieldProps("email")} />
        </Field>
        <label className="flex items-start gap-2.5 cursor-pointer -mt-2">
          <input
            type="checkbox"
            checked={form.emailMarketingConsent}
            onChange={(e) => set("emailMarketingConsent", e.target.checked)}
            className="mt-0.5 flex-shrink-0 w-3.5 h-3.5 accent-white cursor-pointer"
          />
          <span className="font-sans text-[10px] text-white/40 leading-relaxed tracking-wide">
            Vreau să primesc oferte și noutăți prin e-mail (opțional)
          </span>
        </label>

        <Field id="county" label="Județ *" error={errors.county}>
          <div className="relative">
            <select
              value={form.county}
              onChange={(e) => { set("county", e.target.value); clearError("county"); }}
              className={`input-luxury appearance-none pr-6 cursor-pointer [color-scheme:dark] [&>option]:bg-charcoal-deep [&>option]:text-white ${form.county ? "" : "text-white/30"}`}
              autoComplete="address-level1"
              {...fieldProps("county")}
            >
              <option value="" disabled>Alegeți județul</option>
              {RO_COUNTIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <svg
              width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
              className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-white/40"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </Field>

        <Field id="city" label="Localitate *" error={errors.city}>
          <input type="text" placeholder="Cluj-Napoca" value={form.city} maxLength={80}
            onChange={(e) => { set("city", e.target.value); clearError("city"); }}
            className="input-luxury" autoComplete="address-level2" {...fieldProps("city")} />
        </Field>

        <Field id="address" label="Adresă (stradă, număr, bloc/scară/apartament) *" error={errors.address}>
          <input type="text" placeholder="Str. Exemplu 12, bl. A3, sc. 2, ap. 14" value={form.address} maxLength={200}
            onChange={(e) => { set("address", e.target.value); clearError("address"); }}
            className="input-luxury" autoComplete="street-address" {...fieldProps("address")} />
        </Field>

        <Field id="postCode" label="Cod poștal (opțional)" error={errors.postCode}>
          <input type="text" placeholder="400001" value={form.postCode} maxLength={10}
            onChange={(e) => { set("postCode", e.target.value); clearError("postCode"); }}
            className="input-luxury" autoComplete="postal-code" inputMode="numeric" {...fieldProps("postCode")} />
        </Field>

        <Field id="notes" label="Observații (opțional)">
          <textarea
            placeholder="Instrucțiuni speciale pentru curier..."
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            rows={2}
            maxLength={500}
            className="input-luxury resize-none"
            id="ro-notes"
          />
        </Field>
      </div>

      {/* ── Delivery (single option, shown as the selected card) ──────────── */}
      <div className="flex flex-col gap-1.5">
        <span className="font-sans text-[10px] font-medium tracking-[0.18em] uppercase text-white/40">
          Mod de livrare
        </span>
        <div className="border border-white/10 overflow-hidden mt-1">
          <div className="flex items-center justify-between p-4 bg-white/8">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full border-2 border-white flex items-center justify-center flex-shrink-0" aria-hidden="true">
                <div className="w-2 h-2 rounded-full bg-white" />
              </div>
              <span className="font-sans text-xs tracking-wide text-white">{SHIPPING_LABEL}</span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 ml-3">
              {freeShipping ? (
                <>
                  <span className="font-sans text-[11px] text-white/25 line-through">{fmtRON(RO_SHIPPING_FEE_RON)}</span>
                  <span className="font-sans text-[11px] text-green-400 font-medium">GRATUITĂ</span>
                </>
              ) : (
                <span className="font-serif text-sm text-white">{fmtRON(shippingCost)}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Payment (single method) ───────────────────────────────────────── */}
      <div className="flex flex-col gap-1.5">
        <span className="font-sans text-[10px] font-medium tracking-[0.18em] uppercase text-white/40">
          Metodă de plată
        </span>
        <div className="border border-white/10 overflow-hidden mt-1">
          <div className="p-4 bg-white/8 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full border-2 border-white flex items-center justify-center flex-shrink-0" aria-hidden="true">
                  <div className="w-2 h-2 rounded-full bg-white" />
                </div>
                <span className="font-sans text-xs tracking-wide text-white">Plata la livrare (ramburs)</span>
              </div>
              <span className="font-serif text-sm text-white flex-shrink-0 ml-3">{fmtRON(grandTotal)}</span>
            </div>
            <p className="font-sans text-[10px] text-white/40 tracking-wide leading-relaxed pl-7">
              Plătiți curierului suma de {fmtRON(grandTotal)} la primirea coletului.
            </p>
          </div>
        </div>
      </div>

      {/* ── Required consent: terms + privacy (unchecked by default) ──────── */}
      <div id="field-terms" className="flex flex-col gap-1.5">
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            id="ro-terms"
            type="checkbox"
            checked={form.termsAccepted}
            onChange={(e) => { set("termsAccepted", e.target.checked); clearError("terms"); }}
            aria-invalid={errors.terms ? true : undefined}
            aria-describedby={errors.terms ? "ro-terms-err" : undefined}
            className="mt-0.5 flex-shrink-0 w-3.5 h-3.5 accent-white cursor-pointer"
          />
          <span className="font-sans text-[11px] text-white/55 leading-relaxed tracking-wide">
            Am citit și sunt de acord cu{" "}
            <a
              href="/ro/politici/termeni"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-white/80 underline underline-offset-2 hover:text-white"
            >
              Termenii și condițiile
            </a>{" "}
            și cu{" "}
            <a
              href="/ro/politici/confidentialitate"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-white/80 underline underline-offset-2 hover:text-white"
            >
              Politica de confidențialitate
            </a>{" "}
            *
          </span>
        </label>
        {errors.terms && (
          <p id="ro-terms-err" role="alert" className="font-sans text-[10px] text-red-400 tracking-wide">{errors.terms}</p>
        )}
      </div>
      </>)}

      {submitError && (
        <div role="alert" className="font-sans text-xs text-red-400 text-center leading-relaxed border border-red-400/20 bg-red-400/5 px-4 py-3 flex flex-col items-center gap-2">
          <p>{submitError}</p>
          {reloadHint && (
            <>
              <p className="text-red-300/80">{reloadHint}</p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="font-sans text-[10px] tracking-widest uppercase border border-red-400/40 px-4 py-2 text-red-300 hover:bg-red-400/10 transition-colors"
              >
                Reîncărcați pagina
              </button>
            </>
          )}
        </div>
      )}

      {needsPrepayment ? (
        <div className="flex flex-col gap-3 border border-white/15 bg-white/[0.03] px-5 py-5 text-center">
          <p className="font-sans text-xs text-white/70 leading-relaxed">
            Produsele cu prețul de la {PREPAYMENT_THRESHOLD_TEXT} în sus se comandă cu plată în avans, stabilită direct cu noi -
            plata la livrare (ramburs) nu este disponibilă pentru această comandă. Vă rugăm să ne contactați pentru a finaliza comanda.
          </p>
          <a
            href={PREPAYMENT_VIBER_LINK}
            onClick={handleViberContactClick}
            className="btn-primary w-full justify-center"
          >
            Contactați-ne pe Viber
          </a>
          <p className="font-sans text-[11px] text-white/40">
            sau la telefon <span className="text-white/60">{PREPAYMENT_PHONE}</span>
          </p>
          <p className="font-sans text-[11px] text-white/40">
            sau prin e-mail la{" "}
            <a href={`mailto:${PREPAYMENT_EMAIL}`} className="text-white/60 underline underline-offset-2 hover:text-white">
              {PREPAYMENT_EMAIL}
            </a>
          </p>
        </div>
      ) : (
        <>
          <button type="submit" disabled={submitting} className="btn-primary w-full justify-center mt-2">
            {submitting ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Se trimite comanda...
              </span>
            ) : (
              `Comandă cu obligație de plată - ${fmtRON(grandTotal)}`
            )}
          </button>

          <p className="font-sans text-[10px] text-center text-white/25 tracking-wide leading-relaxed">
            Plătiți la primirea coletului.
            {RO_INSPECT_BEFORE_PAY && " Puteți deschide și verifica coletul înainte de a plăti curierului."}
            <br />Retur în {RO_RETURN_DAYS} zile conform legii.
          </p>
        </>
      )}
    </form>
  );
}

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div id={`field-${id}`} className="flex flex-col gap-1.5">
      <label htmlFor={`ro-${id}`} className="font-sans text-[10px] font-medium tracking-[0.18em] uppercase text-white/40">
        {label}
      </label>
      {children}
      {error && <p id={`ro-${id}-err`} role="alert" className="font-sans text-[10px] text-red-400 tracking-wide">{error}</p>}
    </div>
  );
}
