import Image from "next/image";
import type { Product } from "@/lib/types";

interface Props {
  product: Product;
}

// Split the editorial description into two paragraphs at a SENTENCE boundary
// (never mid-word). The layout wants two blocks; slicing by raw character count
// used to cut whole words in half (e.g. "скелетизира|ният"). One-sentence text
// stays a single paragraph.
function splitParagraphs(text: string): [string, string] {
  const sentences = text.match(/[^.]+\.(?:\s+|$)/g)?.map((s) => s.trim()) ?? [];
  if (sentences.length <= 1) return [text.trim(), ""];
  const mid = Math.ceil(sentences.length / 2);
  return [sentences.slice(0, mid).join(" "), sentences.slice(mid).join(" ")];
}

export function ProductEditorial({ product }: Props) {
  const imgs = product.descriptionImages;
  if (!imgs || imgs.length === 0) return null;

  const img1 = imgs[0];
  const img2 = imgs[1] ?? null;
  const [descPara1, descPara2] = splitParagraphs(product.description);

  return (
    <section className="mt-28 border-t border-border pt-20">

      {/* ── Editorial heading ─────────────────────────────────── */}
      <div className="text-center mb-20">
        <p className="section-tag mb-4">Lorenzo Ricci</p>
        <h2 className="font-serif text-display-lg text-charcoal leading-tight mb-4">
          Италиански дизайн.<br />
          <em className="not-italic">Японска точност.</em>
        </h2>
        <div className="gold-divider" />
      </div>

      {/* ── Split: text left, image right ─────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 mb-0">
        {/* Text */}
        <div className="flex flex-col justify-center px-5 sm:px-12 lg:px-16 py-16 lg:py-20 bg-white order-2 lg:order-1">
          <p className="font-sans text-[10px] tracking-[0.32em] uppercase text-ink-faint mb-6">
            Майсторска Изработка
          </p>
          <h3 className="font-serif text-display-sm text-charcoal leading-snug mb-8">
            {product.shortDescription}
          </h3>
          <div className="w-10 h-px bg-navy/30 mb-8" />
          <p className="font-sans text-sm font-light text-ink-soft leading-[1.9] tracking-wide mb-6">
            {descPara1}
          </p>
          {descPara2 && (
            <p className="font-sans text-sm font-light text-ink-soft leading-[1.9] tracking-wide">
              {descPara2}
            </p>
          )}
        </div>

        {/* Image 1 */}
        <div className="relative aspect-square lg:aspect-auto lg:min-h-[600px] overflow-hidden order-1 lg:order-2">
          <Image
            src={img1.src}
            alt={img1.alt}
            fill
            quality={90}
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover object-center"
          />
        </div>
      </div>

      {/* ── Split: 4:5 video left + quote text right ─────────── */}
      {product.quoteVideo && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
          {/* Video 4:5 */}
          <div className="aspect-[4/5] overflow-hidden">
            <video
              src={product.quoteVideo}
              autoPlay
              loop
              muted
              playsInline
              preload="metadata"
              className="w-full h-full object-cover"
            />
          </div>
          {/* Text */}
          <div className="flex flex-col justify-center px-8 sm:px-12 lg:px-16 py-14 lg:py-0 bg-white">
            <p className="font-sans text-[10px] tracking-[0.32em] uppercase text-ink-faint mb-6">
              {product.warranty}
            </p>
            <blockquote className="font-serif text-display-sm text-charcoal leading-relaxed mb-8">
              „Прецизност и характер – носен с увереност."
            </blockquote>
            <div className="w-10 h-px bg-navy/30" />
          </div>
        </div>
      )}

      {/* ── Full-width second image/video with overlay (Polar Frost) ── */}
      {img2 && !product.quoteVideo && (
        <div className="relative w-full aspect-[21/9] overflow-hidden">
          {product.descriptionVideo ? (
            <video
              src={product.descriptionVideo}
              autoPlay
              loop
              muted
              playsInline
              preload="metadata"
              className="absolute inset-0 w-full h-full object-cover object-center"
            />
          ) : (
            <Image
              src={img2.src}
              alt={img2.alt}
              fill
              quality={90}
              sizes="100vw"
              className="object-cover object-center"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/20 to-transparent flex items-center">
            <div className="px-10 sm:px-20 max-w-xl">
              <p className="font-sans text-[10px] tracking-[0.32em] uppercase text-white/50 mb-4">
                {product.warranty}
              </p>
              <blockquote className="font-serif text-display-sm text-white leading-relaxed">
                „Прецизност и характер - носен с увереност."
              </blockquote>
            </div>
          </div>
        </div>
      )}

      {/* ── Key features strip ────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-0 border-y border-border">
        {product.features.slice(0, 3).map((f, i) => (
          <div
            key={i}
            className={`px-8 py-10 flex flex-col gap-3 ${i < 2 ? "sm:border-r border-border" : ""} border-b sm:border-b-0 border-border`}
          >
            <div className="w-4 h-px bg-navy/40" />
            <p className="font-sans text-[11px] font-light text-ink-soft leading-relaxed tracking-wide">
              {f}
            </p>
          </div>
        ))}
      </div>

    </section>
  );
}
