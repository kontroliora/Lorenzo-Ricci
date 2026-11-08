import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/types";
import { ProductCard } from "@/components/product/ProductCard";
import cover from "@/public/covers/damska-kolekcia-cover.webp";
import model from "@/public/covers/damska-kolekcia-model.webp";

// Home page (BG): the 2026 women's collection, right under the hero. Title, the 1+1 line, two images (public/covers/damska-kolekcia-cover.webp + -model.webp)
// both linking to its section on /jewellery, then one row of 4 pieces (in the shop, in stock, white photo no. 1 - app/page.tsx
// picks them with homeCollectionPicks) and "Виж цялата колекция". Renders nothing when no piece is on sale.
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

        {/* Two images, both 4:3 and never cropped: the boxes (cover) and the model wearing the pieces. Side by side from tablet width
            up (equal widths = equal heights, ~600 x 448 on desktop), stacked on phones with the cover first. Static imports = hashed URLs. */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4" data-testid="home-collection-images">
          {([
            [cover, "Дамска колекция Lorenzo Ricci – колиета и гривни в кутии LORENZO RICCI"],
            [model, "Колие и гривни от дамската колекция Lorenzo Ricci на модел"],
          ] as const).map(([img, alt]) => (
            <Link key={img.src} href="/jewellery#damska-kolekcia" className="group block overflow-hidden" aria-label="Разгледай дамската колекция">
              <Image
                src={img}
                alt={alt}
                quality={97}
                sizes="(max-width: 767px) 100vw, (max-width: 1280px) 50vw, 608px"
                className="block w-full h-auto transition-transform duration-700 ease-out group-hover:scale-[1.02]"
              />
            </Link>
          ))}
        </div>
        {/* No button under the images: both images link to the collection; "Виж цялата колекция" closes the section. */}
        <div className="mb-10 sm:mb-12" />

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
