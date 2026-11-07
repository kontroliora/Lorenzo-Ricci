import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/types";
import { ProductCard } from "@/components/product/ProductCard";
import { HOME_HERO_PHOTOS } from "@/lib/new-collection";

// Home page (BG): the 2026 women's collection, right above "Мъжка колекция". Title, the 1+1 line, a large two-photo image
// (necklace on the neck + bracelet on the wrist), the button to its section on /jewellery, then up to 8 pieces (in the shop and in
// stock - app/page.tsx picks them with homeCollectionPicks). Renders nothing when no piece is on sale.
export function NewCollectionSection({ pieces }: { pieces: Product[] }) {
  if (pieces.length === 0) return null;
  return (
    <section data-testid="home-new-collection" className="py-14 sm:py-20 bg-white border-t border-border">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <div className="text-center mb-6 sm:mb-8">
          <p className="section-tag mb-4">Lorenzo Ricci</p>
          <h2 className="section-title mb-4">Дамска колекция</h2>
          <div className="gold-divider" />
          <p className="mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 font-sans text-sm text-ink-soft tracking-wide">
            <span className="font-sans text-[11px] font-semibold tracking-[0.16em] uppercase bg-[#B3121F] text-white px-2.5 py-1">1+1 БЕЗПЛАТНО</span>
            <span>В луксозна велурена кутия</span>
          </p>
        </div>

        <Link href="/jewellery#damska-kolekcia" className="group block" aria-label="Разгледай дамската колекция">
          <div className="grid grid-cols-2 gap-2 sm:gap-4">
            {([
              [HOME_HERO_PHOTOS.necklace, "Колие Lumen – Сребро на модел, дамска колекция Lorenzo Ricci"],
              [HOME_HERO_PHOTOS.bracelet, "Гривна Lumen – Сребро на модел, дамска колекция Lorenzo Ricci"],
            ] as const).map(([src, alt]) => (
              <div key={src} className="relative aspect-[4/3] sm:aspect-[3/2] overflow-hidden bg-ivory-warm">
                <Image
                  src={src}
                  alt={alt}
                  fill
                  quality={85}
                  sizes="(max-width: 640px) 50vw, 640px"
                  className="object-cover object-center transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                />
              </div>
            ))}
          </div>
        </Link>
        <div className="mt-6 sm:mt-8" />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-8">
          {pieces.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
        <div className="mt-10 sm:mt-12 flex justify-center">
          <Link href="/jewellery#damska-kolekcia" className="btn-primary w-full sm:w-auto text-center" data-testid="home-new-collection-cta">
            Виж цялата колекция
          </Link>
        </div>
      </div>
    </section>
  );
}
