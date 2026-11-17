import type { MetadataRoute } from "next";
import { products } from "@/lib/products";
import { absUrl } from "@/lib/site";
import { SHELF } from "@/lib/storefront";

// Every public, indexable page: the home page, the category pages, the content and policy
// pages and one entry per product. Left out on purpose: the admin panel, /api, order
// tracking (/track/<awb>) and the tokenised cart-recovery link (/vazstanovi), and everything of a
// collection that is switched off (lib/storefront.ts SHELF: those pages answer 301 -> the women's
// collection; `products` below holds only the pieces on the shelf).
// No lastModified: the catalog has no per-page edit date and a made-up one is worse than none.
const STATIC_PATHS = [
  "/",
  ...(SHELF.watches ? ["/watches"] : []),
  "/jewellery",
  ...(SHELF.leather ? ["/leather-goods"] : []),
  "/bundles",
  "/namalenia",
  "/story",
  "/faq",
  ...(SHELF.watches ? ["/watch-manual"] : []),
  "/policies/shipping",
  "/policies/returns",
  "/policies/privacy",
  "/warranty/jewelry",
];

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...STATIC_PATHS.map((path) => ({ url: absUrl(path) })),
    ...products.map((p) => ({ url: absUrl(`/products/${p.slug}`) })),
  ];
}
