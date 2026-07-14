"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useReveal } from "@/lib/useReveal";

type LeatherItem = { id: string; slug: string; name: string; sub: string; src: string; soldOut?: boolean };

const WALLETS: LeatherItem[] = [
  { id: "alabastro", slug: "wallet-alabastro",    name: 'Lorenzo Ricci "Alabastro"', sub: "Бял портфейл от крокодилска кожа",    src: `/Products/wallets/Alabastro/portfeil-alabastro-byal-krokodiilska-kozha.webp` },
  { id: "rubino",    slug: "wallet-rubino",       name: 'Lorenzo Ricci "Rubino"',    sub: "Червен портфейл от крокодилска кожа", src: `/Products/wallets/Rubino/portfeil-rubino-cherven-krokodiilska-kozha.webp` },
  { id: "smeraldo",  slug: "wallet-smeraldo",     name: 'Lorenzo Ricci "Smeraldo"',  sub: "Зелен портфейл от крокодилска кожа",  src: `/Products/wallets/Smeraldo/portfeil-smeraldo-zelen-krokodiilska-kozha.webp`, soldOut: true },
];

const CARDHOLDERS: LeatherItem[] = [
  { id: "ambra",     slug: "cardholder-ambra",     name: 'Lorenzo Ricci "Ambra"',     sub: "Оранжев кардхолдър от крокодилска кожа", src: `/Products/wallets/Ambra/kardholder-ambra-oranjev-krokodiilska-kozha.webp` },
  { id: "bianco",    slug: "cardholder-bianco",    name: 'Lorenzo Ricci "Bianco"',    sub: "Бял кожен кардхолдър",                   src: `/Products/wallets/Bianco/kardholder-bianco-byal-krokodiilska-kozha.webp` },
  { id: "valentina", slug: "cardholder-valentina", name: 'Lorenzo Ricci "Valentina"', sub: "Розов кардхолдър от крокодилска кожа",   src: `/Products/wallets/Valentina/kardholder-valentina-rozov-krokodiilska-kozha.webp` },
  { id: "zaffiro",   slug: "cardholder-zaffiro",   name: 'Lorenzo Ricci "Zaffiro"',   sub: "Тъмносин кардхолдър от крокодилска кожа",src: `/Products/wallets/Zaffiro/kardholder-zaffiro-sinen-krokodiilska-kozha.webp` },
];

function LeatherCard({ item, sold, sizes }: { item: LeatherItem; sold: boolean; sizes: string }) {
  return (
    <Link href={`/products/${item.slug}`} className="group flex flex-col">
      <div className="relative aspect-square bg-ivory-warm border border-border overflow-hidden">
        <Image
          src={item.src}
          alt={`${item.name} - ${item.sub}, Crocodylus Siamensis, CITES сертифициран, ръчна изработка`}
          fill
          quality={80}
          sizes={sizes}
          className={`object-contain p-4 transition-transform duration-500 group-hover:scale-105 ${sold ? "opacity-50 grayscale" : ""}`}
        />
        {sold && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="font-sans text-[10px] tracking-[0.25em] uppercase bg-charcoal text-white px-3 py-1.5">
              Изчерпан
            </span>
          </div>
        )}
      </div>
      <div className="pt-2 sm:pt-3">
        <h3 className={`font-serif text-sm sm:text-base leading-snug ${sold ? "text-ink-faint" : "text-charcoal group-hover:text-navy transition-colors duration-200"}`}>
          {item.name}
        </h3>
        <p className="font-sans text-[10px] text-ink-muted mt-0.5 tracking-wide">
          {sold ? "Изчерпан" : item.sub}
        </p>
      </div>
    </Link>
  );
}

export function WalletsSection() {
  const featuresRef = useReveal();
  // Live stock (wallet_inventory) → shows "Изчерпан" without hardcoding it. One
  // batched call; a static soldOut flag stays as a fallback if the fetch fails.
  const [outOfStock, setOutOfStock] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    fetch("/api/leather-stock")
      .then((r) => r.json())
      .then((map: Record<string, number>) => {
        if (cancelled || !map || typeof map !== "object") return;
        const out: Record<string, boolean> = {};
        for (const [slug, stock] of Object.entries(map)) out[slug] = Number(stock) <= 0;
        setOutOfStock(out);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const isSold = (item: LeatherItem) => Boolean(item.soldOut || outOfStock[item.slug]);

  return (
    <section className="py-28 sm:py-40 bg-white border-y border-border">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">

        {/* Header */}
        <div className="text-center mb-8 sm:mb-16">
          <p className="section-tag mb-4">Crocodylus Siamensis</p>
          <h2 className="section-title mb-4">Кожени Аксесоари</h2>
          <div className="gold-divider" />
          <p className="font-sans text-sm font-light text-ink-muted max-w-md mx-auto mt-6 tracking-wide leading-relaxed">
            100% Естествена Крокодилска Кожа · CITES Сертифициран · Ръчна Изработка
          </p>
        </div>

        {/* Wallets row */}
        <div className="mb-6 sm:mb-10">
          <div className="flex items-center gap-4 mb-3 sm:mb-5">
            <p className="font-sans text-[10px] tracking-[0.28em] uppercase text-ink-faint">Портфейли</p>
            <div className="flex-1 h-px bg-border" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
            {WALLETS.map((w) => (
              <LeatherCard key={w.id} item={w} sold={isSold(w)} sizes="(max-width: 640px) 50vw, 33vw" />
            ))}
          </div>
        </div>

        {/* Cardholders row */}
        <div className="mb-8 sm:mb-16">
          <div className="flex items-center gap-4 mb-3 sm:mb-5">
            <p className="font-sans text-[10px] tracking-[0.28em] uppercase text-ink-faint">Кардхолдъри</p>
            <div className="flex-1 h-px bg-border" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            {CARDHOLDERS.map((c) => (
              <LeatherCard key={c.id} item={c} sold={isSold(c)} sizes="(max-width: 640px) 50vw, 25vw" />
            ))}
          </div>
        </div>

        {/* Certificate feature strip */}
        <div ref={featuresRef} className="grid grid-cols-1 sm:grid-cols-4 gap-8 text-center">
          {[
            {
              title: "100% Крокодилска Кожа",
              desc: "Вид Crocodylus Siamensis - най-рядката и ценна кожа в света",
            },
            {
              title: "CITES Сертифициран",
              desc: "Произход №: 25VN4174/S - документиран и легален произход",
            },
            {
              title: "Ръчна Изработка",
              desc: "Всяко изделие е уникално, ръчно изработено от майстор",
            },
            {
              title: "Луксозна Опаковка",
              desc: "Идва в подаръчна кутия със Сертификат за автентичност",
            },
          ].map(({ title, desc }, i) => (
            <div
              key={title}
              className={`reveal reveal-delay-${i + 1} flex flex-col items-center gap-3`}
            >
              <div className="w-px h-8 bg-navy/40 mb-1" />
              <h3 className="font-serif text-base text-charcoal">{title}</h3>
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
