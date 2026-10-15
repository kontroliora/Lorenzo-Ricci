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
  RO_SHIPPING_HOME,
  RO_SHIPPING_OFFICE,
  fmtRON,
} from "@/lib/ro/config";
import { trackFbEvent } from "@/lib/fbq";
import { CARD_PAYMENTS_ENABLED, PENDING_ORDER_KEY, type PaymentMethod } from "@/lib/payments";
import { newOrderRef } from "@/lib/order-ref";
import {
  CoCheck, CoField, CoLegal, CoRadioCard, CoSection, CoSubmit, CoSummary, CoTrust, IconHome, IconOffice, PaymentMarks, SecureNote, coInput,
  coLegalLink, type SummaryLine, type SummaryRow,
} from "@/components/checkout/ui";
import { PREPAYMENT_THRESHOLD_TEXT, bundleLineLabel } from "./shared";

// Romania checkout (cash on delivery / ramburs, or card through Stripe Checkout while the card option is switched on).
// Port of components/cart/CheckoutForm.tsx: same look, one shipping option, GDPR-clean consent (nothing pre-ticked), no
// abandoned-cart capture. All money comes from lib/ro/pricing.ts roAmounts, the same function /api/order-ro uses, so the
// server agrees to the leu. Card orders have free delivery and no ramburs fee (roAmounts {card: true}).
//
// A cart holding a product that needs advance payment (EUR 1500 and up, line.prepay) gets NO ramburs form: like the
// Bulgarian checkout, it shows the interim contact flow (Viber / phone / e-mail), the order is arranged with the shop.

const SHIPPING_LABEL = "Livrare la domiciliu cu curierul"; // what the customer reads (the API receives RO_SHIPPING_HOME / RO_SHIPPING_OFFICE)
type Delivery = "home" | "office";

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
  officeAddress: string;   // Econt office (delivery to the office): typed by hand
  postCode: string;
  notes: string;
  smsMarketingConsent: boolean;
  emailMarketingConsent: boolean;
};

export function RoCheckoutForm({ items, onSuccess }: RoCheckoutFormProps) {
  const clearCart = useRoCart((s) => s.clear);

  // Marketing consents default to UNCHECKED (GDPR). There is no terms checkbox: the agreement is the line under the order button.
  const [form, setForm] = useState<FormState>({
    name: "",
    phone: "",
    email: "",
    county: "",
    city: "",
    address: "",
    officeAddress: "",
    postCode: "",
    notes: "",
    smsMarketingConsent: false,
    emailMarketingConsent: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState("");
  const [reloadHint, setReloadHint] = useState(""); // non-empty: the cart is stale, offer a page reload with this text
  const [submitting, setSubmitting] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [payMethod, setPayMethod] = useState<PaymentMethod>("cod");
  const [delivery, setDelivery] = useState<Delivery>("home");
  const [submitted, setSubmitted] = useState(false);
  const [orderRef, setOrderRef] = useState("");
  const [submittedTotal, setSubmittedTotal] = useState(0);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const purchaseFired = useRef(false);
  const submittingRef = useRef(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cartSessionRef = useRef("");   // id of the saved cart (abandoned-cart reminder), created on the first capture
  const captureTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A pending auto-close must not outlive the form (e.g. the customer closed the drawer or reopened it meanwhile).
  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  // Coming back from the Stripe page with the browser's back button can restore this page frozen in the redirecting
  // state; unlock the form so the customer can retry or switch to ramburs.
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (!e.persisted || !submittingRef.current) return;
      submittingRef.current = false;
      setSubmitting(false);
      setRedirecting(false);
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  // ── Derived values (the only money maths: lib/ro/pricing.ts roAmounts) ─────
  const needsPrepayment = items.some((i) => i.prepay);
  const isCardPay = CARD_PAYMENTS_ENABLED && payMethod === "card" && !needsPrepayment;
  const { shipping: shippingCost, total: grandTotal, bundles } = roAmounts(items, { card: isCardPay });
  const codTotal = roAmounts(items).total;
  const cardTotal = roAmounts(items, { card: true }).total;
  // Abandoned-cart reminder (Romanian e-mail): the cart is saved ONLY while the customer has ticked the e-mail consent box (unticked
  // by default) and the address looks valid; unticking it afterwards withdraws the saved cart. Nothing is saved otherwise.
  const consent = form.emailMarketingConsent;
  useEffect(() => {
    const email = form.email.trim();
    if (!cartSessionRef.current && (!consent || !EMAIL_RE.test(email))) return; // nothing saved yet, nothing to withdraw
    if (items.length === 0 || items.some((i) => i.prepay)) return;
    if (captureTimer.current) clearTimeout(captureTimer.current);
    captureTimer.current = setTimeout(() => {
      if (!cartSessionRef.current) cartSessionRef.current = crypto.randomUUID();
      fetch("/api/cart-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: cartSessionRef.current,
          email: EMAIL_RE.test(email) ? email : undefined,
          name: form.name.trim() || undefined,
          lang: "ro",
          emailConsent: consent,
          items: items.map((i) => ({ slug: i.slug, sku: i.sku, name: i.name, price: i.ron, quantity: i.quantity })),
          subtotal: roAmounts(items).goods,
        }),
      }).catch(() => {});
    }, 1200);
    return () => { if (captureTimer.current) clearTimeout(captureTimer.current); };
  }, [consent, form.email, form.name, items]);
  const freeShipping = shippingCost === 0;

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
    if (delivery === "home") {
      if (form.address.trim().length < 5) errs.address = "Introduceți adresa completă (stradă, număr, bloc/scară/apartament).";
      const postCode = form.postCode.replace(/\s/g, "");
      if (postCode && !/^\d{6}$/.test(postCode)) errs.postCode = "Codul poștal are 6 cifre.";
    } else if (form.officeAddress.trim().length < 5) {
      errs.officeAddress = "Introduceți adresa biroului Econt (oraș și adresa biroului).";
    }
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

    const ref = newOrderRef("LRRO");
    // Snapshot everything the order and the tracking need: the cart is cleared the moment the order is accepted.
    const lines = items.map((i) => ({ ...i }));
    const method: PaymentMethod = isCardPay ? "card" : "cod";
    const amounts = roAmounts(lines, { card: method === "card" });
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
        address: delivery === "home" ? form.address.trim() : "",
        officeAddress: delivery === "office" ? form.officeAddress.trim() : "",
        postCode: delivery === "home" ? form.postCode.replace(/\s/g, "") : "",
        notes: form.notes.trim(),
        smsMarketingConsent: form.smsMarketingConsent,
        emailMarketingConsent: form.emailMarketingConsent,
      },
      sessionId: cartSessionRef.current || undefined,           // the saved cart (if any) is marked as converted by the server
      items: lines.map((i) => ({ slug: i.slug, sku: i.sku, name: i.name, quantity: i.quantity, price: i.ron })),
      discount: amounts.discount,                              // set discount in lei (0 if none)
      shipping: { method: delivery === "office" ? RO_SHIPPING_OFFICE : RO_SHIPPING_HOME, cost: amounts.shipping },
      subtotal: amounts.goods,                                 // goods AFTER the set discount
      total: amounts.total,
      paymentMethod: method,
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

    let body: { success?: boolean; code?: string; error?: string; paymentMethod?: string; checkoutUrl?: string; orderRef?: string } | null = null;
    try { body = await res.json(); } catch { /* an unreadable body doesn't undo an accepted order (see below) */ }

    if (!res.ok || body?.success === false) {
      const serverMsg = typeof body?.error === "string" ? body.error.trim() : "";
      if (body?.code === "price_mismatch") fail(serverMsg || PRICE_MISMATCH_ERROR, PRICE_RELOAD_HINT);
      // A stale cart without the advance-payment flag: a reload refreshes the lines and the checkout then shows the contact flow.
      else if (body?.code === "prepayment_required") fail(serverMsg || FALLBACK_ERROR, CART_RELOAD_HINT);
      else fail(serverMsg || FALLBACK_ERROR);
      return;
    }

    // Card: nothing is final until Stripe confirms the payment. No success screen, no cart clearing, no Purchase here:
    // the return page (/ro/comanda/finalizata) does those once the payment is confirmed. Park the order reference and
    // go to Stripe; the form stays locked in the "redirecting" state meanwhile.
    if (method === "card") {
      const url = typeof body?.checkoutUrl === "string" ? body.checkoutUrl : "";
      if (body?.success !== true || body.paymentMethod !== "card" || !/^https?:\/\//i.test(url)) {
        fail(FALLBACK_ERROR);
        return;
      }
      const pendingRef = typeof body.orderRef === "string" && body.orderRef ? body.orderRef : ref;
      try { sessionStorage.setItem(PENDING_ORDER_KEY, pendingRef); } catch { /* private mode: the return page reads ?ref= */ }
      setRedirecting(true);
      window.location.assign(url);
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
      <div className="flex flex-col items-center gap-6 py-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[#1E5C37] bg-[#0F2A1A]">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#15803D" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <div>
          <h3 className="font-serif text-2xl text-white">Comanda a fost primită!</h3>
          <p className="mt-1 font-sans text-sm text-[#B0B0B0]">Număr comandă: {orderRef}</p>
        </div>

        <div className="flex w-full flex-col gap-2.5 rounded-[8px] border border-[#2F2F2F] bg-[#141414] p-4 text-left">
          <div className="flex justify-between font-sans text-sm">
            <span className="text-[#B0B0B0]">Sumă de plată</span>
            <span className="font-semibold text-white">{fmtRON(submittedTotal)}</span>
          </div>
          <div className="flex justify-between font-sans text-sm">
            <span className="text-[#B0B0B0]">Metodă de plată</span>
            <span className="text-white">Plata la livrare</span>
          </div>
          <div className="flex justify-between gap-4 font-sans text-sm">
            <span className="text-[#B0B0B0]">Livrare estimată</span>
            <span className="text-right text-white">{RO_DELIVERY_DAYS} zile lucrătoare de la expediere</span>
          </div>
        </div>

        <p className="font-sans text-sm leading-relaxed text-[#C9C9C9]">
          Am trimis confirmarea la <span className="break-all font-medium text-white">{submittedEmail}</span>
        </p>

        <p className="font-sans text-xs text-[#A0A0A0]">Plătiți la primirea coletului · Retur în {RO_RETURN_DAYS} zile conform legii</p>
      </div>
    );
  }

  // ── Order summary rows (everything is computed above; this only formats it) ─
  const summaryLines: SummaryLine[] = items.map((i) => ({
    key: i.slug,
    image: i.image,
    imageAlt: i.imageAlt,
    name: i.name,
    quantity: i.quantity,
    price: fmtRON(i.ron * i.quantity),
    compareAt: i.originalRon != null && i.originalRon > i.ron ? fmtRON(i.originalRon * i.quantity) : undefined,
  }));
  const summaryRows: SummaryRow[] = [
    ...bundles.map(({ id, label, discount }) => ({ key: `bundle-${id}`, label: bundleLineLabel(label), value: `-${fmtRON(discount)}`, tone: "discount" as const })),
    { key: "shipping", label: "Livrare", value: freeShipping ? "Gratuită" : fmtRON(shippingCost), tone: freeShipping ? ("free" as const) : undefined },
    ...(!isCardPay && RO_COD_FEE_RON > 0 ? [{ key: "cod-fee", label: "Taxă ramburs", value: fmtRON(RO_COD_FEE_RON) }] : []),
  ];
  const OPT = "(opțional)";

  // ── Form ───────────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-7" noValidate>
      {/* ── Order summary: first thing in the panel ─────────────────────────── */}
      <CoSummary
        lines={summaryLines}
        rows={summaryRows}
        totalLabel={needsPrepayment ? "Total" : "Total de plată"}
        total={fmtRON(grandTotal)}
        toggleLabel="Afișați comanda"
        hideLabel="Ascundeți comanda"
      />

      <div>
        <h3 className="font-serif text-xl text-white">{needsPrepayment ? "Comandă cu plată în avans" : "Date pentru livrare"}</h3>
        <p className="mt-1 font-sans text-sm text-[#B0B0B0]">
          {needsPrepayment ? "Se stabilește direct cu noi" : isCardPay ? "Plata cu cardul - livrare gratuită" : "Plătiți la livrare - ramburs"}
        </p>
      </div>

      {/* ── Fields (none for an advance-payment cart: those orders are arranged over Viber / phone / e-mail) ── */}
      {!needsPrepayment && (<>
      <div className="flex flex-col gap-5">
        <CoField id="field-name" htmlFor="ro-name" label="Nume complet" error={errors.name} errorId="ro-name-err">
          <input type="text" placeholder="Ion Popescu" value={form.name} maxLength={100}
            onChange={(e) => { set("name", e.target.value); clearError("name"); }}
            className={coInput(!!errors.name)} autoComplete="name" {...fieldProps("name")} />
        </CoField>

        <CoField id="field-phone" htmlFor="ro-phone" label="Telefon" error={errors.phone} errorId="ro-phone-err">
          <input type="tel" placeholder="07xx xxx xxx" value={form.phone} maxLength={20}
            onChange={(e) => { set("phone", e.target.value); clearError("phone"); }}
            className={coInput(!!errors.phone)} autoComplete="tel" inputMode="tel" {...fieldProps("phone")} />
        </CoField>
        <div className="-mt-2">
          <CoCheck checked={form.smsMarketingConsent} onChange={(v) => set("smsMarketingConsent", v)}>
            Vreau să primesc oferte exclusive prin SMS (opțional)
          </CoCheck>
        </div>

        <CoField id="field-email" htmlFor="ro-email" label="E-mail" error={errors.email} errorId="ro-email-err">
          <input type="email" placeholder="adresa@email.ro" value={form.email} maxLength={120}
            onChange={(e) => { set("email", e.target.value); clearError("email"); }}
            className={coInput(!!errors.email)} autoComplete="email" inputMode="email" {...fieldProps("email")} />
        </CoField>
        <div className="-mt-2">
          <CoCheck checked={form.emailMarketingConsent} onChange={(v) => set("emailMarketingConsent", v)}>
            Vreau să primesc oferte, noutăți și un memento prin e-mail dacă nu finalizez comanda (opțional)
          </CoCheck>
        </div>

        <CoField id="field-county" htmlFor="ro-county" label="Județ" error={errors.county} errorId="ro-county-err">
          <div className="relative">
            <select
              value={form.county}
              onChange={(e) => { set("county", e.target.value); clearError("county"); }}
              className={`${coInput(!!errors.county)} cursor-pointer appearance-none pr-10 ${form.county ? "" : "text-[#9A9A9A]"}`}
              autoComplete="address-level1"
              {...fieldProps("county")}
            >
              <option value="" disabled>Alegeți județul</option>
              {RO_COUNTIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
              className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[#A0A0A0]"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </CoField>

        <CoField id="field-city" htmlFor="ro-city" label="Localitate" error={errors.city} errorId="ro-city-err">
          <input type="text" placeholder="Cluj-Napoca" value={form.city} maxLength={80}
            onChange={(e) => { set("city", e.target.value); clearError("city"); }}
            className={coInput(!!errors.city)} autoComplete="address-level2" {...fieldProps("city")} />
        </CoField>

        {delivery === "home" && (<>
        <CoField id="field-address" htmlFor="ro-address" label="Adresă (stradă, număr, bloc/scară/apartament)" error={errors.address} errorId="ro-address-err">
          <input type="text" placeholder="Str. Exemplu 12, bl. A3, sc. 2, ap. 14" value={form.address} maxLength={200}
            onChange={(e) => { set("address", e.target.value); clearError("address"); }}
            className={coInput(!!errors.address)} autoComplete="street-address" {...fieldProps("address")} />
        </CoField>

        <CoField id="field-postCode" htmlFor="ro-postCode" label="Cod poștal" optional optionalText={OPT} error={errors.postCode} errorId="ro-postCode-err">
          <input type="text" placeholder="400001" value={form.postCode} maxLength={10}
            onChange={(e) => { set("postCode", e.target.value); clearError("postCode"); }}
            className={coInput(!!errors.postCode)} autoComplete="postal-code" inputMode="numeric" {...fieldProps("postCode")} />
        </CoField>
        </>)}

        <CoField id="field-notes" htmlFor="ro-notes" label="Observații" optional optionalText={OPT}>
          <textarea
            id="ro-notes"
            placeholder="Instrucțiuni speciale pentru curier..."
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            rows={2}
            maxLength={500}
            className={`${coInput(false)} resize-none py-3`}
          />
        </CoField>
      </div>

      {/* ── Delivery (single option, shown as the selected card) ──────────── */}
      <CoSection title="Mod de livrare">
        <div role="radiogroup" aria-label="Mod de livrare" className="flex flex-col gap-2.5">
          <CoRadioCard
            name="ro-delivery" value="home" selected={delivery === "home"}
            onSelect={() => { setDelivery("home"); clearError("officeAddress"); }}
            icon={<IconHome />}
            title={SHIPPING_LABEL}
            subtitle={`Termen: ${RO_DELIVERY_DAYS} zile lucrătoare de la expediere`}
            right={freeShipping ? (
            <span className="flex flex-col items-end leading-tight">
              <span className="text-[#4ADE80]">Gratuită</span>
              <span className="text-xs font-normal text-[#A0A0A0] line-through">{fmtRON(RO_SHIPPING_FEE_RON)}</span>
            </span>
          ) : fmtRON(shippingCost)}
          />
          <CoRadioCard
            name="ro-delivery" value="office" selected={delivery === "office"}
            onSelect={() => { setDelivery("office"); clearError("address"); clearError("postCode"); }}
            icon={<IconOffice />}
            title="Livrare la biroul Econt"
            subtitle={`Ridicați din birou · ${RO_DELIVERY_DAYS} zile lucrătoare de la expediere`}
            right={freeShipping ? (
            <span className="flex flex-col items-end leading-tight">
              <span className="text-[#4ADE80]">Gratuită</span>
              <span className="text-xs font-normal text-[#A0A0A0] line-through">{fmtRON(RO_SHIPPING_FEE_RON)}</span>
            </span>
          ) : fmtRON(shippingCost)}
          />
        </div>
      </CoSection>

      {delivery === "office" && (
        <CoField
          id="field-officeAddress" htmlFor="ro-officeAddress" label="Adresa biroului Econt" error={errors.officeAddress} errorId="ro-officeAddress-err"
          hint="Scrieți orașul și adresa biroului Econt la care doriți să ridicați coletul."
        >
          <input type="text" placeholder="Econt Cluj-Napoca, Str. Exemplu 5" value={form.officeAddress} maxLength={200}
            onChange={(e) => { set("officeAddress", e.target.value); clearError("officeAddress"); }}
            className={coInput(!!errors.officeAddress)} autoComplete="off" {...fieldProps("officeAddress")} />
        </CoField>
      )}

      {/* ── Payment: ramburs (default) or card (only while the card option is switched on) ── */}
      {CARD_PAYMENTS_ENABLED ? (
        <CoSection title="Metodă de plată">
          <div role="radiogroup" aria-label="Metodă de plată" className="flex flex-col gap-2.5">
            <CoRadioCard
              name="ro-payment" value="cod" selected={!isCardPay}
              onSelect={() => { if (!submitting) setPayMethod("cod"); }}
              title="Plata la livrare (ramburs)"
              subtitle="Plătiți curierului la primirea coletului"
              right={fmtRON(codTotal)}
            />
            <CoRadioCard
              name="ro-payment" value="card" selected={isCardPay}
              onSelect={() => { if (!submitting) setPayMethod("card"); }}
              title="Plata cu cardul"
              subtitle="Livrare gratuită"
              right={fmtRON(cardTotal)}
            >
              <PaymentMarks label="Carduri și portofele acceptate" />
              {isCardPay && (
                <SecureNote>Plata este procesată în siguranță de Stripe. Nu stocăm datele cardului.</SecureNote>
              )}
            </CoRadioCard>
          </div>
        </CoSection>
      ) : (
        <CoSection title="Metodă de plată">
          <CoRadioCard
            name="ro-payment" value="cod" selected onSelect={() => {}}
            title="Plata la livrare (ramburs)"
            subtitle={`Plătiți curierului suma de ${fmtRON(grandTotal)} la primirea coletului.`}
            right={fmtRON(grandTotal)}
          />
        </CoSection>
      )}

      </>)}

      {submitError && (
        <div role="alert" className="flex flex-col items-center gap-2 rounded-[6px] border border-[#7A2A22] bg-[#2A1210] px-4 py-3 text-center font-sans text-[13px] leading-relaxed text-[#F87171]">
          <p>{submitError}</p>
          {reloadHint && (
            <>
              <p className="text-[#FCA5A5]">{reloadHint}</p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-[6px] border border-[#F87171]/50 px-4 py-2 font-sans text-xs font-medium text-[#F87171] transition-colors hover:bg-[#F87171]/10"
              >
                Reîncărcați pagina
              </button>
            </>
          )}
        </div>
      )}

      {needsPrepayment ? (
        <div className="flex flex-col gap-3 rounded-[8px] border border-[#606060] bg-[#141414] px-5 py-5 text-center">
          <p className="font-sans text-sm leading-relaxed text-[#C9C9C9]">
            Produsele cu prețul de la {PREPAYMENT_THRESHOLD_TEXT} în sus se comandă cu plată în avans, stabilită direct cu noi -
            plata la livrare (ramburs) nu este disponibilă pentru această comandă. Vă rugăm să ne contactați pentru a finaliza comanda.
          </p>
          <a
            href={PREPAYMENT_VIBER_LINK}
            onClick={handleViberContactClick}
            className="flex h-14 w-full items-center justify-center rounded-[6px] bg-[#0F2850] px-6 font-sans text-base font-medium text-white transition-colors hover:bg-[#1A3A6B]"
          >
            Contactați-ne pe Viber
          </a>
          <p className="font-sans text-xs text-[#A0A0A0]">
            sau la telefon <span className="font-medium text-white">{PREPAYMENT_PHONE}</span>
          </p>
          <p className="font-sans text-xs text-[#A0A0A0]">
            sau prin e-mail la{" "}
            <a href={`mailto:${PREPAYMENT_EMAIL}`} className="font-medium text-white underline underline-offset-2">
              {PREPAYMENT_EMAIL}
            </a>
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-3">
            <CoSubmit busy={submitting} busyLabel={redirecting ? "Vă redirecționăm către plată..." : isCardPay ? "Se pregătește plata..." : "Se trimite comanda..."}>
              {isCardPay ? `Plătiți ${fmtRON(grandTotal)}` : `Finalizați comanda · ${fmtRON(grandTotal)}`}
            </CoSubmit>
            <CoLegal>
              Plasând comanda, ești de acord cu{" "}
              <a href="/ro/politici/termeni" target="_blank" rel="noopener noreferrer" className={coLegalLink}>Termenii și condițiile</a>{" "}
              și cu{" "}
              <a href="/ro/politici/confidentialitate" target="_blank" rel="noopener noreferrer" className={coLegalLink}>Politica de confidențialitate</a>.
            </CoLegal>
          </div>

          <CoTrust
            points={[
              "5 ani garanție la ceasuri",
              `Retur în ${RO_RETURN_DAYS} zile`,
              ...(!isCardPay && RO_INSPECT_BEFORE_PAY ? ["Inspecție înainte de plată"] : []),
            ]}
            links={[
              { href: "/ro/politici/termeni", label: "Termeni" },
              { href: "/ro/politici/retur", label: "Retur" },
              { href: "/ro/politici/livrare", label: "Livrare" },
              { href: "/ro/politici/confidentialitate", label: "Confidențialitate" },
            ]}
          />
        </div>
      )}
    </form>
  );
}
