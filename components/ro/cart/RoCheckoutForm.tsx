"use client";
import { useEffect, useRef, useState } from "react";
import type { RoCartLine } from "@/lib/ro/store";
import { roAmounts } from "@/lib/ro/pricing";
import { RO_COUNTIES } from "@/lib/ro/counties";
import {
  RO_DELIVERY_DAYS,
  RO_RETURN_DAYS,
  RO_SHIPPING_FEE_RON,
  RO_SHIPPING_HOME,
  RO_SHIPPING_OFFICE,
  fmtRON,
} from "@/lib/ro/config";
import { trackFbEvent, rememberMatchKeys } from "@/lib/fbq";
import { logCheckoutFailure } from "@/lib/checkout-log";
import { CARD_PAYMENTS_ENABLED, PENDING_ORDER_KEY } from "@/lib/payments";
import { newOrderRef } from "@/lib/order-ref";
import {
  CoCheck, CoField, CoLegal, CoRadioCard, CoSection, CoSubmit, CoSummary, CoTrust, IconHome, IconOffice, PaymentMarks, SecureNote, coInput,
  coLegalLink, type SummaryLine, type SummaryRow,
} from "@/components/checkout/ui";
import { PREPAYMENT_THRESHOLD_TEXT, bundleLineLabel } from "./shared";

// Romania checkout: CARD ONLY, through Stripe Checkout (owner, 25.10.2026: no cash on delivery / ramburs in Romania; /api/order-ro
// refuses anything else). Port of components/cart/CheckoutForm.tsx: same look, GDPR-clean consent (nothing pre-ticked). All money
// comes from lib/ro/pricing.ts roAmounts, the same function /api/order-ro uses, so the server agrees to the leu; no card discount
// in Romania. The success screen, the cart clearing and the Purchase event live on the return page (/ro/comanda/finalizata).
// If the card option is switched off (NEXT_PUBLIC_CARD_PAYMENTS), the form says ordering is unavailable instead of offering a button.
//
// A cart holding a product that needs advance payment (EUR 1500 and up, line.prepay) gets NO order form: like the
// Bulgarian checkout, it shows the interim contact flow (Viber / phone / e-mail), the order is arranged with the shop.

const SHIPPING_LABEL = "Livrare la domiciliu cu curierul"; // what the customer reads (the API receives RO_SHIPPING_HOME / RO_SHIPPING_OFFICE)
type Delivery = "home" | "office";

// What the customer is told is missing (the field names in the red summary above the button).
const FIELD_LABEL_RO: Record<string, string> = { name: "Nume complet", phone: "Telefon", email: "E-mail", county: "Județ", city: "Localitate", address: "Adresă", postCode: "Cod poștal", officeAddress: "Adresa lockerului sau a biroului Speedy" };

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
}

type FormState = {
  name: string;
  phone: string;
  email: string;
  county: string;
  city: string;
  address: string;
  officeAddress: string;   // Speedy locker / office (delivery to a pick-up point): typed by hand
  postCode: string;
  notes: string;
  smsMarketingConsent: boolean;
  emailMarketingConsent: boolean;
};

export function RoCheckoutForm({ items }: RoCheckoutFormProps) {
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
  const [formSummary, setFormSummary] = useState("");   // red line above the button: what stopped the order (never a silent button)
  const [redirecting, setRedirecting] = useState(false);
  const [delivery, setDelivery] = useState<Delivery>("home");
  const submittingRef = useRef(false);
  const cartSessionRef = useRef("");   // id of the saved cart (abandoned-cart reminder), created on the first capture
  const captureTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Meta matching: keep the SHA-256 of a whole e-mail / mobile number (never the plain value) for the next ad events.
  useEffect(() => {
    const t = setTimeout(() => { void rememberMatchKeys({ email: form.email, phone: form.phone }, "ro"); }, 800);
    return () => clearTimeout(t);
  }, [form.email, form.phone]);

  // Coming back from the Stripe page with the browser's back button can restore this page frozen in the redirecting
  // state; unlock the form so the customer can retry.
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
  const { shipping: shippingCost, total: grandTotal, bundles } = roAmounts(items);
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
    if (delivery === "home") {
      // delivery to an address: județ, localitate, address, post code. A Speedy locker / office needs none of them: its typed address says it all.
      if (!RO_COUNTIES.includes(form.county)) errs.county = "Alegeți județul.";
      if (form.city.trim().length < 2) errs.city = "Introduceți localitatea.";
      if (form.address.trim().length < 5) errs.address = "Introduceți adresa completă (stradă, număr, bloc/scară/apartament).";
      const postCode = form.postCode.replace(/\s/g, "");
      if (postCode && !/^\d{6}$/.test(postCode)) errs.postCode = "Codul poștal are 6 cifre.";
    } else if (form.officeAddress.trim().length < 5) {
      errs.officeAddress = "Introduceți adresa lockerului sau a biroului Speedy.";
    }
    return errs;
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current || needsPrepayment || !CARD_PAYMENTS_ENABLED) return; // advance-payment carts are arranged with the shop, never posted

    const errs = validate();
    if (Object.keys(errs).length > 0) {
      const keys = Object.keys(errs);
      setErrors(errs);
      setFormSummary(`Comanda nu a fost trimisă. Verificați: ${keys.map((k) => FIELD_LABEL_RO[k] ?? k).join(", ")}.`);
      logCheckoutFailure({ market: "ro", kind: "validation", fields: keys, delivery, sessionId: cartSessionRef.current || undefined });
      // Take the customer to the first problem (the message sits right at it); if that element is missing, the red summary above
      // the button is shown instead: the button never "does nothing".
      setTimeout(() => {
        for (const k of keys) {
          const box = document.getElementById(`field-${k}`);
          if (!box) continue;
          (document.getElementById(`ro-${k}-err`) ?? box).scrollIntoView({ behavior: "smooth", block: "center" });
          (document.getElementById(`ro-${k}`) ?? box.querySelector<HTMLElement>("input, select, textarea"))?.focus({ preventScroll: true });
          return;
        }
        document.getElementById("ro-form-summary")?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 80);
      return;
    }
    setFormSummary("");
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
    const amounts = roAmounts(lines);
    const phone = normalizeRoPhone(form.phone) as string;
    const email = form.email.trim();

    const payload = {
      orderRef: ref,
      customer: {
        name: form.name.trim().replace(/\s+/g, " "),
        phone,
        email,
        county: delivery === "home" ? form.county : "",
        city: delivery === "home" ? form.city.trim() : "",
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
      subtotal: amounts.goods,                                 // goods AFTER the set discount (before the card discount)
      cardDiscount: amounts.cardDiscount,                      // always 0: Romania has no card discount (the server checks it)
      total: amounts.total,
      paymentMethod: "card",                                   // the only payment method in Romania
      timestamp: new Date().toISOString(),
    };

    const fail = (msg: string, reload = "", log?: { code?: string; status?: number; kind?: "server" | "network" }) => {
      logCheckoutFailure({ market: "ro", kind: log?.kind ?? "server", code: log?.code, status: log?.status, delivery, sessionId: cartSessionRef.current || undefined });
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
      fail(NETWORK_ERROR, "", { kind: "network" });
      return;
    }

    let body: { success?: boolean; code?: string; error?: string; paymentMethod?: string; checkoutUrl?: string; orderRef?: string } | null = null;
    try { body = await res.json(); } catch { /* an unreadable body doesn't undo an accepted order (see below) */ }

    if (!res.ok || body?.success === false) {
      const serverMsg = typeof body?.error === "string" ? body.error.trim() : "";
      const lg = { code: typeof body?.code === "string" ? body.code : undefined, status: res.status };
      if (body?.code === "price_mismatch") fail(serverMsg || PRICE_MISMATCH_ERROR, PRICE_RELOAD_HINT, lg);
      // A stale cart without the advance-payment flag: a reload refreshes the lines and the checkout then shows the contact flow.
      else if (body?.code === "prepayment_required") fail(serverMsg || FALLBACK_ERROR, CART_RELOAD_HINT, lg);
      // An old page that still sent another payment method: a reload brings the card-only checkout.
      else if (body?.code === "card_only") fail(serverMsg || FALLBACK_ERROR, CART_RELOAD_HINT, lg);
      else fail(serverMsg || FALLBACK_ERROR, "", lg);
      return;
    }

    // Nothing is final until Stripe confirms the payment. No success screen, no cart clearing, no Purchase here:
    // the return page (/ro/comanda/finalizata) does those once the payment is confirmed. Park the order reference and
    // go to Stripe; the form stays locked in the "redirecting" state meanwhile.
    const url = typeof body?.checkoutUrl === "string" ? body.checkoutUrl : "";
    if (body?.success !== true || body.paymentMethod !== "card" || !/^https?:\/\//i.test(url)) {
      fail(FALLBACK_ERROR);
      return;
    }
    const pendingRef = typeof body.orderRef === "string" && body.orderRef ? body.orderRef : ref;
    try { sessionStorage.setItem(PENDING_ORDER_KEY, pendingRef); } catch { /* private mode: the return page reads ?ref= */ }
    setRedirecting(true);
    window.location.assign(url);
  };

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
        {needsPrepayment && <p className="mt-1 font-sans text-sm text-[#B0B0B0]">Se stabilește direct cu noi</p>}
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

      {/* ── Delivery (single option, shown as the selected card) ──────────── */}
      <CoSection title="Mod de livrare">
        <div role="radiogroup" aria-label="Mod de livrare" className="flex flex-col gap-2.5">
          <CoRadioCard
            name="ro-delivery" value="home" selected={delivery === "home"}
            onSelect={() => { setDelivery("home"); setErrors({}); setFormSummary(""); }}
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
            onSelect={() => { setDelivery("office"); setErrors({}); setFormSummary(""); }}
            icon={<IconOffice />}
            title="Livrare la locker / birou Speedy"
            subtitle={`Ridicați de la locker sau birou · ${RO_DELIVERY_DAYS} zile lucrătoare de la expediere`}
            right={freeShipping ? (
            <span className="flex flex-col items-end leading-tight">
              <span className="text-[#4ADE80]">Gratuită</span>
              <span className="text-xs font-normal text-[#A0A0A0] line-through">{fmtRON(RO_SHIPPING_FEE_RON)}</span>
            </span>
          ) : fmtRON(shippingCost)}
          />
        </div>
      </CoSection>

        {delivery === "home" ? (<>
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
        </>) : (
        <CoField
          id="field-officeAddress" htmlFor="ro-officeAddress" label="Adresa lockerului sau a biroului Speedy" error={errors.officeAddress} errorId="ro-officeAddress-err"
          hint="ex. Speedy București, Bd. Iuliu Maniu 7"
        >
          <input type="text" placeholder="Speedy București, Bd. Iuliu Maniu 7" value={form.officeAddress} maxLength={200}
            onChange={(e) => { set("officeAddress", e.target.value); clearError("officeAddress"); }}
            className={coInput(!!errors.officeAddress)} autoComplete="off" {...fieldProps("officeAddress")} />
        </CoField>
      )}

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

      {/* ── Payment: card only (Romania has no cash on delivery) ── */}
      <CoSection title="Metodă de plată">
        {CARD_PAYMENTS_ENABLED ? (
          <CoRadioCard
            name="ro-payment" value="card" selected onSelect={() => {}}
            title="Plata cu cardul"
            subtitle="Plată online securizată prin Stripe, în lei. Nu aveți nimic de plătit la livrare."
            right={fmtRON(grandTotal)}
          >
            <PaymentMarks label="Carduri și portofele acceptate" />
            <SecureNote>Plata este procesată în siguranță de Stripe. Nu stocăm datele cardului.</SecureNote>
          </CoRadioCard>
        ) : (
          <p role="status" className="rounded-[8px] border border-[#606060] bg-[#141414] px-4 py-4 font-sans text-sm leading-relaxed text-[#C9C9C9]">
            Plata cu cardul nu este disponibilă momentan, de aceea nu se pot plasa comenzi. Vă rugăm să reveniți puțin mai târziu sau să ne scrieți la{" "}
            <a href={`mailto:${PREPAYMENT_EMAIL}`} className="font-medium text-white underline underline-offset-2">{PREPAYMENT_EMAIL}</a>.
          </p>
        )}
      </CoSection>

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
            Produsele cu prețul de la {PREPAYMENT_THRESHOLD_TEXT} în sus se comandă cu plată în avans, stabilită direct cu noi.
            Vă rugăm să ne contactați pentru a finaliza comanda.
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
      ) : CARD_PAYMENTS_ENABLED && (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-3">
            {formSummary && (
              <div id="ro-form-summary" role="alert" className="rounded-[6px] border border-[#7A2A22] bg-[#2A1210] px-4 py-3 text-center font-sans text-[13px] leading-relaxed text-[#F87171]">
                {formSummary}
              </div>
            )}
            <CoSubmit busy={submitting} busyLabel={redirecting ? "Vă redirecționăm către plată..." : "Se pregătește plata..."}>
              {`Plătiți ${fmtRON(grandTotal)}`}
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
