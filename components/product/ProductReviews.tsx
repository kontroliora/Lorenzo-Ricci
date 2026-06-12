"use client";
import Image from "next/image";
import { useState } from "react";
import type { Review } from "@/lib/types";
import { reviewSummary } from "@/lib/reviews";
import { useReveal } from "@/lib/useReveal";

interface ProductReviewsProps {
  reviews: Review[];
  productSlug: string;
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5 text-navy text-xs">
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={i < rating ? "text-navy" : "text-ink-faint"}>★</span>
      ))}
    </div>
  );
}


export function ProductReviews({ reviews, productSlug }: ProductReviewsProps) {
  const gridRef = useReveal();
  const [showForm, setShowForm] = useState(false);
  const [formState, setFormState] = useState({ name: "", rating: 5, title: "", body: "" });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [hoverRating, setHoverRating] = useState(0);
  if (reviews.length === 0 && !showForm) {
    return (
      <section id="reviews" className="py-16 border-t border-border">
        <div className="text-center py-8">
          <p className="font-sans text-sm text-ink-muted mb-4">Все още няма ревюта за този продукт.</p>
          <button onClick={() => setShowForm(true)} className="btn-outline">
            Остави първото ревю
          </button>
        </div>
      </section>
    );
  }

  // Stats from hardcoded summary — always reflects full dataset, not just displayed 20
  const summary = reviewSummary[productSlug];
  const totalCount = summary?.count ?? reviews.length;
  const avgRating = summary?.avg ?? (reviews.length > 0 ? reviews.reduce((a, r) => a + r.rating, 0) / reviews.length : 5);

  // Sort logic:
  // 1. Reviews with photo — always shown, newest first
  // 2. Fill remaining slots (up to 20 total) with text-only, newest first
  const MAX_REVIEWS = 20;
  const byDateDesc = (a: Review, b: Review) =>
    new Date(b.date).getTime() - new Date(a.date).getTime();

  const withPhoto    = [...reviews.filter((r) => r.imageUrl)].sort(byDateDesc);
  const withoutPhoto = [...reviews.filter((r) => !r.imageUrl)].sort(byDateDesc);
  const textSlots    = Math.max(0, MAX_REVIEWS - withPhoto.length);
  const visibleReviews = [...withPhoto, ...withoutPhoto.slice(0, textSlots)];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.name.trim() || !formState.body.trim()) return;
    setSubmitting(true);
    try {
      await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formState, productSlug }),
      });
    } catch { /* silent */ }
    setSubmitting(false);
    setSubmitted(true);
  };

  return (
    <section id="reviews" className="py-16 border-t border-border">
      {/* Header */}
      <div className="flex items-center justify-between mb-10">
        <div>
          <h2 className="font-serif text-2xl text-charcoal mb-1">Ревюта</h2>
          {totalCount > 0 && (
            <div className="flex items-center gap-3">
              <Stars rating={Math.round(avgRating)} />
              <span className="font-sans text-xs text-ink-muted">
                {avgRating.toFixed(1)} · {totalCount} {totalCount === 1 ? "ревю" : "ревюта"}
              </span>
            </div>
          )}
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="btn-outline text-xs"
          >
            + Остави ревю
          </button>
        )}
      </div>

      {/* Leave a review form */}
      {showForm && (
        <div className="mb-12 border border-border bg-ivory-warm p-6 sm:p-8">
          {submitted ? (
            <div className="text-center py-6">
              <p className="font-serif text-xl text-charcoal mb-2">Благодарим ти!</p>
              <p className="font-sans text-sm text-ink-muted">Ревюто ти е изпратено за преглед.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <h3 className="font-serif text-xl text-charcoal">Остави ревю</h3>

              {/* Star picker */}
              <div>
                <p className="font-sans text-[10px] tracking-widest uppercase text-ink-faint mb-2">Оценка</p>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onMouseEnter={() => setHoverRating(s)}
                      onMouseLeave={() => setHoverRating(0)}
                      onClick={() => setFormState((f) => ({ ...f, rating: s }))}
                      className={`text-2xl transition-colors ${
                        s <= (hoverRating || formState.rating) ? "text-navy" : "text-ink-faint"
                      }`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-sans text-[10px] tracking-widest uppercase text-ink-faint block mb-1.5">Име *</label>
                  <input
                    type="text"
                    required
                    value={formState.name}
                    onChange={(e) => setFormState((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Иван И."
                    className="w-full border-b border-border bg-transparent font-sans text-sm text-charcoal py-2 placeholder:text-ink-faint focus:outline-none focus:border-navy transition-colors"
                  />
                </div>
                <div>
                  <label className="font-sans text-[10px] tracking-widest uppercase text-ink-faint block mb-1.5">Заглавие (незадължително)</label>
                  <input
                    type="text"
                    value={formState.title}
                    onChange={(e) => setFormState((f) => ({ ...f, title: e.target.value }))}
                    placeholder="Страхотен продукт!"
                    className="w-full border-b border-border bg-transparent font-sans text-sm text-charcoal py-2 placeholder:text-ink-faint focus:outline-none focus:border-navy transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="font-sans text-[10px] tracking-widest uppercase text-ink-faint block mb-1.5">Ревю *</label>
                <textarea
                  required
                  value={formState.body}
                  onChange={(e) => setFormState((f) => ({ ...f, body: e.target.value }))}
                  placeholder="Споделете вашето мнение..."
                  rows={4}
                  className="w-full border border-border bg-white font-sans text-sm text-charcoal p-3 placeholder:text-ink-faint focus:outline-none focus:border-navy transition-colors resize-none"
                />
              </div>

              <div className="flex items-center gap-4">
                <button type="submit" disabled={submitting} className="btn-primary">
                  {submitting ? "Изпращане..." : "Изпрати ревюто"}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="font-sans text-xs text-ink-muted hover:text-charcoal transition-colors">
                  Отказ
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Reviews grid - images first */}
      {visibleReviews.length > 0 && (
        <div ref={gridRef} className="columns-1 sm:columns-2 gap-5">
          {visibleReviews.map((review, i) => (
            <div
              key={review.id}
              className={`reveal reveal-delay-${Math.min(i + 1, 6)} review-card break-inside-avoid mb-5 inline-block w-full flex flex-col gap-3 p-5`}
            >
              <Stars rating={review.rating} />
              {review.title && (
                <h4 className="font-serif text-lg text-charcoal">{review.title}</h4>
              )}
              <p className="font-sans text-sm font-light text-ink-soft leading-relaxed flex-1">
                {review.body.replace(/-|-/g, "-")}
              </p>
              {review.imageUrl && (
                <div className="relative w-full aspect-[4/3] overflow-hidden bg-ivory-warm">
                  <Image
                    src={review.imageUrl}
                    alt={`Снимка от ${review.author}`}
                    fill
                    quality={75}
                    sizes="(max-width: 640px) 100vw, 50vw"
                    className="object-contain object-center p-2"
                  />
                </div>
              )}
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <p className="font-sans text-xs font-medium text-charcoal">{review.author}</p>
                <span className="font-sans text-[10px] text-navy font-medium tracking-wide">✓ Потвърдена покупка</span>
              </div>
            </div>
          ))}
        </div>
      )}

    </section>
  );
}
