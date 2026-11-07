"use client";
// Makes switching to a sibling product (colour / type / stone swatches) paint at once (owner, 08.11.2026): the target's main
// photo is downloaded AND decoded ahead, at the exact URL the gallery will use on this screen (the resized copy of
// lib/image-loader.ts that this screen's srcset picks - the same width as the photo the gallery shows now). The route itself is
// prefetched by <Link prefetch>. Deduped per slug for the page's lifetime; the decoded images are kept so they stay in memory.
import { getProductBySlug } from "@/lib/products";
import { GALLERY_SIZES, imageUrl } from "@/lib/image-loader";
import IMAGE_WIDTHS from "@/lib/image-widths.json";

const warmed = new Map<string, HTMLImageElement>();

/** The URL the product gallery's main photo loads on this screen (components/product/ProductGallery.tsx): the copy width the
 *  gallery's current photo uses, or - before it has loaded - the width its srcset picks for this screen (GALLERY_SIZES). */
export function mainPhotoUrl(src: string): string {
  const shown = document.querySelector<HTMLImageElement>(`img[sizes="${GALLERY_SIZES}"]`)?.currentSrc;
  const m = shown ? /-w(\d+)\.webp(?:\?|$)/.exec(shown) : null;
  if (m) return imageUrl(src, Number(m[1]));
  if (shown) return imageUrl(src, 99999); // the gallery shows an original
  const slot = window.matchMedia("(max-width: 1023px)").matches ? window.innerWidth : 520;
  const need = slot * (window.devicePixelRatio || 1);
  return imageUrl(src, IMAGE_WIDTHS.widths.find((w) => w >= need) ?? 99999);
}

export function warmProductPhoto(slug: string, priority: "low" | "high" = "low"): void {
  if (typeof window === "undefined" || warmed.has(slug)) return;
  const p = getProductBySlug(slug);
  if (!p) return;
  const img = new Image();
  img.decoding = "async";
  img.setAttribute("fetchpriority", priority);
  img.src = mainPhotoUrl(p.images[0]?.src ?? p.coverImage.src);
  img.decode?.().catch(() => {});
  warmed.set(slug, img);
}

/** Warm several products once the browser is idle (after the page's own photo has loaded). */
export function warmWhenIdle(slugs: string[]): () => void {
  let cancelled = false;
  const go = () => { if (!cancelled) slugs.forEach((s) => warmProductPhoto(s)); };
  const idle = () => { if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(go, { timeout: 2000 }); else setTimeout(go, 600); };
  if (document.readyState === "complete") idle(); else window.addEventListener("load", idle, { once: true });
  return () => { cancelled = true; window.removeEventListener("load", idle); };
}

/**
 * Tap on a sibling product (colour / type / stone): the gallery shows that product's main photo AT ONCE (it is pre-decoded by
 * warmProductPhoto), on top of the current photos, until the new page's own gallery replaces it (components/product/
 * ProductGallery.tsx, RoProductGallery.tsx listen). The page itself then renders behind it.
 */
export const PHOTO_PREVIEW_EVENT = "lr:photo-preview";
export function previewProductPhoto(slug: string): void {
  const p = getProductBySlug(slug);
  if (!p) return;
  warmProductPhoto(slug, "high");
  window.dispatchEvent(new CustomEvent(PHOTO_PREVIEW_EVENT, { detail: mainPhotoUrl(p.images[0]?.src ?? p.coverImage.src) }));
}
