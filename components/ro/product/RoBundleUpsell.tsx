"use client";
import { useState } from "react";
import Image from "next/image";
import type { Product } from "@/lib/types";
import { useRoCart } from "@/lib/ro/store";
import { fmtRON, ronOf, ronOriginalOf } from "@/lib/ro/config";
import { roBundleDiscount } from "@/lib/ro/pricing";
import { usePriceOverrides } from "@/lib/use-price-overrides";
import { useLeatherStock } from "@/lib/use-gifts";
import { roCartLine } from "@/components/ro/product/cart-line";

// Romanian counterpart of components/product/BundleUpsell.tsx: on a product that belongs to a set, offers the set partner and
// adds both pieces to the Romanian cart. Same rules as the Bulgarian component:
//   - nothing is offered when the partner (or this product) has no free stock left;
//   - the set discount (lib/bundles.ts discountPct, computed on the lei prices by roBundleDiscount - the very function the cart and the
//     order use) is advertised only when it really applies: no discount while either piece is on sale, so the pairing is then shown
//     without any discount claim.
// The page (server) resolves the set and passes the partners already localized, override-applied and made safe (roSafeProduct).

interface Props {
  product: Product;     // this product (localized, override-applied)
  partners: Product[];  // the products that can fill the other slot of its set
  discountPct: number;  // the set's discount in percent (0 = a pairing without a set discount)
}

export function RoBundleUpsell({ product: rawProduct, partners: rawPartners, discountPct }: Props) {
  const addItem = useRoCart((s) => s.addItem);
  const [addedPartnerSlug, setAddedPartnerSlug] = useState<string | null>(null);
  const applyOverride = usePriceOverrides();
  const stock = useLeatherStock(true);

  // `product` may already be override-applied by the server page; re-applying is a no-op then, and picks up a price change made
  // after the page was generated.
  const product = applyOverride(rawProduct);

  // A set mirrors the stock of its pieces (stock not loaded yet = available).
  const soldOutNow = (slug: string) => (stock?.[slug] ?? 1) <= 0;
  const partners = rawPartners.map(applyOverride).filter((p) => p.inStock && !soldOutNow(p.slug));

  if (partners.length === 0 || soldOutNow(product.slug)) return null;

  const handleAdd = (partner: Product) => {
    addItem(roCartLine(product, stock?.[product.slug]));
    addItem(roCartLine(partner, stock?.[partner.slug]));
    setAddedPartnerSlug(partner.slug);
    setTimeout(() => setAddedPartnerSlug(null), 2200);
  };

  // Does ANY pairing carry a real discount? (decides the badge; the price rows decide per partner)
  const discountOf = (partner: Product): number =>
    roBundleDiscount([
      { slug: product.slug, ron: ronOf(product), quantity: 1, onSale: ronOriginalOf(product) !== undefined },
      { slug: partner.slug, ron: ronOf(partner), quantity: 1, onSale: ronOriginalOf(partner) !== undefined },
    ]).totalDiscount;
  const hasDiscount = discountPct > 0 && partners.some((p) => discountOf(p) > 0);

  return (
    <div className="mt-6 border-t border-border pt-5">
      {/* Label row */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-3 h-px bg-navy/40" />
        <p className="font-sans text-[10px] font-medium tracking-[0.22em] uppercase text-navy">
          Completați ansamblul
        </p>
        <span className="ml-auto font-sans text-[9px] font-semibold tracking-[0.14em] uppercase bg-navy text-white px-2 py-0.5">
          {hasDiscount ? `-${discountPct}% SET` : "SET"}
        </span>
      </div>

      {/* One row per partner */}
      <div className="flex flex-col gap-4">
        {partners.map((partner) => {
          const discount = discountOf(partner);
          const partnerHasDiscount = discountPct > 0 && discount > 0;
          const fullPrice = ronOf(product) + ronOf(partner);
          const setPrice = fullPrice - (partnerHasDiscount ? discount : 0);
          const isAdded = addedPartnerSlug === partner.slug;
          const isLocked = addedPartnerSlug !== null && !isAdded;

          return (
            <div
              key={partner.slug}
              className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 transition-opacity duration-300 ${
                isLocked ? "opacity-30" : ""
              }`}
            >
              {/* Left: thumbnails + description */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <div className="relative w-14 h-14 rounded-md overflow-hidden border border-border bg-ivory-warm">
                    <Image
                      src={product.coverImage.src}
                      alt={product.coverImage.alt}
                      fill
                      quality={75}
                      sizes="56px"
                      className="object-contain p-1.5"
                    />
                  </div>
                  <span className="text-ink-faint text-base font-light select-none">+</span>
                  <div className="relative w-14 h-14 rounded-md overflow-hidden border border-border bg-ivory-warm">
                    <Image
                      src={partner.coverImage.src}
                      alt={partner.coverImage.alt}
                      fill
                      quality={75}
                      sizes="56px"
                      className="object-contain p-1.5"
                    />
                  </div>
                </div>
                <div className="min-w-0">
                  <p className="font-sans text-[11px] font-medium tracking-wide text-charcoal leading-snug">
                    Adăugați <span className="text-navy">{partner.name}</span>
                  </p>
                  {partnerHasDiscount && (
                    <p className="font-sans text-[10px] text-ink-faint tracking-wide leading-snug mt-0.5">
                      și economisiți {discountPct}% din prețul total
                    </p>
                  )}
                </div>
              </div>

              {/* Right: price + button */}
              <div className="flex items-center gap-3 sm:flex-shrink-0">
                <div className="text-right">
                  {partnerHasDiscount && (
                    <del className="block font-sans text-[10px] text-ink-faint line-through leading-none">
                      {fmtRON(fullPrice)}
                    </del>
                  )}
                  <p className="font-serif text-lg text-navy leading-tight">
                    {fmtRON(setPrice)}
                  </p>
                </div>
                <button
                  onClick={() => handleAdd(partner)}
                  disabled={isLocked}
                  className={`font-sans text-[10px] font-medium tracking-[0.18em] uppercase px-4 py-2.5 border transition-all duration-200 active:scale-[0.97] whitespace-nowrap disabled:cursor-not-allowed ${
                    isAdded
                      ? "bg-navy border-navy text-white"
                      : "bg-transparent border-navy text-navy hover:bg-navy hover:text-white"
                  }`}
                >
                  {isAdded ? "✓ Adăugat" : "Adăugați setul"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
