import type { Product } from "@/lib/types";
import { absUrl } from "@/lib/site";
import { RO_CURRENCY, ronOf } from "./config";

// schema.org Product markup for a Romanian product page (copy of lib/product-jsonld.ts, priced in lei).
// Pure: the page passes in what it knows (the localized, override-applied product).
//   - price / currency: whole lei (ronOf of the override-applied EUR base price = the CURRENT price, also while the product is on
//     sale), priceCurrency "RON". Like the Bulgarian markup it carries no strike-through / list price: the sale shows on the page;
//   - availability: the live free-to-sell count when known, else the catalog's inStock switch
//     (schema.org URLs are language-neutral);
//   - aggregateRating: ONLY when the product really has reviews (count and average are the same numbers
//     the page shows next to the stars) - never invented for a product without.
export function roProductJsonLd(
  product: Product,
  opts: { liveStock: number | null; reviews?: { count: number; avg: number } | null },
) {
  const url = absUrl(`/ro/produse/${product.slug}`);
  const inStock = product.inStock && (opts.liveStock === null || opts.liveStock > 0);
  // File names carry spaces ("Yachting Black/..."), so the URLs are percent-encoded.
  const images = [...new Set([product.coverImage, ...product.images].map((i) => encodeURI(absUrl(i.src))))].slice(0, 8);

  const ld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    ...(product.description.trim() ? { description: product.description } : {}),
    sku: product.sku,
    image: images,
    brand: { "@type": "Brand", name: "Lorenzo Ricci" },
    url,
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: RO_CURRENCY,
      price: String(ronOf(product)),
      availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
    },
  };

  if (opts.reviews && opts.reviews.count > 0) {
    ld.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: opts.reviews.avg.toFixed(1),
      reviewCount: opts.reviews.count,
      bestRating: 5,
      worstRating: 1,
    };
  }
  return ld;
}

// Safe to embed inside <script type="application/ld+json">: "<" can never close the tag.
export const jsonLdString = (ld: unknown): string => JSON.stringify(ld).replace(/</g, "\\u003c");
