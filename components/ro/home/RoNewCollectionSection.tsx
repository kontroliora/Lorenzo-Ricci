import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/types";
import { RoProductCard } from "@/components/ro/RoProductCard";
import { HOME_HERO_PHOTOS } from "@/lib/new-collection";

// Romanian counterpart of components/home/NewCollectionSection.tsx (same layout): the 2026 women's collection above "Colecția
// clasică", its 1+1 line, the two on-model photos, the button to its section on /ro/bijuterii and up to 8 pieces (localized,
// in the shop and in stock - app/ro/page.tsx picks them). Lei prices come from RoProductCard.
export function RoNewCollectionSection({ pieces }: { pieces: Product[] }) {
  if (pieces.length === 0) return null;
  return (
    <section data-testid="home-new-collection" className="py-20 sm:py-32 bg-white border-t border-border">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <div className="text-center mb-8 sm:mb-12">
          <p className="section-tag mb-4">Lorenzo Ricci</p>
          <h2 className="section-title mb-4">Noua colecție</h2>
          <div className="gold-divider" />
          <p className="mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 font-sans text-sm text-ink-soft tracking-wide">
            <span className="font-sans text-[11px] font-semibold tracking-[0.16em] uppercase bg-[#B3121F] text-white px-2.5 py-1">1+1 GRATUIT</span>
            <span>Într-o cutie luxoasă din catifea</span>
          </p>
        </div>

        <Link href="/ro/bijuterii#noua-colectie" className="group block" aria-label="Descoperiți noua colecție">
          <div className="grid grid-cols-2 gap-2 sm:gap-4">
            {([
              [HOME_HERO_PHOTOS.necklace, "Colier Lumen – Argintiu purtat, noua colecție Lorenzo Ricci"],
              [HOME_HERO_PHOTOS.bracelet, "Brățară Lumen – Argintiu purtată, noua colecție Lorenzo Ricci"],
            ] as const).map(([src, alt]) => (
              <div key={src} className="relative aspect-[4/5] overflow-hidden bg-ivory-warm">
                <Image
                  src={src}
                  alt={alt}
                  fill
                  quality={85}
                  sizes="(max-width: 640px) 50vw, 600px"
                  className="object-cover object-center transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                />
              </div>
            ))}
          </div>
        </Link>
        <div className="mt-6 sm:mt-8 mb-12 sm:mb-16 flex justify-center">
          <Link href="/ro/bijuterii#noua-colectie" className="btn-primary w-full sm:w-auto text-center" data-testid="home-new-collection-cta">
            Descoperiți colecția
          </Link>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-8">
          {pieces.map((p) => (
            <RoProductCard key={p.id} product={p} />
          ))}
        </div>
      </div>
    </section>
  );
}
