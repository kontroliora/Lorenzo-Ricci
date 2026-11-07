"use client";
import { useState } from "react";
import Image from "next/image";
import { smallOrOriginal } from "@/lib/image-variant";
import { COLLECTION_GROUP_ORDER, type CollectionGroup } from "@/lib/new-collection";
import { CollectionQuickView } from "@/components/product/CollectionQuickView";

// The women's collection's free second piece (1+1), BG + RO (owner, 08.11.2026):
//   1. One line: "1. [this piece] ✓   2. Изберете второто бижу – безплатно:" (the page's piece is the first of the two).
//   2. Every piece, grouped Детелини / Пирони / Змия; the other half of the set (same clover model and metal, necklace <->
//      bracelet) is the first thumbnail of Детелини with a small gold "Комплект" above it. Sold out = greyed, not clickable.
//   3. A tap on a piece opens a quick view (modal on desktop, bottom sheet on phones); the piece is picked only by its
//      "Избери за второ бижу" button.
//   4. Picked: a check mark on it and the "Второ бижу: ... · Смени" line under the picker. Nothing goes into the cart here: the
//      page's main button (then "Добави 2 в количката – €X") adds both.
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
};

export function CollectionFreePicker({ items, currentName, matchSlug, selected, onSelect, text }: {
  items: FreeItem[];
  currentName: string;     // the page's own piece: item no. 1

  matchSlug: string | null;
  selected: string | null;
  onSelect: (slug: string | null) => void;
  text: FreePickerText;
}) {
  const [viewing, setViewing] = useState<string | null>(null);
  const picked = selected ? items.find((i) => i.slug === selected) : undefined;
  const viewed = viewing ? items.find((i) => i.slug === viewing) : undefined;

  const change = () => {
    onSelect(null);
    document.querySelector("[data-testid='opo-picker']")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div data-testid="opo-picker" className="mt-4 scroll-mt-28">
      {/* "1. this piece ✓   2. pick the second one": the page's own piece is the first of the two */}
      <p data-testid="opo-steps" className="font-sans text-[12px] sm:text-[13px] font-medium tracking-wide text-charcoal mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span>1. {currentName} <span className="text-navy">✓</span></span>
        <span>2. {text.title}</span>
      </p>

      {COLLECTION_GROUP_ORDER.map((g) => {
        // The other half of the set (same clover model and metal) leads its group, with a small gold "Комплект" above it;
        // the row keeps that label's height on every thumbnail so the photos stay aligned.
        const list = items.filter((i) => i.group === g).sort((a, b) => Number(b.slug === matchSlug) - Number(a.slug === matchSlug));
        if (list.length === 0) return null;
        const hasSet = list.some((i) => i.slug === matchSlug);
        return (
          <div key={g} className="mt-3">
            <p className="font-sans text-[10px] tracking-widest uppercase text-ink-muted mb-2">{text.groups[g]}</p>
            <div role="radiogroup" aria-label={text.groups[g]} className="flex gap-2.5 overflow-x-auto sm:overflow-visible sm:flex-wrap pb-1.5 snap-x -mr-5 pr-5 sm:mr-0 sm:pr-0">
              {list.map((o) => {
                const on = selected === o.slug;
                return (
                  <button
                    key={o.slug}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    aria-disabled={!o.available}
                    disabled={!o.available}
                    title={o.available ? o.name : `${o.name} – ${text.soldOut}`}
                    onClick={() => setViewing(o.slug)}
                    data-testid={`opo-pick-${o.slug}`}
                    className={`group flex-shrink-0 w-[90px] snap-start text-center ${o.available ? "cursor-pointer" : "cursor-not-allowed"}`}
                  >
                    {hasSet && (
                      <span className="block h-4 mb-0.5 font-sans text-[10px] leading-4 tracking-[0.12em] uppercase text-gold-dark font-medium">
                        {o.slug === matchSlug ? text.setLabel : ""}
                      </span>
                    )}
                    <span className={`relative block w-[90px] h-[90px] overflow-hidden bg-white border-2 transition-all duration-150 ${
                      on ? "border-navy shadow-[0_0_0_3px_rgba(15,40,80,0.15)]" : o.available ? "border-border group-hover:border-navy/40" : "border-border"
                    }`}>
                      <Image src={smallOrOriginal(o.image.src)} alt={o.image.alt} fill quality={60} sizes="90px" className={`object-contain p-1 ${o.available ? "" : "grayscale opacity-40"}`} />
                      {on && <Check />}
                      {!o.available && (
                        <svg aria-hidden viewBox="0 0 90 90" className="absolute inset-0 w-full h-full pointer-events-none">
                          <line x1="8" y1="82" x2="82" y2="8" stroke="#9A948C" strokeWidth="1.5" />
                        </svg>
                      )}
                    </span>
                    <span className={`block mt-1 font-sans text-[11px] leading-tight min-h-[2.5em] ${
                      on ? "text-navy font-medium" : o.available ? "text-ink-soft" : "text-ink-faint line-through"
                    }`}>
                      {o.name}
                    </span>
                    {!o.available && <span className="block font-sans text-[10px] text-ink-faint">{text.soldOut}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {picked && (
        <div data-testid="opo-picked-line" className="mt-4 flex items-center gap-3 px-3 py-2 border border-navy/30 bg-navy/[0.03]">
          <span className="relative flex-shrink-0 w-10 h-10 bg-white">
            <Image src={smallOrOriginal(picked.image.src)} alt="" fill sizes="40px" quality={60} className="object-contain" />
          </span>
          <p className="flex-1 min-w-0 font-sans text-xs text-charcoal leading-snug">
            <span className="text-ink-muted">{text.second} </span>
            {picked.name} – <span className="text-[#2F6B3B] font-medium">{text.freeShort}</span>
          </p>
          <button type="button" onClick={change} className="font-sans text-xs text-navy underline underline-offset-2 py-2 -my-2 flex-shrink-0">
            {text.change}
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
  return <span aria-hidden className="absolute top-0 right-0 w-6 h-6 flex items-center justify-center bg-navy text-white text-[12px] leading-none">✓</span>;
}
