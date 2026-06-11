import Image from "next/image";

const TEXTURE_IMG = "/Products/wallets/description/croco 3.png";

const BULLETS = [
  {
    term: "CITES Сертификат",
    desc: "Официално удостоверен легален произход и 100% автентичност на кожата от сиамски крокодил.",
  },
  {
    term: "Естествен релеф",
    desc: "Уникална органична текстура, гарантираща, че притежавате единствен по рода си аксесоар без аналог.",
  },
  {
    term: "Функционален ред",
    desc: "Прецизно вътрешно разпределение за бърз достъп до вашите карти и банкноти.",
  },
  {
    term: "Благородна патина",
    desc: "Високотехнологична обработка, която позволява на естествената кожа да старее красиво и с характер.",
  },
];

export function LeatherDescription() {
  return (
    <div className="mt-16 border-t border-border">

      {/* ── Image left + Bullets right — max-w-4xl, centred ─────────────── */}
      <div className="max-w-4xl mx-auto px-6 py-14 md:py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-14 items-center">

          {/* Image — left on desktop, above bullets on mobile */}
          <div className="relative aspect-square overflow-hidden">
            <Image
              src={TEXTURE_IMG}
              alt="Кожа от сиамски крокодил - Lorenzo Ricci Exotic Collection"
              fill
              quality={90}
              sizes="(min-width: 768px) 448px, 100vw"
              className="object-cover object-center"
              unoptimized
            />
          </div>

          {/* Bullets — right on desktop, below image on mobile */}
          <div>
            <h3 className="font-serif text-xl text-charcoal mb-7 leading-snug">
              Автентичност и Структура
            </h3>

            <div className="flex flex-col gap-5">
              {BULLETS.map(({ term, desc }) => (
                <div key={term} className="flex gap-4">
                  <div className="w-px bg-navy/20 flex-shrink-0 mt-1" />
                  <div>
                    <p className="font-sans text-sm font-medium text-charcoal tracking-wide mb-0.5">
                      {term}
                    </p>
                    <p className="font-sans text-sm font-light text-ink-soft leading-relaxed">
                      {desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
