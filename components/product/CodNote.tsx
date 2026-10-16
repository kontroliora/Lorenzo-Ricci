import { Banknote } from "lucide-react";

// Pay on delivery, said right where the customer decides: a box under the price and one line under the order button.
// BG: cash on delivery + the parcel can be inspected before paying (Econt). RO: plata la livrare (ramburs); the inspection promise is
// not made in Romania until the courier confirms it (lib/ro/config.ts RO_INSPECT_BEFORE_PAY). Not shown for a prepayment product.
export function CodBox({ title, sub }: { title: string; sub: string }) {
  return (
    <div data-testid="cod-box" className="flex items-start gap-3 border border-navy/25 bg-navy/[0.04] px-4 py-3">
      <Banknote className="mt-0.5 h-5 w-5 flex-shrink-0 text-navy" strokeWidth={1.5} aria-hidden />
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="font-sans text-[14px] font-medium leading-snug text-charcoal">{title}</span>
        <span className="font-sans text-[13px] font-normal leading-snug text-ink-soft">{sub}</span>
      </div>
    </div>
  );
}

export function CodLine({ text }: { text: string }) {
  return <p data-testid="cod-line" className="text-center font-sans text-[13px] font-normal leading-snug text-ink-soft">{text}</p>;
}
