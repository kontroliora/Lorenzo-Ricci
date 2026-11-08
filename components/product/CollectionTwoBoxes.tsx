"use client";
import { useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import { CollectionFreePicker, type FreeItem, type FreePickerText } from "@/components/product/CollectionFreePicker";

// Women's collection product page, right column (owner, 08.11.2026), BG + RO, desktop + phones: two numbered boxes.
//   1  ВАШЕТО БИЖУ  (price on the right): small photo + name of the page's piece, then its selectors (Вид / Цвят / Камък).
//   2  ВТОРО БИЖУ   (БЕЗПЛАТНО on the right): the pre-selected free piece as a large card ("✓ Комплект с вашето колие" when it
//      is the other half of the set) with Смени / Махни. The full picker (Детелини / Пирони / Змия) is collapsed and opens here on
//      "Смени"; picking a piece (through its quick view) collapses it again. Removed ("Махни"): "Без второ бижу — губите
//      безплатното" and "Добави безплатно бижу" (brings the default back).
//   Then the summary right above the main button: [photo 1] + [photo 2]  Общо: €109  ~~€218~~, and the button the page passes.
// The page owns the pick (default, removed or chosen) and the cart; this is the layout.

export type TwoBoxText = {
  yours: string; second: string; free: string;
  withSet: (type: "necklace" | "bracelet") => string; again: string;
  change: string; close: string; remove: string; none: string; restore: string; total: string;
};

export const TWO_BOX_BG: TwoBoxText = {
  yours: "Вашето бижу", second: "Второ бижу", free: "Безплатно",
  withSet: (t) => `✓ Комплект с ${t === "necklace" ? "вашето колие" : "вашата гривна"}`, again: "✓ Още едно такова",
  change: "Смени", close: "Затвори", remove: "Махни", none: "Без второ бижу — губите безплатното", restore: "Добави безплатно бижу", total: "Общо:",
};
export const TWO_BOX_RO: TwoBoxText = {
  yours: "Bijuteria dumneavoastră", second: "A doua bijuterie", free: "Gratuit",
  withSet: (t) => `✓ Set cu ${t === "necklace" ? "colierul dumneavoastră" : "brățara dumneavoastră"}`, again: "✓ Încă unul la fel",
  change: "Schimbați", close: "Închideți", remove: "Eliminați", none: "Fără a doua bijuterie — pierdeți bijuteria gratuită", restore: "Adăugați bijuteria gratuită", total: "Total:",
};

export function CollectionTwoBoxes({ t, current, selectors, items, selfSlug, matchSlug, pickerText, picked, declined, onSelect, onRemove, onRestore, totalText, struckText, cta }: {
  t: TwoBoxText;
  current: { name: string; image: { src: string; alt: string }; priceText: string; type: "necklace" | "bracelet" };
  selectors: ReactNode;
  items: FreeItem[];
  selfSlug: string;
  matchSlug: string | null;
  pickerText: FreePickerText;
  picked: FreeItem | null;
  declined: boolean;
  onSelect: (slug: string) => void;
  onRemove: () => void;
  onRestore: () => void;
  totalText: string;          // what the customer pays ("€109")
  struckText: string | null;  // the two pieces' own prices together ("€218"), null with one piece
  cta: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const box2 = useRef<HTMLDivElement>(null);
  // Nothing pickable and not removed (every other piece sold out): the picker stays open so the box is never empty.
  const pickerOpen = open || (!picked && !declined);

  const collapse = () => {
    setOpen(false);
    requestAnimationFrame(() => {
      const el = box2.current;
      if (el && el.getBoundingClientRect().top < 80) el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };
  const choose = (slug: string | null) => { if (slug) onSelect(slug); collapse(); };

  return (
    <div className="flex flex-col gap-4">
      {/* ── Box 1: your piece ── */}
      <section data-testid="box-yours" className="border border-border bg-white">
        <BoxHeader n={1} title={t.yours} right={<span className="font-serif text-xl text-navy leading-none">{current.priceText}</span>} />
        <div className="px-4 sm:px-5 py-4 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <span className="relative flex-shrink-0 w-14 h-14 bg-white border border-border">
              <Image src={current.image.src} alt={current.image.alt} fill sizes="56px" quality={60} className="object-contain p-0.5" />
            </span>
            <p className="font-sans text-sm text-charcoal leading-snug">{current.name}</p>
          </div>
          {selectors}
        </div>
      </section>

      {/* ── Box 2: the free second piece ── */}
      <section ref={box2} data-testid="box-second" className="border border-border bg-white scroll-mt-28">
        <BoxHeader n={2} title={t.second} right={<span className="font-sans text-[11px] tracking-[0.18em] uppercase font-semibold text-[#2F6B3B]">{t.free}</span>} />
        <div className="px-4 sm:px-5 py-4">
          {picked ? (
            <div data-testid="second-card" className="flex items-center gap-4">
              <span className="relative flex-shrink-0 w-[100px] h-[100px] bg-white border border-border">
                <Image src={picked.image.src} alt={picked.image.alt} fill sizes="100px" quality={70} className="object-contain p-1" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-sans text-[15px] text-charcoal leading-snug">{picked.name}</p>
                {picked.slug === matchSlug && <p className="mt-1 font-sans text-xs text-gold-dark font-medium">{t.withSet(current.type)}</p>}
                {picked.slug === selfSlug && <p className="mt-1 font-sans text-xs text-gold-dark font-medium">{t.again}</p>}
                <p className="mt-1 font-sans text-xs"><span className="text-ink-muted line-through mr-2">{picked.priceText}</span><span className="text-[#2F6B3B] font-medium">{t.free}</span></p>
                <div className="mt-2.5 flex items-center gap-2">
                  <button type="button" data-testid="second-change" aria-expanded={pickerOpen} onClick={() => (open ? collapse() : setOpen(true))}
                    className="min-h-[40px] px-4 border border-navy text-navy font-sans text-[11px] tracking-[0.12em] uppercase hover:bg-navy hover:text-white transition-colors">
                    {open ? t.close : t.change}
                  </button>
                  <button type="button" data-testid="second-remove" onClick={() => { setOpen(false); onRemove(); }}
                    className="min-h-[40px] px-3 font-sans text-[11px] tracking-[0.12em] uppercase text-ink-muted underline underline-offset-2 hover:text-charcoal">
                    {t.remove}
                  </button>
                </div>
              </div>
            </div>
          ) : declined ? (
            <div data-testid="second-none" className="flex flex-col sm:flex-row sm:items-center gap-3">
              <p className="flex-1 font-sans text-sm text-ink-soft">{t.none}</p>
              <button type="button" data-testid="second-restore" onClick={onRestore} className="btn-primary px-5 py-3 text-[11px]">
                {t.restore}
              </button>
            </div>
          ) : null}

          {pickerOpen && !declined && (
            <div className={picked ? "mt-4 pt-1 border-t border-border" : ""}>
              <CollectionFreePicker embedded items={items} currentName={current.name} selfSlug={selfSlug} matchSlug={matchSlug}
                selected={picked?.slug ?? null} onSelect={choose} onRemove={onRemove} text={pickerText} />
            </div>
          )}
        </div>
      </section>

      {/* ── Summary + the main button ── */}
      <div data-testid="two-box-summary" className="flex items-center gap-2.5 pt-1">
        <Thumb src={current.image.src} alt={current.image.alt} />
        {picked && <><span aria-hidden className="font-sans text-ink-muted">+</span><Thumb src={picked.image.src} alt={picked.image.alt} /></>}
        <p className="ml-auto font-sans text-sm text-charcoal">
          {t.total} <span className="font-serif text-2xl text-navy align-middle">{totalText}</span>
          {struckText && <span className="ml-2 text-ink-muted line-through">{struckText}</span>}
        </p>
      </div>
      {cta}
    </div>
  );
}

function BoxHeader({ n, title, right }: { n: number; title: string; right: ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 sm:px-5 py-3 border-b border-border bg-ivory">
      <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-navy text-white font-sans text-xs font-medium">{n}</span>
      <span className="flex-1 min-w-0 font-sans text-[11px] sm:text-xs tracking-[0.18em] uppercase font-medium text-charcoal">{title}</span>
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
