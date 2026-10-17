import { Banknote, CreditCard } from "lucide-react";

// How to pay, said right where the customer decides: ONE box under the price with two rows, and one line under the order button.
//   row 1: cash on delivery (BG: + the parcel can be inspected before paying; RO: plata la livrare, no inspection promise until the courier
//          confirms it - lib/ro/config.ts RO_INSPECT_BEFORE_PAY);
//   row 2: "or by card - 5% off" (lib/card-discount.ts) with the small Visa / Mastercard / Apple Pay / Google Pay marks.
// Not shown for a prepayment product.
const MARKS = [["visa", "Visa"], ["mastercard", "Mastercard"], ["apple-pay", "Apple Pay"], ["google-pay", "Google Pay"]] as const;

function PayMarks({ label }: { label: string }) {
  return (
    <span data-testid="card-marks" aria-label={label} className="flex items-center gap-[3px]">
      {MARKS.map(([file, alt]) => (
        <span key={file} className="inline-flex h-[17px] w-[25px] items-center justify-center rounded-[3px] border border-charcoal/10 bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/brand/${file}.svg`} alt={alt} width={18} height={8} style={{ objectFit: "contain", height: 8, width: 18 }} />
        </span>
      ))}
    </span>
  );
}

export function CodBox({ title, sub, cardText, marksLabel }: { title: string; sub: string; cardText?: string; marksLabel?: string }) {
  return (
    <div data-testid="cod-box" className="flex flex-col gap-2.5 border border-navy/25 bg-navy/[0.04] px-4 py-3">
      <div className="flex items-start gap-3">
        <Banknote className="mt-0.5 h-5 w-5 flex-shrink-0 text-navy" strokeWidth={1.5} aria-hidden />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="font-sans text-[14px] font-medium leading-snug text-charcoal">{title}</span>
          <span className="font-sans text-[13px] font-normal leading-snug text-ink-soft">{sub}</span>
        </div>
      </div>
      {cardText && (
        <div data-testid="cod-box-card" className="flex items-center gap-3 border-t border-navy/15 pt-2.5">
          <CreditCard className="h-5 w-5 flex-shrink-0 text-navy" strokeWidth={1.5} aria-hidden />
          <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
            <span className="font-sans text-[13px] font-medium leading-snug text-charcoal">{cardText}</span>
            <PayMarks label={marksLabel ?? "Visa, Mastercard, Apple Pay, Google Pay"} />
          </div>
        </div>
      )}
    </div>
  );
}

export function CodLine({ text }: { text: string }) {
  return <p data-testid="cod-line" className="text-center font-sans text-[13px] font-normal leading-snug text-ink-soft">{text}</p>;
}
