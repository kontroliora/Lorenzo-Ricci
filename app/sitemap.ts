import type { MetadataRoute } from "next";
import { products } from "@/lib/products";
import { absUrl } from "@/lib/site";

// Every public, indexable page: the home page, the category pages, the content and policy
// pages and one entry per product. Left out on purpose: the admin panel, /api, order
// tracking (/track/<awb>) and the tokenised cart-recovery link (/vazstanovi).
// No lastModified: the catalog has no per-page edit date and a made-up one is worse than none.
const STATIC_PATHS = [
  "/",
  "/watches",
  "/jewellery",
  "/leather-goods",
  "/bundles",
  "/story",
  "/faq",
  "/watch-manual",
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
