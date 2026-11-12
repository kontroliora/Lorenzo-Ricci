// The lines right under the product-page price (BG and RO): what a discounted product saves, with the running campaign's badge
// and the free-delivery badge, and one delivery line. The pages decide the text and when to show them (savings: on sale and not sold out).
// Colours pass WCAG AA on the page's ivory: green 6.1, white on the badge red 6.6, white on the free-delivery green 5.4, ink-soft 9.3.
import Link from "next/link";
import { Package, ShieldCheck, Truck, RefreshCw } from "lucide-react";

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

/** New-collection pieces: the velvet box as a selling point, a small line with a box icon right under the price and its badges. */
export function BoxLine({ text }: { text: string }) {
  return (
    <p data-testid="page-box-line" className="mt-2.5 flex items-center gap-1.5 font-sans text-[13px] leading-snug text-ink-soft">
      <Package aria-hidden className="h-3.5 w-3.5 shrink-0 text-[#B8963E]" strokeWidth={1.75} />
      {text}
    </p>
  );
}

/** New-collection pieces: the lifetime warranty, same style as the box line, linking to the existing warranty terms. */
export function WarrantyLine({ text, href }: { text: string; href: string }) {
  return (
    <p data-testid="page-warranty-line" className="mt-1.5 flex items-center gap-1.5 font-sans text-[13px] leading-snug text-ink-soft">
      <ShieldCheck aria-hidden className="h-3.5 w-3.5 shrink-0 text-[#B8963E]" strokeWidth={1.75} />
      <Link href={href} className="underline decoration-ink-soft/30 underline-offset-2 hover:text-navy hover:decoration-navy transition-colors">{text}</Link>
    </p>
  );
}

/** All product pages (owner, 12.11.2026): the 30-day exchange, last of the lines under the price, linking to the returns policy. */
export function ExchangeLine({ text, href, first = false }: { text: string; href: string; first?: boolean }) {
  return (
    <p data-testid="page-exchange-line" className={`${first ? "mt-2.5" : "mt-1.5"} flex items-center gap-1.5 font-sans text-[13px] leading-snug text-ink-soft`}>
      <RefreshCw aria-hidden className="h-3.5 w-3.5 shrink-0 text-[#B8963E]" strokeWidth={1.75} />
      <Link href={href} className="underline decoration-dotted decoration-ink-soft/50 underline-offset-2 hover:text-navy hover:decoration-navy transition-colors">{text}</Link>
    </p>
  );
}

/** New-collection cards: a small lifetime-warranty line under the 1+1 line. */
export function CardWarrantyLine({ text }: { text: string }) {
  return (
    <p data-testid="card-warranty" className="mt-0.5 flex items-center gap-1 font-sans text-[12px] leading-snug text-ink-soft">
      <ShieldCheck aria-hidden className="h-3 w-3 shrink-0 text-[#B8963E]" strokeWidth={1.75} />
      {text}
    </p>
  );
}

export function DeliveryLine({ text }: { text: string }) {
  return <p data-testid="delivery-line" className="-mt-3 font-sans text-[13px] leading-snug text-ink-soft">{text}</p>;
}

/**
 * A product of a running 1+1 group (lib/one-plus-one.ts): the badge and the line under the price. "page" sits under the product-page
 * price, "card" under a card's price (the card draws the badge on its photo). The caller decides when it shows (not on a sold-out product).
 */
export function OnePlusOneLine({ badge, line, size }: { badge: string; line: string | null; size: "page" | "card" }) {
  // "page": the red badge sits in the price row (OnePlusOneBadge), so this is only the line, a touch smaller than the price's lines.
  void badge;
  return size === "page" ? (
    line ? <p data-testid="page-opo" className="mt-2 font-sans text-[13px] sm:text-[14px] font-medium leading-snug text-[#2E6B3F]">{line}</p> : null
  ) : line ? (
    <p data-testid="card-opo" className="mt-1 font-sans text-[13px] leading-snug text-[#2E6B3F]">{line}</p>
  ) : null;
}

/** The red 1+1 badge in the product-page price row, right after the price (before the green free-delivery badge). */
export function OnePlusOneBadge({ text }: { text: string }) {
  return <span data-testid="page-opo-badge" className={`${PAGE_BADGE} bg-[#B3121F]`}>{text}</span>;
}

/**
 * The 1+1 banner above a group's row on the home pages (BG / RO): the red badge, the offer, and a button to the group's listing.
 * The caller passes the wording (lib/one-plus-one.ts group text) and shows it only while the group runs.
 */
export function OnePlusOneBanner({ badge, text, cta, href }: { badge: string; text: string; cta: string; href: string }) {
  return (
    <div data-testid="home-opo-banner" className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5 border border-[#B3121F]/30 bg-[#B3121F]/[0.04] px-4 py-4 sm:px-6 sm:py-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 flex-1 min-w-0">
        <span className={`${PAGE_BADGE} self-start sm:self-auto bg-[#B3121F]`}>{badge}</span>
        <p className="font-serif text-[17px] sm:text-xl leading-snug text-charcoal">{text}</p>
      </div>
      <Link href={href} className="btn-primary self-stretch sm:self-auto text-center whitespace-nowrap">{cta}</Link>
    </div>
  );
}
