import Image from "next/image";
import { ComparisonSlider } from "./ComparisonSlider";

const DESC1 = "/Products/jewellery/description/desc1.webp";
const DESC2 = "/Products/jewellery/description/desc2.webp";

const LR_POINTS = [
  "4-слойно 18K PVD покритие - Вакуумно нанасяне на истинско злато за максимална дълготрайност",
  "Устойчивост на пот и парфюм - Формула, проектирана за ежедневно носене без загуба на блясък",
  "Хипоалергенна сплав (316L) - Хирургична стомана, напълно безопасна за чувствителна кожа",
  "Доживотна гаранция - Заставаме зад качеството на всяко едно бижу от колекцията ни",
];

const OTHER_POINTS = [
  "Тънко и евтино позлатяване - Избледнява и се изтрива след само няколко седмици носене",
  "Сплави с ниско качество - Често съдържат никел или мед, които оцветяват и дразнят кожата",
  "Уязвими на вода и влага - Бързо променят цвета си и губят първоначалния си блясък",
  "Липса на дългосрочна гаранция - Рискът от бързо износване остава изцяло за сметка на купувача",
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

      {/* Text column — full on desktop, body-only on mobile */}
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
        {/* Body — always visible */}
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
            Качество на
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
            Типично за
          </p>
          <p className="font-serif text-xl text-white/40 mb-7 leading-snug">
            Други Брандове
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
export function JewelleryDescription() {
  return (
    <div className="w-full mt-16">

      {/* Zig-zag storytelling blocks */}
      <div className="border border-border overflow-hidden">
        <FeatureBlock
          imageSrc={DESC1}
          imageAlt="Lorenzo Ricci 4-слойно 18K PVD покритие срещу стандартна позлата"
          tag="PVD Технология · Вакуумно нанасяне"
          heading="4-Слойно 18K PVD Покритие срещу Стандартна Позлата"
          body="Нашите изделия се изработват по иновативна PVD (Physical Vapor Deposition) технология във вакуумна среда. Процесът включва нанасянето на 4 плътни слоя истинско 18-каратово злато върху висок клас медицинска стомана (316L). Това гарантира до 10 пъти по-висока устойчивост от обикновената галванична позлата, предпазвайки бижуто от избледняване, износване и потъмняване при ежедневен контакт с вода, пот или парфюм."
        />
        <FeatureBlock
          imageSrc={DESC2}
          imageAlt="Lorenzo Ricci печат ITALY и 750 - италианска естетика"
          tag="Италианска Естетика · Маркировка 750"
          heading="Елегантност в Детайлите: Печат ITALY & 750"
          body="Като комплимент към традицията на италианското ювелирно изкуство, всяко изделие носи прецизно гравирания класически белег 'ITALY' и '750'. Маркировката '750' сертифицира чистотата на 18-каратовото злато, вложено във външния слой на продукта. Този детайл придава автентичен завършек и усещане за тежест, съчетавайки вечната миланска естетика с безкомпромисна модерна здравина."
          reverse
        />
      </div>

      {/* Image comparison slider */}
      <div className="mt-10 overflow-hidden border border-border">
        <ComparisonSlider />
      </div>

      {/* Comparison block */}
      <div className="mt-4">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-4 h-px bg-navy/30" />
          <p className="font-sans text-[10px] font-medium tracking-[0.24em] uppercase text-navy">
            Lorenzo Ricci срещу другите марки
          </p>
          <div className="flex-1 h-px bg-border" />
        </div>
        <ComparisonBlock />
      </div>

    </div>
  );
}
