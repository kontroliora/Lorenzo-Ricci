"use client";
import Image from "next/image";
import Link from "next/link";

const PANELS = [
  {
    src: "/beautiful/chrono-penthouse.webp",
    model: "Chrono Black",
    slug: "chrono-black",
    tag: "Noble Vanguard",
    position: "object-center",
  },
  {
    src: "/beautiful/polar-tokyo.webp",
    model: "Polar Frost",
    slug: "polar-frost",
    tag: "Noble Vanguard",
    position: "object-center",
  },
  {
    src: "/beautiful/eclipse-lume.webp",
    model: "Golden Eclipse",
    slug: "golden-eclipse",
    tag: "Noble Vanguard",
    position: "object-center",
  },
];

export function EditorialWatches() {
  return (
    <section className="w-full">
      {/* Top label */}
      <div className="bg-navy py-5 px-5 sm:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <p className="font-sans text-[10px] tracking-[0.3em] uppercase text-white/50">
            Noble Vanguard Collection
          </p>
          <Link
            href="/watches"
            className="font-sans text-[10px] tracking-[0.22em] uppercase text-white/50 hover:text-white transition-colors duration-300 flex items-center gap-2"
          >
            Виж всички
            <span className="text-xs">→</span>
          </Link>
        </div>
      </div>

      {/* 3-panel editorial grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 h-[90vh] max-h-[780px] min-h-[500px]">
        {PANELS.map((panel, i) => (
          <Link
            key={panel.slug}
            href={`/products/${panel.slug}`}
            className="group relative overflow-hidden block"
          >
            <Image
              src={panel.src}
              alt={panel.model}
              fill
              quality={90}
              sizes="(max-width: 768px) 100vw, 33vw"
              className={`object-cover ${panel.position} transition-transform duration-[1200ms] ease-out group-hover:scale-105`}
            />

            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/30 group-hover:from-black/70 transition-all duration-700" />

            {/* Vertical divider */}
            {i < PANELS.length - 1 && (
              <div className="hidden md:block absolute top-0 right-0 w-px h-full bg-white/8 z-10" />
            )}

            {/* Bottom content */}
            <div className="absolute bottom-0 inset-x-0 p-8 translate-y-2 group-hover:translate-y-0 transition-transform duration-500">
              <p className="font-sans text-[9px] tracking-[0.3em] uppercase text-white/40 mb-2">
                {panel.tag}
              </p>
              <h3 className="font-serif text-3xl sm:text-4xl text-white mb-4 leading-none">
                {panel.model}
              </h3>
              <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                <div className="w-6 h-px bg-white/60" />
                <span className="font-sans text-[10px] tracking-[0.22em] uppercase text-white/70">
                  Разгледай
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
