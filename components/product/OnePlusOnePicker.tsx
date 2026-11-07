"use client";
import Image from "next/image";

// Product page of a 1+1 group (lib/one-plus-one.ts): "Изберете втория – безплатно:" and a row of every model of the group (the
// page's own model included: two of the same is allowed). A model that can't be had (sold out / switched off / not enough left)
// is greyed out and not clickable. Desktop: wraps; phones: one horizontal scroll row. BG and RO pages pass their own wording and
// decide what "available" means (live stock minus what is already in their cart). Tapping the picked model again unpicks it.

export type PickOption = { slug: string; name: string; image: { src: string; alt: string }; available: boolean };

export function OnePlusOnePicker({
  title, options, selected, onSelect, soldOutLabel,
}: {
  title: string;
  options: PickOption[];
  selected: string | null;
  onSelect: (slug: string | null) => void;
  soldOutLabel: string;
}) {
  return (
    <div data-testid="opo-picker" className="mt-4">
      <p className="font-sans text-[12px] sm:text-[13px] font-medium tracking-wide text-charcoal mb-2.5">{title}</p>
      <div
        role="radiogroup"
        aria-label={title}
        className="flex gap-2.5 overflow-x-auto sm:overflow-visible sm:flex-wrap pb-1.5 snap-x"
      >
        {options.map((o) => {
          const on = selected === o.slug;
          return (
            <button
              key={o.slug}
              type="button"
              role="radio"
              aria-checked={on}
              aria-disabled={!o.available}
              disabled={!o.available}
              title={o.available ? o.name : `${o.name} – ${soldOutLabel}`}
              onClick={() => onSelect(on ? null : o.slug)}
              data-testid={`opo-pick-${o.slug}`}
              className={`group flex-shrink-0 w-[64px] snap-start text-center ${o.available ? "cursor-pointer" : "cursor-not-allowed"}`}
            >
              <span
                className={`relative block w-16 h-16 overflow-hidden bg-white border-2 transition-all duration-150 ${
                  on
                    ? "border-navy shadow-[0_0_0_3px_rgba(15,40,80,0.15)]"
                    : o.available ? "border-border group-hover:border-navy/40" : "border-border"
                }`}
              >
                <Image
                  src={o.image.src}
                  alt={o.image.alt}
                  fill
                  quality={60}
                  sizes="64px"
                  className={`object-contain p-1 ${o.available ? "" : "grayscale opacity-40"}`}
                />
                {on && (
                  <span aria-hidden className="absolute top-0 right-0 w-5 h-5 flex items-center justify-center bg-navy text-white text-[11px] leading-none">✓</span>
                )}
                {!o.available && (
                  <svg aria-hidden viewBox="0 0 64 64" className="absolute inset-0 w-full h-full pointer-events-none">
                    <line x1="6" y1="58" x2="58" y2="6" stroke="#9A948C" strokeWidth="1.5" />
                  </svg>
                )}
              </span>
              <span
                className={`block mt-1 font-sans text-[10px] sm:text-[11px] leading-tight truncate ${
                  on ? "text-navy font-medium" : o.available ? "text-ink-soft" : "text-ink-faint line-through"
                }`}
              >
                {o.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** The model's short name from the catalog name: 'Lorenzo Ricci "Ambra"' -> "Ambra". */
export const shortModel = (name: string): string => name.match(/"([^"]+)"/)?.[1] ?? name;
