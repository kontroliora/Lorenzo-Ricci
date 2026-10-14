import Image from "next/image";
import { RoComparisonSlider } from "./RoComparisonSlider";

// Romanian counterpart of components/product/JewelleryDescription.tsx: same blocks, images and claims, Romanian wording.

const DESC1 = "/Products/jewellery/description/desc1.webp";
const DESC2 = "/Products/jewellery/description/desc2.webp";

// "Title - description" (the first " - " splits the two).
const LR_POINTS = [
  "Acoperire PVD 18K în 4 straturi - Depunere în vid a aurului autentic, pentru o durabilitate maximă",
  "Rezistență la transpirație și parfum - Formulă concepută pentru purtare zilnică, fără pierderea strălucirii",
  "Aliaj hipoalergenic (316L) - Oțel chirurgical, complet sigur pentru pielea sensibilă",
  "Garanție pe viață - Garantăm calitatea fiecărei bijuterii din colecția noastră",
];

const OTHER_POINTS = [
  "Placare subțire și ieftină - Se estompează și se șterge după doar câteva săptămâni de purtare",
  "Aliaje de calitate inferioară - Conțin adesea nichel sau cupru, care pătează și irită pielea",
  "Vulnerabile la apă și umezeală - Își schimbă rapid culoarea și își pierd strălucirea inițială",
  "Lipsa unei garanții pe termen lung - Riscul uzurii rapide rămâne în totalitate în sarcina cumpărătorului",
];

// ── Alternating feature block ─────────────────────────────────────────────
interface FeatureBlockProps {
  imageSrc: string;
  imageAlt: string;
  tag: string;
  heading: string;
  body: string;
  reverse?: boolean;
}

function FeatureBlock({ imageSrc, imageAlt, tag, heading, body, reverse = false }: FeatureBlockProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 items-stretch border-b border-border last:border-b-0">

      {/* Mobile-only: heading above image */}
      <div className="md:hidden px-8 pt-10 pb-5 bg-white">
        <p className="font-sans text-[9px] font-medium tracking-[0.34em] uppercase text-navy/45 mb-4">
          {tag}
        </p>
        <h2 className="font-serif text-display-sm text-charcoal leading-tight">
          {heading}
        </h2>
        <div className="w-8 h-px bg-navy/20 mt-5" />
      </div>

      {/* Image */}
      <div className={`bg-ivory-paper ${reverse ? "md:order-2" : "md:order-1"}`}>
        <Image
          src={imageSrc}
          alt={imageAlt}
          width={900}
          height={900}
          quality={85}
          sizes="(min-width: 768px) 50vw, 100vw"
          className="w-full h-auto block"
          unoptimized
        />
      </div>

      {/* Text column - full on desktop, body-only on mobile */}
      <div
        className={`flex flex-col justify-center px-8 md:px-14 lg:px-20 py-8 md:py-20 bg-white ${
          reverse ? "md:order-1" : "md:order-2"
        }`}
      >
        {/* Desktop heading */}
        <div className="hidden md:block">
          <p className="font-sans text-[9px] font-medium tracking-[0.34em] uppercase text-navy/45 mb-5">
            {tag}
          </p>
          <h2 className="font-serif text-display-sm text-charcoal leading-tight mb-5">
            {heading}
          </h2>
          <div className="w-8 h-px bg-navy/20 mb-6" />
        </div>
        {/* Body - always visible */}
        <p className="font-sans text-sm font-light text-ink-soft leading-[1.9] tracking-[0.02em] pb-10 md:pb-0">
          {body}
        </p>
      </div>
    </div>
  );
}

// ── Comparison block - live HTML, two-panel ────────────────────────────────
function ComparisonBlock() {
  return (
    <div className="bg-charcoal-deep overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-2">

        {/* Lorenzo Ricci side */}
        <div className="px-8 md:px-12 py-10 border-b border-white/[0.07] md:border-b-0 md:border-r md:border-white/[0.07]">
          <p className="font-sans text-[9px] font-medium tracking-[0.36em] uppercase text-white/35 mb-2">
            Calitatea
          </p>
          <p className="font-serif text-xl text-white mb-7 leading-snug">
            Lorenzo Ricci
          </p>
          <div className="flex flex-col gap-5">
            {LR_POINTS.map((point) => {
              const [title, desc] = point.split(" - ");
              return (
                <div key={point} className="flex items-start gap-3.5">
                  <span className="text-emerald-400 text-base leading-none flex-shrink-0 select-none mt-0.5">✓</span>
                  <div>
                    <p className="font-sans text-sm font-medium text-white/90 tracking-wide leading-snug">{title}</p>
                    {desc && <p className="font-sans text-xs font-light text-white/45 tracking-wide leading-relaxed mt-0.5">{desc}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Other brands side */}
        <div className="px-8 md:px-12 py-10">
          <p className="font-sans text-[9px] font-medium tracking-[0.36em] uppercase text-white/35 mb-2">
            Specific pentru
          </p>
          <p className="font-serif text-xl text-white/40 mb-7 leading-snug">
            Alte mărci
          </p>
          <div className="flex flex-col gap-5">
            {OTHER_POINTS.map((point) => {
              const [title, desc] = point.split(" - ");
              return (
                <div key={point} className="flex items-start gap-3.5">
                  <span className="text-red-400/60 text-base leading-none flex-shrink-0 select-none mt-0.5">✕</span>
                  <div>
                    <p className="font-sans text-sm font-medium text-white/40 tracking-wide leading-snug">{title}</p>
                    {desc && <p className="font-sans text-xs font-light text-white/25 tracking-wide leading-relaxed mt-0.5">{desc}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────
export function RoJewelleryDescription() {
  return (
    <div className="w-full mt-16">

      {/* Zig-zag storytelling blocks */}
      <div className="border border-border overflow-hidden">
        <FeatureBlock
          imageSrc={DESC1}
          imageAlt="Lorenzo Ricci - acoperire PVD 18K în 4 straturi, comparată cu placarea standard"
          tag="Tehnologie PVD · Depunere în vid"
          heading="Acoperire PVD 18K în 4 straturi, față de placarea standard"
          body="Produsele noastre sunt realizate prin tehnologia inovatoare PVD (Physical Vapor Deposition), într-un mediu de vid. Procesul constă în depunerea a 4 straturi dense de aur autentic de 18 karate pe oțel medical de înaltă calitate (316L). Aceasta asigură o rezistență de până la 10 ori mai mare decât cea a placării galvanice obișnuite și protejează bijuteria de decolorare, uzură și întunecare în contactul zilnic cu apa, transpirația sau parfumul."
        />
        <FeatureBlock
          imageSrc={DESC2}
          imageAlt="Lorenzo Ricci - ștampila ITALY și 750, estetică italiană"
          tag="Estetică italiană · Marcaj 750"
          heading="Eleganță în detalii: ștampila ITALY și 750"
          body="Ca omagiu adus tradiției bijuteriei italiene, fiecare piesă poartă gravate cu precizie marcajele clasice „ITALY” și „750”. Marcajul „750” atestă puritatea aurului de 18 karate din stratul exterior al produsului. Acest detaliu oferă o finisare autentică și o senzație de greutate, îmbinând estetica milaneză atemporală cu o rezistență modernă, fără compromisuri."
          reverse
        />
      </div>

      {/* Image comparison slider */}
      <div className="mt-10 overflow-hidden border border-border">
        <RoComparisonSlider />
      </div>

      {/* Comparison block */}
      <div className="mt-4">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-4 h-px bg-navy/30" />
          <p className="font-sans text-[10px] font-medium tracking-[0.24em] uppercase text-navy">
            Lorenzo Ricci în comparație cu alte mărci
          </p>
          <div className="flex-1 h-px bg-border" />
        </div>
        <ComparisonBlock />
      </div>

    </div>
  );
}
