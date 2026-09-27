// Brand quote between the story and the reviews. The "Защо Lorenzo Ricci" value
// grid that used to sit here was removed (owner, 2026-09-27); only the quote stays.
export function BrandValues() {
  return (
    <section className="py-20 sm:py-28 border-y border-border bg-white">
      <div className="max-w-2xl mx-auto px-5 sm:px-8 text-center">
        <blockquote className="font-serif text-display-sm text-charcoal leading-relaxed">
          "Изтънчен италиански дизайн и майсторска изработка,
          <br />
          в която всеки детайл има значение."
        </blockquote>
        <div className="gold-divider mt-8" />
        <p className="font-sans text-xs text-ink-faint tracking-[0.25em] uppercase mt-4">
          Lorenzo Ricci · Основан с характер
        </p>
      </div>
    </section>
  );
}
