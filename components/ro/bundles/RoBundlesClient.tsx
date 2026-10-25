"use client";
import { useState } from "react";
import Image from "next/image";
import { useRoCart } from "@/lib/ro/store";
import { fmtRON } from "@/lib/ro/config";
import { bundleSoldOut } from "@/lib/bundles";
import { useLeatherStock } from "@/lib/use-gifts";

// Romanian port of app/bundles/BundlesClient.tsx. The server page (app/ro/seturi/page.tsx) hands over lean, already
// localized data: lei prices come from lib/ro/config.ts and the set discount from lib/ro/pricing.ts roBundleDiscount (the
// same function the cart and /api/order-ro use), so this card, the cart and the order always show the same amounts.

export type RoBundlePiece = {
  slug: string;
  sku: string;
  name: string;
  ron: number;          // unit price in whole lei
  originalRon?: number; // crossed-out price while on sale (a set never contains a sale item, see the page)
  onSale: boolean;
  prepay: boolean;      // EUR 1500 and up: advance payment arranged with the shop
  image: string;
  imageAlt: string;
};

export type RoBundleCardData = {
  id: string;
  label: string;
  pieces: RoBundlePiece[];
  discountPct: number;
  discountRon: number;                 // set discount in whole lei (0 when the set has none)
  slots: string[][];                   // product slugs that can fill each slot (lib/bundles.ts)
  inStock: Record<string, boolean>;    // the catalogue's on/off switch (lib/products.ts) for every slug above
};

// Live stock of every piece (one shared call for the whole page); a set is sold out as soon as any of its pieces is.
function BundleCard({ label, pieces, discountPct, discountRon, slots, inStock }: RoBundleCardData) {
  const addItem = useRoCart((s) => s.addItem);
  const [added, setAdded] = useState(false);
  const stock = useLeatherStock(true);
  const soldOut = bundleSoldOut({ slots }, (slug) => stock?.[slug], (slug) => inStock[slug] === true);

  const fullRon = pieces.reduce((sum, p) => sum + p.ron, 0);
  const discounted = fullRon - discountRon;

  const handleAdd = () => {
    if (soldOut) return;
    for (const p of pieces) {
      addItem({
        slug: p.slug,
        sku: p.sku,
        name: p.name,
        ron: p.ron,
        originalRon: p.originalRon,
        onSale: p.onSale,
        prepay: p.prepay,
        image: p.image,
        imageAlt: p.imageAlt,
        stock: typeof stock?.[p.slug] === "number" ? stock[p.slug] : undefined,
      });
    }
    setAdded(true);
    setTimeout(() => setAdded(false), 2200);
  };

  return (
    <div className="bg-white border border-border flex flex-col hover:shadow-[0_4px_24px_-8px_rgba(15,40,80,0.10)] transition-shadow duration-400">
      {/* Top row: badge + label */}
      <div className="flex items-center justify-between px-5 pt-5 pb-0">
        <p className="font-sans text-[10px] font-medium tracking-[0.22em] uppercase text-navy">
          {label}
        </p>
        {soldOut ? (
          <span className="font-sans text-[9px] font-semibold tracking-[0.14em] uppercase bg-ink-faint text-white px-2 py-0.5">
            Epuizat
          </span>
        ) : discountPct > 0 ? (
          <span className="font-sans text-[9px] font-semibold tracking-[0.14em] uppercase bg-navy text-white px-2 py-0.5">
            -{discountPct}% reducere
          </span>
        ) : null}
      </div>

      {/* Compact thumbnail row */}
      <div className="flex items-center gap-2 px-5 pt-4">
        {pieces.map((p, i) => (
          <div key={p.slug} className="flex items-center gap-2">
            {i > 0 && <span className="text-ink-faint text-base font-light select-none">+</span>}
            <div className={`relative w-16 h-16 rounded-md overflow-hidden border border-border bg-ivory-warm flex-shrink-0 ${soldOut ? "grayscale" : ""}`}>
              <Image
                src={p.image}
                alt={p.imageAlt}
                fill
                quality={75}
                sizes="64px"
                className="object-contain p-1.5"
              />
            </div>
          </div>
        ))}

        <div className="ml-2 min-w-0">
          <p className="font-sans text-[11px] text-ink-soft leading-snug truncate">{pieces[0]?.name}</p>
          {pieces.slice(1).map((p) => (
            <p key={p.slug} className="font-sans text-[10px] text-ink-faint leading-snug truncate mt-0.5">
              + {p.name}
            </p>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="mx-5 mt-4 h-px bg-border" />

      {/* Price + button */}
      <div className="px-5 pb-5 pt-4 flex items-center justify-between gap-3 mt-auto">
        <div className={soldOut ? "opacity-50" : ""}>
          {discountRon > 0 && (
            <p className="font-sans text-[10px] text-ink-faint line-through leading-none">
              <span className="sr-only">Preț inițial: </span>
              {fmtRON(fullRon)}
            </p>
          )}
          <p className="font-serif text-2xl text-navy leading-tight">{fmtRON(discounted)}</p>
          {discountRon > 0 && (
            <p className="font-sans text-[10px] text-ink-faint tracking-wide mt-0.5">
              Economisiți {fmtRON(discountRon)}
            </p>
          )}
        </div>

        <button
          onClick={handleAdd}
          disabled={soldOut}
          className={`font-sans text-[10px] font-medium tracking-[0.18em] uppercase px-4 py-2.5 border transition-all duration-200 active:scale-[0.97] whitespace-nowrap ${
            soldOut
              ? "bg-transparent border-border text-ink-faint cursor-not-allowed"
              : added
                ? "bg-navy border-navy text-white"
                : "bg-transparent border-navy text-navy hover:bg-navy hover:text-white"
          }`}
        >
          {soldOut ? "Epuizat" : added ? "✓ Adăugat" : "Adăugați setul"}
        </button>
      </div>
    </div>
  );
}

interface Props {
  bundles: RoBundleCardData[];
}

export function RoBundlesClient({ bundles }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
      {bundles.map((b) => (
        <BundleCard key={b.id} {...b} />
      ))}
    </div>
  );
}
