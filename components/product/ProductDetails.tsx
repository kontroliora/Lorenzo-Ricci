import type { ProductSpec } from "@/lib/types";

// "Детайли" / "Detalii" under a product's bullets (2026 collection: lib/new-collection-products.ts), BG and RO pages alike: only
// the rows that have a value, then the neutral box line. Renders nothing when there is neither.
export function ProductDetails({ title, rows, note }: { title: string; rows?: ProductSpec[]; note?: string }) {
  const shown = (rows ?? []).filter((r) => r.value.trim() !== "");
  if (shown.length === 0 && !note) return null;
  return (
    <div data-testid="product-details" className="border-t border-border pt-4">
      {shown.length > 0 && (
        <>
          <p className="font-sans text-[10px] font-medium tracking-[0.2em] uppercase text-ink-muted mb-2.5">{title}</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-1.5 text-[13px]">
            {shown.map((r) => (
              <div key={r.label} className="contents">
                <dt className="font-sans font-light text-ink-muted tracking-wide">{r.label}</dt>
                <dd className="font-sans font-light text-ink-soft tracking-wide">{r.value}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
      {note && <p className={`font-sans text-[13px] font-light text-ink-soft tracking-wide ${shown.length > 0 ? "mt-3" : ""}`}>{note}</p>}
    </div>
  );
}
