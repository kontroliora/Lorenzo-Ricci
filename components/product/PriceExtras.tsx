// The lines right under the product-page price (BG and RO): what a discounted product saves, with the running campaign's badge
// and the free-delivery badge, and one delivery line. The pages decide the text and when to show them (savings: on sale and not sold out).
// Colours pass WCAG AA on the page's ivory: green 6.1, white on the badge red 6.6, white on the free-delivery green 5.4, ink-soft 9.3.
import { Truck } from "lucide-react";

const PAGE_BADGE = "inline-flex items-center whitespace-nowrap text-white font-sans text-[11px] font-medium tracking-[0.14em] uppercase leading-none px-2.5 py-1.5";

/**
 * The green free-delivery badge: "page" sits in the badge row under the product-page price (same size as the red campaign badge),
 * "card" is the small one under a card's price. The caller decides when it shows (lib/shipping-rules.ts bgShipsFree / lib/ro/config.ts roShipsFree).
 */
export function FreeShippingBadge({ text, size }: { text: string; size: "page" | "card" }) {
  return size === "page" ? (
    <span data-testid="page-free-shipping" className={`${PAGE_BADGE} gap-1.5 bg-[#1F7A3A]`}>
      <Truck aria-hidden className="h-3 w-3 shrink-0" strokeWidth={2} />
      {text}
    </span>
  ) : (
    <span data-testid="card-free-shipping" className="inline-flex items-center gap-1 self-start whitespace-nowrap bg-[#1F7A3A] text-white font-sans text-[11px] font-medium leading-none px-1.5 py-1">
      <Truck aria-hidden className="h-3 w-3 shrink-0" strokeWidth={2} />
      {text}
    </span>
  );
}

/** The saving (only on sale) and the badges after it: the running campaign's red one (only with a saving) and the green free-delivery one. */
export function SavingsLine({ text, campaign, freeShipping = null }: { text: string | null; campaign: string | null; freeShipping?: string | null }) {
  if (text === null && !freeShipping) return null;
  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
      {text !== null && (
        <span data-testid="page-savings" className="font-sans text-[15px] sm:text-[16px] font-medium leading-snug text-[#2E6B3F]">{text}</span>
      )}
      {text !== null && campaign && (
        <span data-testid="page-campaign" className={`${PAGE_BADGE} bg-[#B3121F]`}>
          {campaign}
        </span>
      )}
      {freeShipping && <FreeShippingBadge text={freeShipping} size="page" />}
    </div>
  );
}

export function DeliveryLine({ text }: { text: string }) {
  return <p data-testid="delivery-line" className="-mt-3 font-sans text-[13px] leading-snug text-ink-soft">{text}</p>;
}
