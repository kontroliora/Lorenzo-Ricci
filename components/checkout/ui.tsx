"use client";
// Presentational pieces of the checkout panel (Bulgarian and Romanian forms share them). Visual only: no prices, stock or payment
// logic lives here - the forms compute everything and pass in finished strings.
//
// Look: light panel, clean sans-serif, 48 px fields with the label ABOVE and the error BELOW the field, radio cards, an order summary
// with photos at the top. Nothing decorative that is not true: no security seals, no counters, no timers.
import Image from "next/image";
import { useState, type ReactNode } from "react";

// Dark theme of the cart and the site: panel #0A0A0A (charcoal-deep), surfaces #141414, lines #2F2F2F / #606060 (fields and cards: >= 3:1),
// gold #C9A84C as the accent, navy #0F2850 button, text white / #C9C9C9 / #A0A0A0 (all >= 4.5:1). Written out as literal classes on purpose:
// Tailwind only generates classes it can read in the source, so they cannot be built from variables.

/** Input / select / textarea look. `invalid` turns the border red (the message itself is shown by CoField). */
export const coInput = (invalid?: boolean): string =>
  `block w-full min-h-12 rounded-[6px] bg-[#141414] px-3.5 [color-scheme:dark] font-sans text-[15px] font-normal text-white placeholder:text-[#9A9A9A] border transition-colors focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/25 ${
    invalid ? "border-[#F87171] focus:border-[#F87171]" : `border-[#6B6B6B] hover:border-[#8A8A8A] focus:border-[#C9A84C]`
  }`;

// ── Field: label above, message below ───────────────────────────────────────
export function CoField({
  id, htmlFor, label, optional, optionalText = "(по желание)", hint, error, errorId, children,
}: {
  id?: string;        // wrapper id (the forms scroll to it when validation fails)
  htmlFor?: string;   // id of the control this label belongs to
  label: string;
  optional?: boolean;
  optionalText?: string; // wording of the "optional" marker (the Romanian form passes Romanian)
  hint?: string;
  error?: string;
  errorId?: string;   // id the control's aria-describedby points at
  children: ReactNode;
}) {
  return (
    <div id={id} className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="font-sans text-[13px] font-medium text-[#E6E6E6]">
        {label}
        {optional && <span className="ml-1 font-normal text-[#A0A0A0]">{optionalText}</span>}
      </label>
      {children}
      {hint && !error && <p className="font-sans text-xs text-[#A0A0A0]">{hint}</p>}
      {error && (
        <p id={errorId} role="alert" className="flex items-start gap-1.5 font-sans text-[13px] font-normal text-[#F87171]">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden className="mt-[3px] flex-shrink-0">
            <circle cx="8" cy="8" r="7" stroke="#B42318" strokeWidth="1.5" />
            <path d="M8 4.5v4" stroke="#B42318" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="8" cy="11" r="0.9" fill="#B42318" />
          </svg>
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

/** Marketing / terms checkbox with a readable label. */
export function CoCheck({
  checked, onChange, children, id, invalid, describedBy,
}: {
  checked: boolean; onChange: (v: boolean) => void; children: ReactNode; id?: string; invalid?: boolean; describedBy?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
        className={`mt-[1px] h-[18px] w-[18px] flex-shrink-0 cursor-pointer rounded-[3px] accent-[#C9A84C] ${invalid ? "outline outline-2 outline-[#F87171]" : ""}`}
      />
      <span className="font-sans text-[13px] font-normal leading-snug text-[#C9C9C9]">{children}</span>
    </label>
  );
}

// ── Section heading ─────────────────────────────────────────────────────────
export function CoSection({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h4 className="font-sans text-[15px] font-semibold tracking-normal text-white">{title}</h4>
        {aside}
      </div>
      {children}
    </section>
  );
}

// ── Radio card (delivery and payment choices) ───────────────────────────────
export function CoRadioCard({
  name, value, selected, onSelect, icon, title, subtitle, right, children,
}: {
  name: string; value: string; selected: boolean; onSelect: () => void;
  icon?: ReactNode; title: string; subtitle?: string; right?: ReactNode; children?: ReactNode;
}) {
  return (
    <label
      className={`flex cursor-pointer flex-col gap-3 rounded-[8px] border p-4 transition-colors focus-within:ring-2 focus-within:ring-[#C9A84C]/30 ${
        selected ? `border-[#C9A84C] bg-[#1B180D] ring-1 ring-[#C9A84C]` : "border-[#606060] bg-[#101010] hover:border-[#8A8A8A]"
      }`}
    >
      <div className="flex items-start gap-3">
        <input type="radio" name={name} value={value} checked={selected} onChange={onSelect} className="sr-only" />
        <span
          aria-hidden
          className={`mt-[3px] flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full border-2 ${selected ? `border-[#C9A84C]` : "border-[#8A8A8A]"}`}
        >
          {selected && <span className="h-2 w-2 rounded-full bg-[#C9A84C]" />}
        </span>
        {icon && <span className="mt-[1px] flex-shrink-0 text-[#C9C9C9]">{icon}</span>}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-sans text-[15px] font-medium leading-snug text-white">{title}</span>
          {subtitle && <span className="font-sans text-[13px] font-normal leading-snug text-[#B0B0B0]">{subtitle}</span>}
        </div>
        {right && <div className="flex-shrink-0 text-right font-sans text-[15px] font-medium text-white">{right}</div>}
      </div>
      {children}
    </label>
  );
}

// ── Small icons ─────────────────────────────────────────────────────────────
export const IconOffice = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z" />
    <circle cx="12" cy="9.5" r="2.5" />
  </svg>
);
export const IconHome = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3 11.5 12 4l9 7.5" />
    <path d="M5.5 10v10h13V10" />
    <path d="M10 20v-5h4v5" />
  </svg>
);
export const IconLock = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
    <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
  </svg>
);

// ── Brand marks ─────────────────────────────────────────────────────────────
// The logo files live in /public/brand/<name>.svg (sources in public/brand/SOURCES.txt): the Econt logo exactly as published by Econt,
// the card / wallet marks from simple-icons in their brand colour. Never redrawn here. If a file is missing the mark shows its plain
// name as a neutral label.
export type BrandName = "econt" | "visa" | "mastercard" | "apple-pay" | "google-pay";
const BRAND_LABEL: Record<BrandName, string> = { econt: "Еконт", visa: "Visa", mastercard: "Mastercard", "apple-pay": "Apple Pay", "google-pay": "Google Pay" };

export function BrandMark({ name, height = 20 }: { name: BrandName; height?: number }) {
  const [missing, setMissing] = useState(false);
  const label = BRAND_LABEL[name];
  // Every mark sits on a small light tile (white, rounded corners) so it reads on the dark panel.
  if (missing) {
    return <span className="inline-flex items-center rounded-[6px] bg-white px-2 font-sans text-[11px] font-medium text-[#4A463E]" style={{ height: 28 }}>{label}</span>;
  }
  if (name === "econt") {
    return (
      <span className="inline-flex items-center rounded-[6px] bg-white px-2.5 py-1.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/econt.svg" alt={label} height={height} style={{ height, width: "auto" }} onError={() => setMissing(true)} />
      </span>
    );
  }
  return (
    <span className="inline-flex h-8 w-[54px] items-center justify-center rounded-[6px] bg-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/brand/${name}.svg`} alt={label} width={38} height={18} style={{ objectFit: "contain" }} onError={() => setMissing(true)} />
    </span>
  );
}

export function PaymentMarks({ label }: { label: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label={label}>
      {(["visa", "mastercard", "apple-pay", "google-pay"] as const).map((n) => <BrandMark key={n} name={n} />)}
    </div>
  );
}

/** "Secure payment" line under the card marks. */
export function SecureNote({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 font-sans text-[13px] font-normal leading-snug text-[#C9C9C9]">
      <span className="mt-[2px] flex-shrink-0 text-[#C9C9C9]"><IconLock /></span>
      <span>{children}</span>
    </p>
  );
}

// ── Order summary (top of the panel) ────────────────────────────────────────
export type SummaryLine = {
  key: string;
  image?: string;
  imageAlt?: string;
  name: string;
  detail?: string;      // e.g. the free-gift note
  quantity: number;
  price: string;        // already formatted line total
  compareAt?: string;   // already formatted crossed-out line total while on sale
  gift?: boolean;
};
export type SummaryRow = { key: string; label: string; value: string; tone?: "discount" | "free" };

export function CoSummary({
  lines, rows, totalLabel, total, toggleLabel, hideLabel,
}: {
  lines: SummaryLine[]; rows: SummaryRow[]; totalLabel: string; total: string;
  toggleLabel: string; // phone toggle text, e.g. "Покажи поръчката"
  hideLabel: string;   // ... and when it is open, e.g. "Скрий поръчката"
}) {
  const [open, setOpen] = useState(false); // phones start collapsed; from 640 px up the summary is always open
  return (
    <div className="overflow-hidden rounded-[8px] border border-[#2F2F2F] bg-[#141414]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left sm:hidden"
      >
        <span className="flex items-center gap-2 font-sans text-sm font-medium text-[#D4AF37]">
          {open ? hideLabel : toggleLabel}
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden className={`transition-transform ${open ? "rotate-180" : ""}`}>
            <path d="M2 4.5 6 8l4-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span className="font-serif text-lg text-white">{total}</span>
      </button>

      <div className={`${open ? "block" : "hidden"} border-t border-[#2F2F2F] sm:block sm:border-t-0`}>
        <ul className="flex flex-col gap-3.5 px-4 pt-4 pb-3">
          {lines.map((l) => (
            <li key={l.key} className="flex items-center gap-3">
              <div className="relative h-16 w-14 flex-shrink-0 overflow-visible">
                <div className="relative h-full w-full overflow-hidden rounded-[6px] border border-[#2F2F2F] bg-white">
                  {l.image ? (
                    <Image src={l.image} alt={l.imageAlt ?? l.name} fill quality={70} sizes="56px" className="object-cover object-center" />
                  ) : null}
                </div>
                <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#3A3A3A] px-1 font-sans text-[11px] font-medium text-white">
                  {l.quantity}
                </span>
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className={`font-serif text-base leading-snug ${l.gift ? "text-[#4ADE80]" : "text-white"}`}>{l.name}</span>
                {l.detail && <span className="font-sans text-xs text-[#A0A0A0]">{l.detail}</span>}
              </div>
              <div className="flex flex-shrink-0 flex-col items-end">
                <span className={`font-serif text-base ${l.gift ? "text-[#4ADE80]" : "text-white"}`}>{l.price}</span>
                {l.compareAt && <span className="font-sans text-xs text-[#A0A0A0] line-through">{l.compareAt}</span>}
              </div>
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-2 border-t border-[#2F2F2F] px-4 py-3.5">
          {rows.map((r) => (
            <div key={r.key} className="flex items-baseline justify-between gap-3 font-sans text-sm">
              <span className={r.tone === "discount" ? "text-[#4ADE80]" : "text-[#C9C9C9]"}>{r.label}</span>
              <span className={`font-medium ${r.tone === "discount" || r.tone === "free" ? "text-[#4ADE80]" : "text-white"}`}>{r.value}</span>
            </div>
          ))}
        </div>

        <div className="flex items-baseline justify-between gap-3 border-t border-[#2F2F2F] px-4 py-3.5">
          <span className="font-sans text-[15px] font-semibold text-white">{totalLabel}</span>
          <span className="font-serif text-2xl text-white">{total}</span>
        </div>
      </div>
    </div>
  );
}

// ── Submit button and the calm trust block under it ─────────────────────────
export function CoSubmit({ busy, busyLabel, children }: { busy: boolean; busyLabel: string; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className={`flex h-14 w-full items-center justify-center gap-2 rounded-[6px] bg-[#0F2850] px-6 font-sans text-base font-medium text-white transition-colors hover:bg-[#1A3A6B] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {busy ? (
        <>
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          {busyLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}

/** Small agreement line directly under the order button (no checkbox): the text and its links come from the caller. */
export const coLegalLink = "font-medium text-[#E6E6E6] underline decoration-[#8A8A8A] underline-offset-2 hover:text-white";
export function CoLegal({ children }: { children: ReactNode }) {
  return <p className="px-1 text-center font-sans text-xs font-normal leading-relaxed text-[#A0A0A0]">{children}</p>;
}

export function CoTrust({
  points, note, links,
}: {
  points: string[]; note?: string; links: { href: string; label: string }[];
}) {
  return (
    <div className="flex flex-col items-center gap-2.5 text-center">
      <p className="font-sans text-[13px] font-normal leading-relaxed text-[#C9C9C9]">{points.join("  ·  ")}</p>
      {note && <p className="font-sans text-xs text-[#A0A0A0]">{note}</p>}
      <p className="font-sans text-xs text-[#A0A0A0]">
        {links.map((l, i) => (
          <span key={l.href}>
            {i > 0 && <span aria-hidden className="mx-2 text-[#A0A0A0]">|</span>}
            <a href={l.href} target="_blank" rel="noopener noreferrer" className="underline decoration-[#8A8A8A] underline-offset-2 hover:text-white">{l.label}</a>
          </span>
        ))}
      </p>
    </div>
  );
}

