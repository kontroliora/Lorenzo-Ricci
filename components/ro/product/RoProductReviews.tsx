interface Props {
  count: number; // number of reviews (lib/reviews.ts reviewSummary, else the product's own reviews)
  avg: number;   // average rating, 1-5
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5 text-navy text-xs" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={i < rating ? "text-navy" : "text-ink-faint"}>★</span>
      ))}
    </div>
  );
}

// Summary only: the reviews were written by customers of the Bulgarian store, in Bulgarian, so neither their
// texts nor a review form are shown here - just the stars, the average and the number, labelled with where
// they come from. Renders nothing for a product that has no reviews.
export function RoProductReviews({ count, avg }: Props) {
  if (count <= 0) return null;
  const avgText = avg.toFixed(1).replace(".", ",");
  return (
    <section id="reviews" className="py-16 border-t border-border">
      <h2 className="font-serif text-2xl text-charcoal mb-1">Recenzii</h2>
      <div className="flex items-center gap-3" role="img" aria-label={`Evaluare medie ${avgText} din 5, ${count} recenzii clienți (Bulgaria)`}>
        <Stars rating={Math.round(avg)} />
        <span className="font-sans text-xs text-ink-muted">
          {avgText} · {count} recenzii clienți (Bulgaria)
        </span>
      </div>
    </section>
  );
}
