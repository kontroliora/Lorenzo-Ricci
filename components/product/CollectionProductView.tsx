"use client";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { Product } from "@/lib/types";

// Women's collection product page (Bulgarian AND Romanian shop), step 1 of the 1+1 boxes (owner, 18.11.2026): the piece is switched IN
// PLACE, with no reload. The page is rendered once for the piece in the URL; this holds which piece step 1 currently shows, and the
// gallery, title, price (top and the sticky bar), the selectors, the breadcrumb and the reviews follow it. The address bar is updated with
// history.replaceState to the new piece's own page (never pushState: Back leaves the page, the query string and hash are kept). The page's
// <link rel="canonical"> / hreflang and its structured data stay those of the piece the page was rendered for (the server pages), so
// nothing here touches them.
//
// ONE component for both shops: it knows nothing of a language. The two thin client adapters (CollectionViewBg.tsx, CollectionViewRo.tsx)
// say how a piece is built for their shop and which gallery / info components draw it, so the Bulgarian page never loads Romanian code.
// The catalogue is already in the browser; the server only sends what it alone knows (price overrides, sold-out pieces, names).

type Ctx = { slug: string; setSlug: (slug: string) => void };
const ActiveProductContext = createContext<Ctx | null>(null);

/** Wraps the whole collection page, so the breadcrumb, the product block and the reviews read the same "current piece". Keyed by the
 *  page's slug in the server page: opening another piece through a link (related products, the cart) starts afresh. */
export function ActiveProductProvider({ initialSlug, children }: { initialSlug: string; children: ReactNode }) {
  const [slug, setSlug] = useState(initialSlug);
  const value = useMemo(() => ({ slug, setSlug }), [slug]);
  return <ActiveProductContext.Provider value={value}>{children}</ActiveProductContext.Provider>;
}

/** The piece step 1 currently shows (the page's own piece without a provider). */
export function useActiveSlug(pageSlug: string): string {
  return useContext(ActiveProductContext)?.slug ?? pageSlug;
}

/** The breadcrumb's last item: the name of the piece step 1 currently shows (`names`: slug -> name, from the server). */
export function ActiveProductName({ pageSlug, names }: { pageSlug: string; names: Record<string, string> }) {
  const slug = useActiveSlug(pageSlug);
  return <>{names[slug] ?? names[pageSlug]}</>;
}

/** A server-rendered block that belongs to some pieces only (e.g. the 18K gold description, not on a silver piece): shown while the piece
 *  step 1 currently shows is one of `slugs`. */
export function ShowForPieces({ pageSlug, slugs, children }: { pageSlug: string; slugs: string[]; children: ReactNode }) {
  const slug = useActiveSlug(pageSlug);
  return slugs.includes(slug) ? <>{children}</> : null;
}

export function CollectionProductView({ pageSlug, hrefPrefix, pieceOf, renderGallery, renderInfo }: {
  pageSlug: string;
  hrefPrefix: string;                              // "/products/" or "/ro/produse/": where a piece lives (the address bar follows)
  pieceOf: (slug: string) => Product | undefined;  // a piece as this shop's page shows it (language, price override applied); undefined = not sold
  renderGallery: (product: Product) => ReactNode;
  renderInfo: (product: Product, switchTo: (slug: string) => void) => ReactNode;
}) {
  const ctx = useContext(ActiveProductContext);
  // Without the provider (it always wraps this) the view still works for the page's own piece.
  const [fallbackSlug, setFallbackSlug] = useState(pageSlug);
  const slug = ctx?.slug ?? fallbackSlug;
  const setSlug = ctx?.setSlug ?? setFallbackSlug;

  const product = pieceOf(slug) ?? pieceOf(pageSlug)!;

  const switchTo = useCallback((next: string) => {
    if (next === slug || !pieceOf(next)) return;
    setSlug(next);
    // replaceState, not pushState: the visitor is still on the same page. Query (utm ...) and hash are kept.
    try { window.history.replaceState(null, "", `${hrefPrefix}${next}${window.location.search}${window.location.hash}`); } catch { /* the page still switched */ }
  }, [slug, pieceOf, setSlug, hrefPrefix]);

  return (
    <>
      {renderGallery(product)}
      <div>{renderInfo(product, switchTo)}</div>
    </>
  );
}
