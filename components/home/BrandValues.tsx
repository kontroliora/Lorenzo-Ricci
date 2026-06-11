"use client";
import { useReveal } from "@/lib/useReveal";

export function BrandValues() {
  const gridRef = useReveal();

  const values = [
    {
      icon: "◈",
      title: "Сапфирен Кристал",
      desc: "Изключителна яснота и защита от надраскване - стандарт на Swiss-made часовниците.",
    },
    {
      icon: "⊕",
      title: "Японски Механизъм",
      desc: "Прецизен кварцов хронограф с живот над 10 години. Никога не губи точност.",
    },
    {
      icon: "◇",
      title: "316L Стомана",
      desc: "Хирургична стомана - хипоалергенна, нержавяваща, вечна.",
    },
    {
      icon: "◎",
      title: "5 ATM Водоустойчивост",
      desc: "Дъжд, плаж, ежедневие - без компромис с външния вид.",
    },
  ];

  return (
    <section className="py-28 sm:py-40 border-y border-border bg-white">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <div className="text-center mb-16">
          <p className="section-tag mb-4">Защо Lorenzo Ricci</p>
          <h2 className="section-title">Майсторска Изработка</h2>
          <div className="gold-divider" />
        </div>

        <div ref={gridRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {values.map(({ icon, title, desc }, i) => (
            <div
              key={title}
              className={`reveal reveal-delay-${i + 1} flex flex-col gap-4 pt-6 border-t border-border`}
            >
              <span className="text-navy text-2xl leading-none">{icon}</span>
              <h3 className="font-serif text-lg text-charcoal">{title}</h3>
              <p className="font-sans text-xs font-light text-ink-muted leading-relaxed tracking-wide">
                {desc}
              </p>
            </div>
          ))}
        </div>

        {/* Divider quote */}
        <div className="mt-20 text-center max-w-2xl mx-auto">
          <blockquote className="font-serif text-display-sm text-charcoal leading-relaxed">
            "Изтънчен италиански дизайн и майсторска изработка,
            <br />
            в която всеки детайл има значение."
          </blockquote>
          <div className="gold-divider mt-8" />
          <p className="font-sans text-xs text-ink-faint tracking-[0.25em] uppercase mt-4">
            Lorenzo Ricci · Основан с характер
          </p>
        </div>
      </div>
    </section>
  );
}
