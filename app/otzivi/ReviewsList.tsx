"use client";
import Link from "next/link";
import { useState } from "react";
import { imageUrl } from "@/lib/image-loader";
import { fmtCount, fmtDate, REVIEW_CAT_LABEL, type ReviewFilter, type SiteReview } from "@/lib/site-reviews-shared";

const FILTERS: { key: ReviewFilter; label: string }[] = [
  { key: "all", label: "Всички" },
  { key: "photos", label: "Със снимки" },
  { key: "jewellery", label: REVIEW_CAT_LABEL.jewellery },
  { key: "watches", label: REVIEW_CAT_LABEL.watches },
  { key: "leather", label: REVIEW_CAT_LABEL.leather },
];

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex gap-0.5 text-xs" aria-label={`${value} от 5 звезди`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} aria-hidden className={i < value ? "text-navy" : "text-ink-faint"}>★</span>
      ))}
    </span>
  );
}

// local photos (public/reviews) have small pre-made copies; database photos are already ≤1600 px WebP
const thumb = (src: string) => (src.startsWith("/") ? imageUrl(src, 192) : src);

export function ReviewsList({ initial, counts }: { initial: SiteReview[]; counts: Record<ReviewFilter, number> }) {
  const [filter, setFilter] = useState<ReviewFilter>("all");
  const [items, setItems] = useState<SiteReview[]>(initial);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);
  const total = counts[filter];

  async function load(f: ReviewFilter, offset: number) {
    setLoading(true);
    setFailed(false);
    try {
      const res = await fetch(`/api/otzivi?f=${f}&offset=${offset}`);
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { items: SiteReview[] };
      setItems((prev) => (offset === 0 ? data.items : [...prev, ...data.items]));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  function pick(f: ReviewFilter) {
    if (f === filter || loading) return;
    setFilter(f);
    setItems([]);
    void load(f, 0);
  }

  return (
    <section aria-label="Отзиви">
      <div role="tablist" aria-label="Филтър" className="flex flex-wrap justify-center gap-2 mb-10">
        {FILTERS.filter((x) => counts[x.key] > 0).map((x) => (
          <button
            key={x.key}
            type="button"
            role="tab"
            aria-selected={filter === x.key}
            onClick={() => pick(x.key)}
            className={`font-sans text-[11px] tracking-[0.12em] uppercase px-4 py-2.5 border transition-colors ${
              filter === x.key ? "bg-navy border-navy text-white" : "border-border text-ink-muted hover:border-navy hover:text-navy"
            }`}
          >
            {x.label} <span className={filter === x.key ? "text-white/70" : "text-ink-faint"}>({fmtCount(counts[x.key])})</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 items-start">
        {items.map((r) => (
          <article key={r.id} className="review-card w-full p-5">
            <div className="flex items-center justify-between gap-3">
              <Stars value={r.rating} />
              <time dateTime={r.date} className="font-sans text-[10px] text-ink-faint tracking-wide">{fmtDate(r.date)}</time>
            </div>
            {r.body && <p className="font-sans text-sm font-light text-ink-soft leading-relaxed whitespace-pre-line break-words mt-3">{r.body}</p>}
            {r.images.length > 0 && (
              <div className="flex gap-2 mt-3">
                {r.images.map((src, i) => (
                  <button key={src} type="button" onClick={() => setZoom(src)} aria-label={`Увеличи снимка ${i + 1}`} className="relative w-24 h-24 bg-ivory-warm overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={thumb(src)} alt={`Снимка от ${r.name}`} loading="lazy" decoding="async" width={96} height={96} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
            <div className="pt-3 mt-3 border-t border-border flex items-center justify-between gap-3">
              <p className="font-sans text-xs font-medium text-charcoal truncate">{r.name}</p>
              <Link href={`/products/${r.productSlug}`} className="font-sans text-[10px] text-ink-muted hover:text-navy transition-colors truncate">
                {r.productName}
              </Link>
            </div>
          </article>
        ))}
      </div>

      {failed && <p className="text-center font-sans text-xs text-ink-muted mt-4">Отзивите не се заредиха. Опитайте отново.</p>}

      {(items.length < total || failed) && (
        <div className="text-center mt-8">
          <button type="button" disabled={loading} onClick={() => load(filter, items.length)} className="btn-outline text-xs disabled:opacity-50">
            {loading ? "Зареждане…" : "Покажи още"}
          </button>
          <p className="font-sans text-[10px] text-ink-faint tracking-wide mt-3">{fmtCount(items.length)} от {fmtCount(total)}</p>
        </div>
      )}

      {zoom && (
        <div role="dialog" aria-modal="true" aria-label="Снимка от отзив" onClick={() => setZoom(null)} className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom.startsWith("/") ? imageUrl(zoom, 1200) : zoom} alt="" className="max-w-full max-h-full object-contain" />
          <button type="button" aria-label="Затвори" onClick={() => setZoom(null)} className="absolute top-4 right-4 w-11 h-11 text-white text-3xl leading-none">×</button>
        </div>
      )}
    </section>
  );
}
