import Image from "next/image";

interface Props {
  videoSrc?: string;
  crocodileSpecies?: string; // from Product.crocodileSpecies - never defaulted, see lib/types.ts
  isBag?: boolean; // bags (clutches, Milano Avorio) get their own "Функционален ред" /
  // "Ръчно завършване" copy - a wallet's "quick access to cards and cash" line doesn't
  // describe a clutch. Wallets/cardholders keep the original wording.
  image?: { src: string; alt: string }; // from Product.descriptionImage - a real macro shot of
  // THIS product's own leather. Per-product, not per-category: only set once a genuine texture
  // close-up exists for that product (see lib/products.ts BAGS-section TODO for who's missing
  // one). No generic fallback when unset - a stand-in photo of leather that isn't this product's
  // own was worse than showing nothing (see chat, 2026-09-24). The media column is simply
  // omitted, and the bullets take the full width instead.
}

// Species-dependent copy lives here, not as a module-level constant, since the
// CITES-certificate line must never assume a species that hasn't been confirmed
// for that specific product (see lib/products.ts BAGS-section TODO).
function buildBullets(crocodileSpecies?: string, isBag?: boolean) {
  const skinPhrase = crocodileSpecies ? `кожата от ${crocodileSpecies}` : "крокодилската кожа";
  return [
    {
      term: "CITES Сертификат",
      desc: `Официално удостоверен легален произход и 100% автентичност на ${skinPhrase}.`,
    },
    {
      term: "Естествен релеф",
      desc: "Органична текстура, характерна за автентичната кожа.",
    },
    isBag
      ? {
          term: "Функционален ред",
          desc: "Прецизно вътрешно разпределение, съобразено с формата на вечерен клъч.",
        }
      : {
          term: "Функционален ред",
          desc: "Прецизно вътрешно разпределение за бърз достъп до вашите карти и банкноти.",
        },
    isBag
      ? {
          term: "Ръчно завършване",
          desc: "Всеки детайл е прегледан и завършен на ръка, преди клъчът да напусне ателието.",
        }
      : {
          term: "Благородна патина",
          desc: "Високотехнологична обработка, която позволява на естествената кожа да старее красиво и с характер.",
        },
  ];
}

export function LeatherDescription({ videoSrc, crocodileSpecies, isBag, image }: Props) {
  const bullets = buildBullets(crocodileSpecies, isBag);
  const hasMedia = Boolean(videoSrc || image);
  return (
    <div className="mt-16 border-t border-border">

      {/* ── Media left + Bullets right when there's media to show; bullets alone,
          narrower and centred, when there isn't (see Props.image above) ──────── */}
      <div className={`mx-auto px-6 py-14 md:py-20 ${hasMedia ? "max-w-4xl" : "max-w-xl"}`}>
        <div className={hasMedia ? "grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-14 items-center" : undefined}>

          {/* Left: video (cardholders) or static image (wallets/bags) - omitted entirely
              when neither is set, rather than standing in a generic photo */}
          {hasMedia && (
            <div className="relative aspect-square overflow-hidden">
              {videoSrc ? (
                <video
                  src={videoSrc}
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="metadata"
                  className="w-full h-full object-cover"
                />
              ) : (
                <Image
                  src={image!.src}
                  alt={image!.alt}
                  fill
                  quality={90}
                  sizes="(min-width: 768px) 448px, 100vw"
                  className="object-cover object-center"
                  unoptimized
                />
              )}
            </div>
          )}

          {/* Bullets - right of the media on desktop when media exists (below it on
              mobile), full width alone otherwise */}
          <div>
            <h3 className="font-serif text-xl text-charcoal mb-7 leading-snug">
              Автентичност и Структура
            </h3>

            <div className="flex flex-col gap-5">
              {bullets.map(({ term, desc }) => (
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
