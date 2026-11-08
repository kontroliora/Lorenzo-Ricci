"use client";
import { type ReactNode } from "react";
import Image from "next/image";
import { CollectionFreePicker, type FreeItem, type FreePickerText } from "@/components/product/CollectionFreePicker";

// Women's collection product page, right column (owner, 08.11.2026), BG + RO, desktop + phones: two numbered boxes.
//   1  ИЗБЕРЕТЕ ПЪРВО БИЖУ (price on the right): small photo + name of the page's piece, then its selectors (Вид / Цвят / Камък).
//   2  ИЗБЕРЕТЕ ВТОРО БИЖУ – БЕЗПЛАТНО: just the full grid (Детелини / Пирони / Змия, the set's other half first with "Комплект"),
//      always visible, NOTHING pre-selected. A tap selects (dark border + check mark), a tap on another moves it, a tap on the
//      selected one clears it. No separate card, no Смени / Махни. The magnifier on each thumbnail opens the quick view.
//   Then, once a piece is picked, the summary right above the main button: [photo 1] + [photo 2]  Общо: €109  ~~€218~~.
//   Until then the page's buttons read "↑ Изберете безплатното бижу" (they scroll here) - the page builds them.
// The page owns the pick (default, removed or chosen) and the cart; this is the layout.

// Titles (owner, 08.11.2026): "Изберете първо бижу" / "Изберете второ бижу". Box 2's full title does not fit one line at 375px
// (measured: BG and RO both wrap), so phones (< 640px) show the short pair "Първо бижу" / "Второ бижу – БЕЗПЛАТНО" (the green word
// moves into the title and the right-hand one is hidden there).
export type TwoBoxText = {
  yours: string; yoursShort: string; second: string; secondShort: string; free: string;
  withSet: (type: "necklace" | "bracelet") => string; again: string;
  remove: string; total: string;
};

export const TWO_BOX_BG: TwoBoxText = {
  yours: "Изберете първо бижу", yoursShort: "Първо бижу", second: "Изберете второ бижу", secondShort: "Второ бижу –", free: "Безплатно",
  withSet: (t) => `✓ Комплект с ${t === "necklace" ? "вашето колие" : "вашата гривна"}`, again: "✓ Още едно такова",
  remove: "Махни", total: "Общо:",
};
export const TWO_BOX_RO: TwoBoxText = {
  yours: "Alegeți prima bijuterie", yoursShort: "Prima bijuterie", second: "Alegeți a doua bijuterie", secondShort: "A doua bijuterie –", free: "Gratuit",
  withSet: (t) => `✓ Set cu ${t === "necklace" ? "colierul dumneavoastră" : "brățara dumneavoastră"}`, again: "✓ Încă unul la fel",
  remove: "Eliminați", total: "Total:",
};

export function CollectionTwoBoxes({ t, current, selectors, items, selfSlug, matchSlug, pickerText, picked, onSelect, totalText, struckText, cta, join = null }: {
  t: TwoBoxText;
  current: { name: string; image: { src: string; alt: string }; priceText: string; type: "necklace" | "bracelet" };
  selectors: ReactNode;
  items: FreeItem[];
  selfSlug: string;
  matchSlug: string | null;
  pickerText: FreePickerText;
  picked: FreeItem | null;
  onSelect: (slug: string | null) => void;
  totalText: string;          // what the customer pays ("€109")
  struckText: string | null;  // the two pieces' own prices together ("€218"), null with one piece
  cta: ReactNode;
  /** The cart already holds an odd number of collection pieces (owner, 08.11.2026): this piece completes that 1+1. Box 2 and the
   *  summary are hidden; box 1 shows what the total really goes up by and a green line names the cart piece it pairs with. */
  join?: { line: string; price: ReactNode } | null;
}) {
  return (
    <div className="flex flex-col gap-4">
      {/* ── Box 1: your piece ── */}
      <section data-testid="box-yours" className="border border-border bg-white">
        <BoxHeader n={1} title={t.yours} short={t.yoursShort} right={join ? join.price : <span className="font-serif text-xl text-navy leading-none">{current.priceText}</span>} />
        <div className="px-4 sm:px-5 py-4 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <span className="relative flex-shrink-0 w-14 h-14 bg-white border border-border">
              <Image src={current.image.src} alt={current.image.alt} fill sizes="56px" quality={60} className="object-contain p-0.5" />
            </span>
            <p className="font-sans text-sm text-charcoal leading-snug">{current.name}</p>
          </div>
          {selectors}
          {join && <p data-testid="join-line" className="font-sans text-[13px] font-medium leading-snug text-[#2F6B3B]">{join.line}</p>}
        </div>
      </section>

      {/* ── Box 2: the free second piece (not while this piece completes the cart's 1+1) ── */}
      {!join && <section data-testid="box-second" className="border border-border bg-white scroll-mt-28">
        <BoxHeader n={2} title={<>{t.second} – <span className="font-semibold text-[#2F6B3B]">{t.free}</span></>} short={<>{t.secondShort} <span className="font-semibold text-[#2F6B3B]">{t.free}</span></>} right={null} />
        <div className="px-4 sm:px-5 py-4">
          <CollectionFreePicker embedded items={items} currentName={current.name} selfSlug={selfSlug} matchSlug={matchSlug}
            selected={picked?.slug ?? null} onSelect={onSelect} onRemove={() => onSelect(null)} text={pickerText} />
        </div>
      </section>}

      {/* ── Summary + the main button ── */}
      {picked && !join && <div data-testid="two-box-summary" className="flex items-center gap-2.5 pt-1">
        <Thumb src={current.image.src} alt={current.image.alt} />
        <span aria-hidden className="font-sans text-ink-muted">+</span><Thumb src={picked.image.src} alt={picked.image.alt} />
        <p className="ml-auto font-sans text-sm text-charcoal">
          {t.total} <span className="font-serif text-2xl text-navy align-middle">{totalText}</span>
          {struckText && <span className="ml-2 text-ink-muted line-through">{struckText}</span>}
        </p>
      </div>}
      {cta}
    </div>
  );
}

function BoxHeader({ n, title, short, right }: { n: number; title: ReactNode; short: ReactNode; right: ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 sm:px-5 py-3 border-b border-border bg-ivory">
      <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-navy text-white font-sans text-xs font-medium">{n}</span>
      <h3 data-testid="box-title" className="flex-1 min-w-0 font-sans text-[11px] sm:text-xs tracking-[0.18em] uppercase font-medium text-charcoal">
        <span className="hidden sm:inline">{title}</span>
        <span className="sm:hidden">{short}</span>
      </h3>
      {right}
    </div>
  );
}

function Thumb({ src, alt }: { src: string; alt: string }) {
  return (
    <span className="relative flex-shrink-0 w-11 h-11 bg-white border border-border">
      <Image src={src} alt={alt} fill sizes="44px" quality={60} className="object-contain p-0.5" />
    </span>
  );
}
