// Share images (og:image) for Facebook / Instagram / Messenger link previews: 1200x630 JPEGs made by
// scripts/make-og-images.mjs (product photo no. 1 on white). A product without one falls back to its cover photo.
import ogImages from "./og-images.json";

const OG = ogImages as Record<string, string>;

type OgImage = { url: string; width?: number; height?: number; alt: string; type?: string };

const sized = (url: string, alt: string): OgImage => ({ url, width: 1200, height: 630, alt, type: "image/jpeg" });

export function productOgImage(p: { slug: string; coverImage: { src: string; alt: string } }): OgImage {
  const made = OG[p.slug];
  return made ? sized(made, p.coverImage.alt) : { url: encodeURI(p.coverImage.src), alt: p.coverImage.alt };
}

export function homeOgImage(alt: string): OgImage {
  return sized(OG.home, alt);
}
