// The lines right under the product-page price (BG and RO): what a discounted product saves, with the running campaign's badge,
// and one delivery line. The pages decide the text and when to show them (savings: on sale and not sold out).
// Colours pass WCAG AA on the page's ivory: green 6.1, white on the badge red 6.6, ink-soft 9.3.

export function SavingsLine({ text, campaign }: { text: string; campaign: string | null }) {
  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <span data-testid="page-savings" className="font-sans text-[15px] sm:text-[16px] font-medium leading-snug text-[#2E6B3F]">{text}</span>
      {campaign && (
        <span data-testid="page-campaign" className="bg-[#B3121F] text-white font-sans text-[11px] font-medium tracking-[0.14em] uppercase leading-none px-2.5 py-1.5">
          {campaign}
        </span>
      )}
    </div>
  );
}

export function DeliveryLine({ text }: { text: string }) {
  return <p data-testid="delivery-line" className="-mt-3 font-sans text-[13px] leading-snug text-ink-soft">{text}</p>;
}
