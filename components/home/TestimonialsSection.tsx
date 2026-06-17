"use client";
import Image from "next/image";
import { useRef, useState, useEffect } from "react";
import type { Review } from "@/lib/types";

// Curated home-page testimonials - shown in this exact order
const FEATURED: Review[] = [
  {
    id: "ft-1",
    productSlug: "golden-eclipse",
    author: "Петър С.",
    rating: 5,
    title: "Класен е",
    body: "По принцип нося марки за хиляди левове, но реших да му дам шанс. Честно казано го заглеждат повече дори и от Rolex-ите ми, които имам...",
    imageUrl: "/reviews/golden-eclipse-ПетърС.webp",
    date: "2025-03-11",
  },
  {
    id: "ft-2",
    productSlug: "polar-frost",
    author: "Атила",
    rating: 5,
    title: "Издържа на вода",
    body: "Воден е. Цяло лято бях на море с него и нямах проблеми. Изработен е от висококачествени материали, а не като китайските боклуци от сплав.",
    imageUrl: "/reviews/polar-frost-АтилаСемн.webp",
    date: "2025-03-10",
  },
  {
    id: "ft-3",
    productSlug: "polar-frost",
    author: "Борис",
    rating: 5,
    body: "Синьото ми е любим цвят, затова купих синия. Не го свалям от ръката си. Засега съм доволен.",
    imageUrl: "/reviews/boris-review.webp",
    date: "2025-02-20",
  },
  {
    id: "ft-4",
    productSlug: "polar-frost",
    author: "Атанас",
    rating: 5,
    body: "За парите си е топ! Много съм доволен.",
    imageUrl: "/reviews/atanas-review.webp",
    date: "2025-02-15",
  },
  {
    id: "ft-5",
    productSlug: "golden-eclipse",
    author: "Благой",
    rating: 5,
    body: "Часовникът е просто уникален. Но кутията също ме впечатли - тежка, лъскав пиано лак в черно. Изглежда невероятно скъп.",
    imageUrl: "/reviews/blagoy-review.webp",
    date: "2025-01-18",
  },
  {
    id: "ft-6",
    productSlug: "golden-eclipse",
    author: "Павел Дойчев",
    rating: 5,
    body: "Часовника е уникат!! Забелязва се от далеч и изглежда супер скъп. За тези пари е наистина страхотен.",
    imageUrl: "/reviews/golden-eclipse-ПавелДойчев.webp",
    date: "2025-01-10",
  },
  {
    id: "ft-7",
    productSlug: "chrono-black",
    author: "Яна",
    rating: 5,
    body: "Купих го като подарък за съпруга ми. Той обича часовници. Хареса го и го носи всеки ден.",
    imageUrl: "/reviews/chrono-black-YanaS.webp",
    date: "2025-02-05",
  },
];

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5 text-navy text-xs">
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={i < rating ? "text-navy" : "text-ink-faint"}>
          ★
        </span>
      ))}
    </div>
  );
}

const PRODUCT_LABELS: Record<string, string> = {
  "chrono-black":          "Chrono Black",
  "golden-eclipse":        "Golden Eclipse",
  "polar-frost":           "Polar Frost",
  "bracelet-diamante-cross": "Гривна Diamante Cross",
  "bracelet-milano-forte":   "Гривна Milano Forte",
  "bracelet-milano-twist":   "Гривна Milano Twist",
  "bracelet-signature":      "Гривна Signature",
  "necklace-aurelius":       "Колие Aurelius Cross",
  "necklace-grande-imperiale": "Колие Grande Imperiale",
  "necklace-milano-forte":   "Колие Milano Forte",
  "necklace-milano-twist":   "Колие Milano Twist",
};

function ReviewCard({ review }: { review: Review }) {
  const body = review.body?.replace(/-|-/g, "-") ?? "";
  const productLabel = review.productSlug ? PRODUCT_LABELS[review.productSlug] : null;

  return (
    <div className="flex-shrink-0 snap-start w-[85vw] sm:w-[calc(33.333%-14px)] review-card flex flex-col p-6">

      {/* Text - sits at top, takes only its natural height */}
      <div>
        <StarRating rating={review.rating} />
        {review.title && (
          <h4 className="font-serif text-lg text-charcoal leading-snug mt-3">{review.title}</h4>
        )}
        <p className="font-sans text-sm font-light text-ink-soft leading-relaxed mt-3 line-clamp-4">
          {body}
        </p>
      </div>

      {/* Image + Footer anchored together to the bottom - mt-auto pushes this whole block down */}
      <div className="mt-auto pt-4">
        {/* Fixed-height image box */}
        <div className="relative w-full h-[280px] shrink-0 flex items-center justify-center border border-border bg-ivory-warm">
          {review.imageUrl ? (
            <Image
              src={review.imageUrl}
              alt={`Ревю от ${review.author}`}
              fill
              quality={80}
              sizes="(max-width: 640px) 85vw, 33vw"
              className="object-contain"
            />
          ) : (
            <div className="w-full h-full" />
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center border-t border-border pt-3 mt-4">
          <div className="flex flex-col gap-0.5">
            <span className="font-sans text-xs font-medium text-charcoal tracking-wide">
              {review.author}
            </span>
            {productLabel && (
              <span className="font-sans text-[10px] text-ink-faint tracking-wide">
                {productLabel}
              </span>
            )}
          </div>
          <span className="font-sans text-[10px] text-navy font-medium tracking-wide shrink-0 ml-3">
            ✓ Верифициран
          </span>
        </div>
      </div>

    </div>
  );
}

export function TestimonialsSection() {
  const carouselRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(true);

  const sorted = FEATURED;

  const checkScroll = () => {
    const el = carouselRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  };

  useEffect(() => {
    checkScroll();
  }, []);

  const scroll = (dir: "prev" | "next") => {
    const el = carouselRef.current;
    if (!el) return;
    const amount = el.offsetWidth / (window.innerWidth >= 640 ? 3 : 1) + 20;
    el.scrollBy({ left: dir === "next" ? amount : -amount, behavior: "smooth" });
    setTimeout(checkScroll, 550);
  };

  return (
    <section className="py-28 sm:py-40 bg-ivory-warm border-y border-border overflow-hidden">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <p className="section-tag mb-4">Верифицирани Ревюта</p>
          <h2 className="section-title mb-4">Какво казват клиентите</h2>
          <div className="gold-divider" />
          <div className="flex items-center justify-center gap-3 mt-6">
            <span className="text-navy text-sm">★★★★★</span>
            <span className="font-sans text-sm font-light text-ink-muted">4.8 от 5</span>
          </div>
        </div>

        {/* Carousel */}
        <div className="relative">
          {/* Prev */}
          <button
            onClick={() => scroll("prev")}
            className={`hidden sm:flex absolute -left-5 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white border border-border items-center justify-center shadow-sm hover:bg-ivory-warm transition-all duration-200 ${
              canPrev ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
            aria-label="Предишно"
          >
            <span className="text-xl leading-none text-charcoal">‹</span>
          </button>

          {/* Track */}
          <div
            ref={carouselRef}
            onScroll={checkScroll}
            className="flex items-stretch gap-5 overflow-x-auto snap-x snap-mandatory"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {sorted.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </div>

          {/* Next */}
          <button
            onClick={() => scroll("next")}
            className={`hidden sm:flex absolute -right-5 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white border border-border items-center justify-center shadow-sm hover:bg-ivory-warm transition-all duration-200 ${
              canNext ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
            aria-label="Следващо"
          >
            <span className="text-xl leading-none text-charcoal">›</span>
          </button>
        </div>

        {/* Dot indicators (mobile) */}
        <div className="flex justify-center gap-1.5 mt-6 sm:hidden">
          {sorted.map((_, i) => (
            <div key={i} className="w-1.5 h-1.5 rounded-full bg-border" />
          ))}
        </div>
      </div>
    </section>
  );
}
