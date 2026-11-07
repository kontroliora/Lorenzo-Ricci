"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { ModelRow } from "@/lib/new-collection";
import { previewProductPhoto, warmWhenIdle } from "@/lib/warm-product";

// The women's collection's second selector row under "Цвят" (BG + RO): "Камък" (round stone swatches, clover pieces) or
// "Камъни" (small photo + label, nail bangles). Every option is an existing product page, like the metal swatches.
// The row itself (which options, hidden / sold-out ones left out) comes from lib/new-collection.ts collectionModelRow.
export function CollectionModelRow({ row, current, hrefPrefix, onPrefetch }: {
  row: ModelRow;
  current: string;
  hrefPrefix: string; // "/products/" or "/ro/produse/"
  onPrefetch?: (slug: string) => void;
}) {
  // Instant feedback: the tapped option is shown as selected at once, while the (prefetched) page loads.
  const [pending, setPending] = useState<string | null>(null);
  useEffect(() => { setPending(null); }, [current]);
  const shown = pending ?? current;
  // Every option's main photo is downloaded and decoded once the page is idle, so the switch paints from memory.
  const optionSlugs = row.options.map((o) => o.slug).filter((s) => s !== current).join(",");
  useEffect(() => (optionSlugs ? warmWhenIdle(optionSlugs.split(",")) : undefined), [optionSlugs]);
  const tap = (e: React.MouseEvent, slug: string) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; // new tab / window: no optimistic state
    if (slug !== current) { setPending(slug); previewProductPhoto(slug); }
  };
  const selected = row.options.find((o) => o.slug === shown);
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span className="font-sans text-[10px] text-ink-muted tracking-widest uppercase">{row.title}:</span>
      {row.kind === "swatch" ? (
        <>
          <div className="flex items-center gap-2 [@media(pointer:coarse)]:gap-0">
            {row.options.map((o) => (
              <Link
                key={o.slug}
                href={`${hrefPrefix}${o.slug}`}
                title={o.label}
                aria-label={o.label}
                aria-current={o.slug === shown ? "true" : undefined}
                prefetch={true}
                scroll={false} // a sibling switch keeps the visitor where they are (no jump to the top)
                onClick={(e) => tap(e, o.slug)}
                onTouchStart={() => onPrefetch?.(o.slug)}
                onMouseEnter={() => onPrefetch?.(o.slug)}
                className="flex items-center justify-center w-6 h-6 [@media(pointer:coarse)]:w-11 [@media(pointer:coarse)]:h-11"
              >
                <span
                  className={`block w-6 h-6 rounded-full border-2 transition-all duration-200 ${
                    o.slug === shown
                      ? "border-navy scale-110 shadow-[0_0_0_2px_rgba(15,40,80,0.15)]"
                      : "border-border hover:border-navy/40"
                  }`}
                  style={{ backgroundColor: o.color, backgroundImage: o.background }}
                />
              </Link>
            ))}
          </div>
          {selected && <span className="font-sans text-xs text-ink-muted">{selected.label}</span>}
        </>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {row.options.map((o) => (
            <Link
              key={o.slug}
              href={`${hrefPrefix}${o.slug}`}
              aria-current={o.slug === shown ? "true" : undefined}
              prefetch={true}
              scroll={false}
              onClick={(e) => tap(e, o.slug)}
              onTouchStart={() => onPrefetch?.(o.slug)}
              onMouseEnter={() => onPrefetch?.(o.slug)}
              className={`flex items-center gap-2 pl-1 pr-3 py-1 border transition-colors duration-200 min-h-[44px] ${
                o.slug === shown ? "border-navy" : "border-border hover:border-navy/40"
              }`}
            >
              {o.image && (
                <Image src={o.image} alt="" width={36} height={36} sizes="36px" className="w-9 h-9 object-cover bg-white" />
              )}
              <span className={`font-sans text-xs whitespace-nowrap ${o.slug === shown ? "text-charcoal" : "text-ink-muted"}`}>{o.label}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
