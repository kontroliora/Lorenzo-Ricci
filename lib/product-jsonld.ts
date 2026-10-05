import type { Product } from "./types";
import { absUrl } from "./site";

// schema.org Product markup for a product page. Pure: the page passes in what it knows.
//   - price / currency: the page's own price (override-applied EUR base price);
//   - availability: the live free-to-sell count when known, else the catalog's inStock switch;
//   - aggregateRating: ONLY when the product really has reviews (count and average are the
//     same numbers the page shows next to the stars) - never invented for a product without.
export function productJsonLd(
  product: Product,
  opts: { liveStock: number | null; reviews?: { count: number; avg: number } | null },
) {
  const url = absUrl(`/products/${product.slug}`);
  const inStock = product.inStock && (opts.liveStock === null || opts.liveStock > 0);
  // File names carry spaces ("Yachting Black/..."), so the URLs are percent-encoded.
  const images = [...new Set([product.coverImage, ...product.images].map((i) => encodeURI(absUrl(i.src))))].slice(0, 8);

  const ld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    sku: product.sku,
    image: images,
    brand: { "@type": "Brand", name: "Lorenzo Ricci" },
    url,
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: "EUR",
      price: product.price.toFixed(2),
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
