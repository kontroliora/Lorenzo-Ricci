"use client";
import Image from "next/image";
import Link from "next/link";
import { useReveal } from "@/lib/useReveal";

// Romanian counterpart of components/home/JewellerySection.tsx: the two category banners (bracelets, necklaces) and the
// three jewellery promises (PVD gold plating, 316L steel, lifetime guarantee), worded exactly like the Bulgarian ones.
const BANNERS = [
  {
    href: "/ro/bijuterii?category=bracelets",
    src: "/beautiful/banner-bracelets.jpg",
    alt: "Lorenzo Ricci brățări, placare cu aur de 18K",
    title: "Brățări",
  },
  {
    href: "/ro/bijuterii?category=necklaces",
    src: "/beautiful/banner-necklaces.jpg",
    alt: "Lorenzo Ricci coliere, placare cu aur de 18K",
    title: "Coliere",
  },
];

const FEATURES = [
  { title: "Placare PVD cu aur de 18K", desc: "Acoperire în 4 straturi, rezistentă la apă, transpirație și parfum" },
  { title: "Oțel 316L", desc: "Bază hipoalergenică, sigură pentru orice tip de piele" },
  { title: "Garanție pe viață", desc: "Stăm în spatele fiecărei bijuterii, fără excepție" },
];

export function RoJewellerySection() {
  const featuresRef = useReveal();

  return (
    <section className="py-28 sm:py-40 bg-ivory-warm border-y border-border">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-16">
          <p className="section-tag mb-4">Bijuterii</p>
          <h2 className="section-title mb-4">Colecția de bijuterii</h2>
          <div className="gold-divider" />
          <p className="font-sans text-sm font-light text-ink-muted max-w-md mx-auto mt-6 tracking-wide leading-relaxed">
            Placare cu aur de 18K · Design italian · Stil etern
          </p>
        </div>

        {/* Category banners */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-16">
          {BANNERS.map(({ href, src, alt, title }) => (
            <Link
              key={href}
              href={href}
              className="group relative overflow-hidden h-[360px] sm:h-[420px] block"
            >
              <Image
                src={src}
                alt={alt}
                fill
                quality={90}
                sizes="(max-width: 640px) 100vw, 50vw"
                className="object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent group-hover:opacity-80 transition-opacity duration-500" />
              <div className="absolute bottom-7 left-7 right-7">
                <p className="font-sans text-[9px] tracking-[0.32em] uppercase text-white/55 mb-2">
                  Colecția
                </p>
                <h3 className="font-serif text-4xl text-white leading-tight mb-4">
                  {title}
                </h3>
                <span className="inline-flex items-center gap-2 font-sans text-[10px] tracking-[0.22em] uppercase text-white/65 group-hover:text-white transition-colors duration-300">
                  Descoperiți
                  <span className="group-hover:translate-x-1 transition-transform duration-300 inline-block">→</span>
                </span>
              </div>
            </Link>
          ))}
        </div>

        {/* Feature row */}
        <div ref={featuresRef} className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
          {FEATURES.map(({ title, desc }, i) => (
            <div key={title} className={`reveal reveal-delay-${i + 1} flex flex-col items-center gap-3`}>
              <div className="w-px h-8 bg-navy/40 mb-1" />
              <h3 className="font-serif text-xl text-charcoal">{title}</h3>
              <p className="font-sans text-xs font-light text-ink-muted tracking-wide leading-relaxed max-w-xs">
                {desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
