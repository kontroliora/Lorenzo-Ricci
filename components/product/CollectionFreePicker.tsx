"use client";
import { useState } from "react";
import Image from "next/image";
import { COLLECTION_GROUP_ORDER, type CollectionGroup } from "@/lib/new-collection";
import { CollectionQuickView } from "@/components/product/CollectionQuickView";

// The women's collection's free second piece (1+1), BG + RO (owner, 08.11.2026):
//   1. One line: "1. [this piece] ✓   2. Изберете второто бижу – безплатно:" (the page's piece is the first of the two).
//   2. Phones (< 640px): a 4-column grid, every piece visible without swiping; desktop: fixed 90px thumbnails that wrap.
//      Every piece, grouped Детелини / Пирони / Змия; the other half of the set (same clover model and metal, necklace <->
//      bracelet) is the first thumbnail of Детелини with a small gold "Комплект" above it. Sold out = greyed, not clickable.
//   3. (owner, 08.11.2026) A tap on a piece PICKS it (check mark; inside box 2 the picker then collapses). The quick view (modal on
//      desktop, bottom sheet on phones) opens only from the small magnifier at the top-right of a photo (32px touch area); its
//      "Избери за второ бижу" button picks too.
//   4. Picked: a check mark on it and the "Второ бижу: ... · Смени · Махни" line under the picker. Nothing goes into the cart here:
//      the page's main button (then "Добави 2 в количката – €X") adds both.
//   5. (owner, 08.11.2026) The 1+1 is the default: the page pre-selects the partner piece (lib/new-collection.ts collectionPartnerOf);
//      "Махни" drops it (the button then reads "Добави само 1 – губите безплатното бижу"). The page's own piece is the first
//      thumbnail of its group, named "Още едно такова": picking it adds the same piece twice (quantity 2, one of them free).
// The page builds the items (its own language, prices, stock) and owns the pick, as with OnePlusOnePicker.

export type FreeItem = {
  slug: string;
  name: string;            // full name, e.g. "Гривна Verdis – Злато"
  image: { src: string; alt: string };
  images: { src: string; alt: string }[];
  available: boolean;
  group: CollectionGroup;
  priceText: string;       // its own price, shown struck through
  description: string;
  href: string;
};

export type FreePickerText = {
  title: string; setLabel: string; free: string; groups: Record<CollectionGroup, string>;
  chooseSecond: string; details: string; soldOut: string; second: string; freeShort: string; change: string; close: string;
  again: string; remove: string; zoom: string;
};

export function CollectionFreePicker({ items, currentName, selfSlug, matchSlug, selected, onSelect, onRemove, text, embedded = false }: {
  embedded?: boolean;      // inside box 2 of CollectionTwoBoxes: no step line, no picked line (the box shows both)
  items: FreeItem[];
  currentName: string;     // the page's own piece: item no. 1
  selfSlug: string;        // ... and its slug: its thumbnail reads "Още едно такова" (the same piece again)
  matchSlug: string | null;
  onRemove: () => void;    // "Махни": no second piece
  selected: string | null;
  onSelect: (slug: string | null) => void;
  text: FreePickerText;
}) {
  const [viewing, setViewing] = useState<string | null>(null);
  const picked = selected ? items.find((i) => i.slug === selected) : undefined;
  const viewed = viewing ? items.find((i) => i.slug === viewing) : undefined;

  const change = () => {
    document.querySelector("[data-testid='opo-picker']")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div data-testid="opo-picker" className={embedded ? "" : "mt-4 scroll-mt-28"}>
      {/* "1. this piece ✓   2. pick the second one": the page's own piece is the first of the two */}
      {!embedded && <p data-testid="opo-steps" className="font-sans text-[12px] sm:text-[13px] font-medium tracking-wide text-charcoal mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span>1. {currentName} <span className="text-navy">✓</span></span>
        <span>2. {text.title}</span>
      </p>}

      {COLLECTION_GROUP_ORDER.map((g) => {
        // The other half of the set (same clover model and metal) leads its group, with a small gold "Комплект" above it;
        // the label sits above the first row only (padding on the group), so later rows keep their normal spacing.
        const lead = (slug: string) => (slug === selfSlug ? 2 : slug === matchSlug ? 1 : 0); // the same piece again, then the set's other half
        const list = items.filter((i) => i.group === g).sort((a, b) => lead(b.slug) - lead(a.slug));
        if (list.length === 0) return null;
        const hasSet = list.some((i) => i.slug === matchSlug);
        return (
          <div key={g} className="mt-3">
            <p className="font-sans text-[10px] tracking-widest uppercase text-ink-muted mb-2">{text.groups[g]}</p>
            <div role="radiogroup" aria-label={text.groups[g]} className={`grid grid-cols-4 gap-x-2 gap-y-3 sm:flex sm:flex-wrap sm:gap-2.5 pb-1.5 ${hasSet ? "pt-[18px]" : ""}`}>
              {list.map((o) => {
                const on = selected === o.slug;
                return (
                  <div key={o.slug} className="relative min-w-0 w-full sm:flex-shrink-0 sm:w-[90px]">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={on}
                    aria-disabled={!o.available}
                    disabled={!o.available}
                    title={o.slug === selfSlug ? `${text.again} – ${o.name}` : o.available ? o.name : `${o.name} – ${text.soldOut}`}
                    onClick={() => onSelect(o.slug)}
                    data-testid={`opo-pick-${o.slug}`}
                    className={`group relative w-full text-center ${o.available ? "cursor-pointer" : "cursor-not-allowed"}`}
                  >
                    {o.slug === matchSlug && (
                      <span className="absolute -top-[18px] left-0 right-0 h-4 font-sans text-[9px] sm:text-[10px] leading-4 tracking-[0.1em] sm:tracking-[0.12em] uppercase text-gold-dark font-medium whitespace-nowrap">
                        {text.setLabel}
                      </span>
                    )}
                    <span className={`relative block w-full aspect-square sm:w-[90px] sm:h-[90px] sm:aspect-auto overflow-hidden bg-white border-2 transition-all duration-150 ${
                      on ? "border-navy shadow-[0_0_0_3px_rgba(15,40,80,0.15)]" : o.available ? "border-border group-hover:border-navy/40" : "border-border"
                    }`}>
                      <Image src={o.image.src} alt={o.image.alt} fill quality={60} sizes="(max-width: 639px) 80px, 90px" className={`object-contain p-1 ${o.available ? "" : "grayscale opacity-40"}`} />
                      {on && <Check />}
                      {!o.available && (
                        <svg aria-hidden viewBox="0 0 90 90" className="absolute inset-0 w-full h-full pointer-events-none">
                          <line x1="8" y1="82" x2="82" y2="8" stroke="#9A948C" strokeWidth="1.5" />
                        </svg>
                      )}
                    </span>
                    <span className={`block mt-1 font-sans text-[10px] sm:text-[11px] leading-tight min-h-[2.5em] break-words ${
                      on ? "text-navy font-medium" : o.available ? "text-ink-soft" : "text-ink-faint line-through"
                    }`}>
                      {o.slug === selfSlug ? text.again : o.name}
                    </span>
                    {!o.available && <span className="block font-sans text-[10px] text-ink-faint">{text.soldOut}</span>}
                  </button>
                  {/* Quick view only from the magnifier (top-right of the photo): a 32px touch area, a small round icon inside */}
                  {o.available && (
                    <button
                      type="button"
                      onClick={() => setViewing(o.slug)}
                      aria-label={`${text.zoom}: ${o.name}`}
                      title={text.zoom}
                      data-testid={`opo-zoom-${o.slug}`}
                      className="absolute top-0 right-0 z-10 w-8 h-8 flex items-start justify-end p-[3px] group/zoom"
                    >
                      <span className="w-[22px] h-[22px] rounded-full bg-white/95 border border-border shadow-sm flex items-center justify-center text-ink-soft group-hover/zoom:text-navy group-hover/zoom:border-navy/50 transition-colors">
                        <svg aria-hidden viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                          <circle cx="10.5" cy="10.5" r="6.5" /><line x1="15.5" y1="15.5" x2="21" y2="21" />
                        </svg>
                      </span>
                    </button>
                  )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {picked && !embedded && (
        <div data-testid="opo-picked-line" className="mt-4 flex items-center gap-3 px-3 py-2 border border-navy/30 bg-navy/[0.03]">
          <span className="relative flex-shrink-0 w-10 h-10 bg-white">
            <Image src={picked.image.src} alt="" fill sizes="40px" quality={60} className="object-contain" />
          </span>
          <p className="flex-1 min-w-0 font-sans text-xs text-charcoal leading-snug">
            <span className="text-ink-muted">{text.second} </span>
            {picked.slug === selfSlug ? `${text.again} (${picked.name})` : picked.name} – <span className="text-[#2F6B3B] font-medium">{text.freeShort}</span>
          </p>
          <button type="button" onClick={change} className="font-sans text-xs text-navy underline underline-offset-2 py-2 -my-2 flex-shrink-0">
            {text.change}
          </button>
          <button type="button" data-testid="opo-remove" onClick={onRemove} className="font-sans text-xs text-ink-muted underline underline-offset-2 py-2 -my-2 flex-shrink-0">
            {text.remove}
          </button>
        </div>
      )}

      {viewed && (
        <CollectionQuickView
          item={viewed}
          text={text}
          onClose={() => setViewing(null)}
          onChoose={() => { onSelect(viewed.slug); setViewing(null); }}
        />
      )}
    </div>
  );
}

function Check() {
  return <span aria-hidden className="absolute top-0 left-0 w-6 h-6 flex items-center justify-center bg-navy text-white text-[12px] leading-none">✓</span>;
}
