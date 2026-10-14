import Image from "next/image";
import type { Product } from "@/lib/types";

interface Props {
  product: Product;  // already localized (localizeProduct)
  videoSrc?: string; // per-product description video (cardholders)
}

// Does the product's own (localized) text claim a CITES permit/certificate? The certificate bullet is shown
// only then - never for a product whose data does not say it (some batches carry no permit number).
function mentionsCites(p: Product): boolean {
  const texts = [
    p.description,
    p.materialNote ?? "",
    ...(p.tabDescription ?? []),
    ...p.features,
    ...p.specs.map((s) => `${s.label} ${s.value}`),
    ...(p.descriptionSections ?? []).flatMap((s) => [s.heading, ...(Array.isArray(s.body) ? s.body : [s.body])]),
  ];
  return texts.some((t) => /cites/i.test(t));
}

// Species-dependent copy lives here, not as a module-level constant: the species is only ever the one confirmed
// for that specific product (Product.crocodileSpecies), never a default.
function buildBullets(p: Product) {
  const isBag = p.category === "bags";
  const species = p.crocodileSpecies;
  const skinPhrase = species ? `pielii de ${species}` : "pielii de crocodil";
  return [
    mentionsCites(p)
      ? {
          term: "Certificat CITES",
          desc: `Origine legală atestată oficial și autenticitatea ${skinPhrase}.`,
        }
      : {
          term: "Piele autentică de crocodil",
          desc: species ? `Specia: ${species}.` : "Piele naturală de crocodil.",
        },
    {
      term: "Relief natural",
      desc: "Textură organică, caracteristică pielii autentice.",
    },
    isBag
      ? {
          term: "Organizare funcțională",
          desc: "Compartimentare interioară precisă, potrivită formei unui clutch de seară.",
        }
      : {
          term: "Organizare funcțională",
          desc: "Compartimentare precisă pentru acces rapid la cardurile și bancnotele dumneavoastră.",
        },
    isBag
      ? {
          term: "Finisare manuală",
          desc: "Fiecare detaliu este verificat și finisat manual, înainte ca clutch-ul să părăsească atelierul.",
        }
      : {
          term: "Patină nobilă",
          desc: "Un tratament avansat permite pielii naturale să îmbătrânească frumos, cu caracter.",
        },
  ];
}

export function RoLeatherDescription({ product, videoSrc }: Props) {
  const bullets = buildBullets(product);
  const image = product.descriptionImage;
  const hasMedia = Boolean(videoSrc || image);
  return (
    <div className="mt-16 border-t border-border">

      {/* ── Media left + Bullets right when there's media to show; bullets alone,
          narrower and centred, when there isn't ──────── */}
      <div className={`mx-auto px-6 py-14 md:py-20 ${hasMedia ? "max-w-4xl" : "max-w-xl"}`}>
        <div className={hasMedia ? "grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-14 items-center" : undefined}>

          {/* Left: video (cardholders) or static image (bags) - omitted entirely when neither is set */}
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
                  // The catalogue's alt is Bulgarian and not part of the Romanian overlay: describe the photo here.
                  alt={`${product.name} - detaliu al texturii pielii de crocodil`}
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
              Autenticitate și structură
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
