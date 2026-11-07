import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/types";
import { ProductCard } from "@/components/product/ProductCard";
import cover from "@/public/covers/damska-kolekcia-cover.webp";

// Home page (BG): the 2026 women's collection, right above "Мъжка колекция". Title, the 1+1 line, one cover image (public/covers/damska-kolekcia-cover.webp)
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

        {/* One cover image, full width at its own 4:3 ratio (never cropped: the boxes stay whole). Static import = content-hashed URL. */}
        <Link href="/jewellery#damska-kolekcia" className="group block overflow-hidden bg-ivory-warm" aria-label="Разгледай дамската колекция">
          <Image
            src={cover}
            alt="Дамска колекция Lorenzo Ricci – колиета и гривни в кутии LORENZO RICCI"
            quality={85}
            sizes="(max-width: 1280px) 100vw, 1216px"
            className="w-full h-auto transition-transform duration-700 ease-out group-hover:scale-[1.02]"
          />
        </Link>
        <div className="mt-6 sm:mt-8 mb-10 sm:mb-12 flex justify-center">
          <Link href="/jewellery#damska-kolekcia" className="btn-primary w-full sm:w-auto text-center" data-testid="home-collection-cover-cta">
            Разгледай колекцията
          </Link>
        </div>

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
