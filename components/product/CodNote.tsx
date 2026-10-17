// How to pay, said right where the customer decides: ONE short line under the price (the card marks beside it while the card is on) and one line
// under the order button. Not shown for a prepayment product. The card is a payment option for everybody (NEXT_PUBLIC_CARD_PAYMENTS=1); with it
// switched off the line says only cash on delivery.
const MARKS = [["visa", "Visa"], ["mastercard", "Mastercard"], ["apple-pay", "Apple Pay"], ["google-pay", "Google Pay"]] as const;

function PayMarks({ label }: { label: string }) {
  return (
    <span data-testid="card-marks" aria-label={label} className="flex items-center gap-1">
      {MARKS.map(([file, alt]) => (
        <span key={file} className="inline-flex h-[20px] w-[32px] items-center justify-center rounded-[3px] border border-charcoal/10 bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/brand/${file}.svg`} alt={alt} width={24} height={11} style={{ objectFit: "contain", height: 11, width: 24 }} />
        </span>
      ))}
    </span>
  );
}

export function PayLine({ text, marks, marksLabel }: { text: string; marks: boolean; marksLabel?: string }) {
  return (
    <div data-testid="pay-line" className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <span className="font-sans text-[14px] font-medium leading-snug text-charcoal">{text}</span>
      {marks && <PayMarks label={marksLabel ?? "Visa, Mastercard, Apple Pay, Google Pay"} />}
    </div>
  );
}

export function CodLine({ text }: { text: string }) {
  return <p data-testid="cod-line" className="text-center font-sans text-[13px] font-normal leading-snug text-ink-soft">{text}</p>;
}
