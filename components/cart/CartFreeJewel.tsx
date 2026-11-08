"use client";
import { useState } from "react";
import Image from "next/image";
import { COLLECTION_GROUP_ORDER, type CollectionGroup, type FreeTag } from "@/lib/new-collection";

// Women's collection 1+1 in the cart drawer (BG + RO, owner 08.11.2026), shown while the cart holds an ODD number of collection
// pieces ("Добавете още едно бижу – безплатно"):
//   1. 3 suggestions (lib/new-collection.ts collectionCartTop3): the matching piece ("Комплект"), the same piece again ("Още едно
//      такова"), the best seller. Each shows its price struck through + green "Безплатно" and a "Добави безплатно" button.
//   2. "Виж всички N бижута ↓" opens the whole collection inside the drawer: groups Детелини / Пирони / Змия, 4 per row, small
//      thumbnails with names, sold out greyed and not tappable. A tap adds the piece (free: the count becomes even, so the parent
//      stops rendering this block). "Скрий ↑" folds it again.
// The drawer's cross-sell owns the cart, language, prices and stock; this is the view only.

export type FreeJewelItem = { slug: string; name: string; image: { src: string; alt: string }; priceText: string; available: boolean; group: CollectionGroup };
export type FreeJewelText = {
  free: string; add: string; set: string; again: string; soldOut: string; hide: string;
  seeAll: (n: number) => string; groups: Record<CollectionGroup, string>;
};

export const FREE_JEWEL_BG: FreeJewelText = {
  free: "Безплатно", add: "Добави безплатно", set: "Комплект", again: "Още едно такова", soldOut: "Изчерпан", hide: "Скрий ↑",
  seeAll: (n) => `Виж всички ${n} бижута ↓`, groups: { clover: "Детелини", nail: "Пирони", snake: "Змия" },
};
export const FREE_JEWEL_RO: FreeJewelText = {
  free: "Gratuit", add: "Adăugați gratuit", set: "Set", again: "Încă unul la fel", soldOut: "Epuizat", hide: "Ascundeți ↑",
  seeAll: (n) => `Vedeți toate cele ${n} bijuterii ↓`, groups: { clover: "Trifoi", nail: "Brățări-cui", snake: "Șarpe" },
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

  return (
    <div data-testid="cart-cross-sell" data-group="jewellery" className="mt-2 pt-4 border-t border-white/8">
      <p className="font-sans text-xs text-[#D4AF37] tracking-wide mb-3">◈ {title}</p>
      <div className="flex flex-col gap-3">
        {top.map(({ item, tag }) => (
          <div key={item.slug} data-testid={`free-sugg-${item.slug}`} className="flex items-center gap-3">
            <div className="relative w-12 h-14 flex-shrink-0 bg-white overflow-hidden">
              <Image src={item.image.src} alt={item.image.alt} fill quality={60} sizes="48px" className="object-contain p-0.5" />
            </div>
            <div className="flex-1 min-w-0">
              {tag && tag !== "best" && (
                <p className="font-sans text-[9px] tracking-[0.12em] uppercase text-[#D4AF37] leading-none mb-1">{tag === "set" ? text.set : text.again}</p>
              )}
              <p className="font-sans text-[11px] font-medium text-white leading-snug truncate">{item.name}</p>
              <p className="font-sans text-[11px] mt-0.5 flex gap-2">
                <span className="text-white/40 line-through">{item.priceText}</span>
                <span className="text-[#4ADE80] font-medium">{text.free}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => onAdd(item.slug)}
              data-testid={`free-add-${item.slug}`}
              className="flex-shrink-0 min-h-[44px] px-3 border border-[#D4AF37]/70 text-[#D4AF37] font-sans text-[10px] tracking-[0.1em] uppercase leading-tight hover:bg-[#D4AF37] hover:text-black transition-colors"
            >
              {text.add}
            </button>
          </div>
        ))}
      </div>

      {all.length > 0 && (
        <button
          type="button"
          data-testid="free-see-all"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="mt-3 py-2 font-sans text-[12px] text-white/60 underline underline-offset-2 hover:text-white transition-colors"
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
                <p className="font-sans text-[9px] tracking-[0.2em] uppercase text-white/40 mb-2">{text.groups[g]}</p>
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
                      <span className={`relative block w-full aspect-square overflow-hidden bg-white border ${o.available ? "border-white/10 group-hover:border-[#D4AF37]" : "border-white/5"}`}>
                        <Image src={o.image.src} alt={o.image.alt} fill quality={60} sizes="80px" className={`object-contain p-1 ${o.available ? "" : "grayscale opacity-40"}`} />
                      </span>
                      <span className={`block mt-1 font-sans text-[10px] leading-tight break-words ${o.available ? "text-white/75" : "text-white/30 line-through"}`}>{o.name}</span>
                      {!o.available && <span className="block font-sans text-[9px] text-white/30">{text.soldOut}</span>}
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
