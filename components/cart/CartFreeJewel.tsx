"use client";
import { useState } from "react";
import Image from "next/image";
import { COLLECTION_GROUP_ORDER, type CollectionGroup, type FreeTag } from "@/lib/new-collection";

// Women's collection 1+1 in the cart drawer (BG + RO, owner 08.11.2026), shown while the cart holds an ODD number of collection
// pieces: ONE compact card "Добавете второ бижу – безплатно" with the first suggestion (lib/new-collection.ts collectionCartTop3: the
// matching piece "Комплект", else the same piece again, else the best seller) - its price struck, green "Безплатно", a "Добави"
// button - and "Виж всички N ↓", which opens the whole collection inside the drawer: groups Детелини / Пирони / Змия, 4 per row,
// small thumbnails with names, sold out greyed and not tappable. A tap adds the piece (free: the count becomes even, so the parent
// stops rendering this card). "Скрий ↑" folds it again. Light theme like the rest of the cart step. View only.

export type FreeJewelItem = { slug: string; name: string; image: { src: string; alt: string }; priceText: string; available: boolean; group: CollectionGroup };
export type FreeJewelText = {
  free: string; add: string; set: string; again: string; soldOut: string; hide: string;
  seeAll: (n: number) => string; groups: Record<CollectionGroup, string>;
};

export const FREE_JEWEL_BG: FreeJewelText = {
  free: "Безплатно", add: "Добави", set: "Комплект", again: "Още едно такова", soldOut: "Изчерпан", hide: "Скрий ↑",
  seeAll: (n) => `Виж всички ${n} ↓`, groups: { clover: "Детелини", nail: "Пирони", snake: "Змия" },
};
export const FREE_JEWEL_RO: FreeJewelText = {
  free: "Gratuit", add: "Adăugați", set: "Set", again: "Încă unul la fel", soldOut: "Epuizat", hide: "Ascundeți ↑",
  seeAll: (n) => `Vedeți toate ${n} ↓`, groups: { clover: "Trifoi", nail: "Brățări-cui", snake: "Șarpe" },
};

export function CartFreeJewel({ title, top, all, text, onAdd }: {
  title: string;
  top: { item: FreeJewelItem; tag: FreeTag }[];
  all: FreeJewelItem[];
  text: FreeJewelText;
  onAdd: (slug: string) => void;
}) {
  const [open, setOpen] = useState(false);
  if (top.length === 0 && !all.some((i) => i.available)) return null;

  const first = top[0];
  return (
    <div data-testid="cart-cross-sell" data-group="jewellery" className="mt-4 border border-navy/20 bg-[#F7F8FB] p-3.5">
      <p className="font-sans text-[13px] font-semibold text-navy mb-2.5">{title}</p>
      {first && (
        <div data-testid={`free-sugg-${first.item.slug}`} className="flex items-center gap-3">
          <div className="relative w-14 h-14 flex-shrink-0 bg-white border border-border overflow-hidden">
            <Image src={first.item.image.src} alt={first.item.image.alt} fill quality={60} sizes="56px" className="object-contain p-0.5" />
          </div>
          <div className="flex-1 min-w-0">
            {(first.tag === "set" || first.tag === "again") && (
              <p className="font-sans text-[9px] tracking-[0.14em] uppercase text-gold-dark font-medium leading-none mb-1">{first.tag === "set" ? text.set : text.again}</p>
            )}
            <p className="font-sans text-[13px] text-navy leading-snug line-clamp-2">{first.item.name}</p>
            <p className="font-sans text-[12px] mt-0.5 flex gap-2">
              <span className="text-ink-muted line-through">{first.item.priceText}</span>
              <span className="text-[#2F6B3B] font-semibold">{text.free}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => onAdd(first.item.slug)}
            data-testid={`free-add-${first.item.slug}`}
            className="flex-shrink-0 min-h-[40px] px-4 bg-navy text-white font-sans text-[11px] tracking-[0.14em] uppercase hover:bg-navy-light transition-colors"
          >
            {text.add}
          </button>
        </div>
      )}

      {all.length > 0 && (
        <button
          type="button"
          data-testid="free-see-all"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="mt-2 py-1.5 font-sans text-[12px] text-navy/80 underline underline-offset-2 hover:text-navy transition-colors"
        >
          {open ? text.hide : text.seeAll(all.length)}
        </button>
      )}

      {open && (
        <div data-testid="free-grid" className="pb-1">
          {COLLECTION_GROUP_ORDER.map((g) => {
            const list = all.filter((i) => i.group === g);
            if (list.length === 0) return null;
            return (
              <div key={g} className="mt-3">
                <p className="font-sans text-[9px] tracking-[0.2em] uppercase text-ink-muted mb-2">{text.groups[g]}</p>
                <div className="grid grid-cols-4 gap-x-2 gap-y-3">
                  {list.map((o) => (
                    <button
                      key={o.slug}
                      type="button"
                      disabled={!o.available}
                      aria-disabled={!o.available}
                      onClick={() => onAdd(o.slug)}
                      title={o.available ? `${text.add}: ${o.name}` : `${o.name} – ${text.soldOut}`}
                      data-testid={`free-grid-${o.slug}`}
                      className={`group min-w-0 text-center ${o.available ? "cursor-pointer" : "cursor-not-allowed"}`}
                    >
                      <span className={`relative block w-full aspect-square overflow-hidden bg-white border ${o.available ? "border-border group-hover:border-navy" : "border-border"}`}>
                        <Image src={o.image.src} alt={o.image.alt} fill quality={60} sizes="80px" className={`object-contain p-1 ${o.available ? "" : "grayscale opacity-40"}`} />
                      </span>
                      <span className={`block mt-1 font-sans text-[10px] leading-tight break-words ${o.available ? "text-charcoal" : "text-ink-faint line-through"}`}>{o.name}</span>
                      {!o.available && <span className="block font-sans text-[9px] text-ink-faint">{text.soldOut}</span>}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
