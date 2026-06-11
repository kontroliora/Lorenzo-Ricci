"use client";
import Image from "next/image";
import Link from "next/link";

export function EditorialJewellery() {
  return (
    <section className="w-full bg-charcoal-deep">
      {/* Split: large image left + text right + smaller image */}
      <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[600px]">
        {/* Left - our story main image */}
        <div className="relative overflow-hidden min-h-[480px] lg:min-h-0 group">
          <Image
            src="/story/watchmaker.webp"
            alt="Lorenzo Ricci - Нашата история"
            fill
            quality={90}
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover object-center transition-transform duration-[1200ms] group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        </div>

        {/* Right - text + small images */}
        <div className="flex flex-col">
          {/* Top half - text editorial */}
          <div className="flex-1 flex flex-col justify-center px-10 sm:px-16 py-16 bg-charcoal-deep">
            <p className="font-sans text-[10px] tracking-[0.32em] uppercase text-white/35 mb-5">
              Lorenzo Ricci
            </p>
            <h2 className="font-serif text-display-md text-white leading-tight mb-6">
              Нашата
              <br />
              <em className="not-italic text-white">история</em>
            </h2>
            <p className="font-sans text-sm font-light text-white/45 leading-relaxed tracking-wide mb-8 max-w-xs">
              Вдъхновени от италианското майсторство и страстта към прецизността - създаваме часовници и бижута, родени да се носят с гордост.
            </p>
            <Link
              href="/story"
              className="inline-flex items-center gap-3 w-fit group/btn"
            >
              <span className="font-sans text-[10px] tracking-[0.28em] uppercase text-white/60 group-hover/btn:text-white transition-colors duration-300">
                Научи повече
              </span>
              <span className="text-white/40 group-hover/btn:text-white group-hover/btn:translate-x-1 transition-all duration-300">→</span>
            </Link>
          </div>

          {/* Bottom half - two story images */}
          <div className="grid grid-cols-2 h-64 sm:h-72">
            <div className="relative overflow-hidden group">
              <Image
                src="/story/craft.webp"
                alt="Lorenzo Ricci - майсторска изработка"
                fill
                quality={85}
                sizes="25vw"
                className="object-cover object-center transition-transform duration-700 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-black/30 group-hover:bg-black/15 transition-colors duration-500" />
              <div className="absolute bottom-4 left-4">
                <p className="font-sans text-[9px] tracking-widest uppercase text-white/60">Изработка</p>
              </div>
            </div>
            <div className="relative overflow-hidden group">
              <Image
                src="/story/detail.webp"
                alt="Lorenzo Ricci - детайл и прецизност"
                fill
                quality={85}
                sizes="25vw"
                className="object-cover object-center transition-transform duration-700 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-black/20 group-hover:bg-black/5 transition-colors duration-500" />
              <div className="absolute bottom-4 left-4">
                <p className="font-sans text-[9px] tracking-widest uppercase text-white/60">Детайл</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
