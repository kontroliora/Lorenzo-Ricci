// next/image loader (next.config images.loaderFile). Every srcset entry of a photo in the folders of lib/image-widths.json
// points at its pre-made "<name>-w<W>.webp" copy (scripts/make-image-variants.mjs, run before every build); a width the photo
// has no copy for (it is smaller than that), anything wider than the largest copy, and every other file get the original.
// The browser then downloads only as many pixels as the slot shows on that screen - the photos themselves are unchanged.
import CFG from "./image-widths.json";
import SMALL from "./image-small.json";

const WIDTHS: number[] = CFG.widths;
const DIRS = CFG.dirs.map((d) => `/${d}/`);
const NO_COPY = SMALL as Record<string, number[]>;
const PHOTO = /\.(webp|jpe?g|png)$/i;
const COPY = /-w\d+\.webp$/i;

/** The file of `src` for a slot `width` px wide: a resized copy, or the original. */
export function imageUrl(src: string, width: number): string {
  const q = src.indexOf("?");
  const query = q >= 0 ? src.slice(q) : "";
  let path = q >= 0 ? src.slice(0, q) : src;
  try { path = decodeURI(path); } catch { /* keep as is */ }
  const original = encodeURI(path) + query;
  if (!path.startsWith("/") || COPY.test(path) || !PHOTO.test(path) || !DIRS.some((d) => path.startsWith(d))) return original;
  const w = WIDTHS.find((x) => x >= width);
  if (w === undefined || NO_COPY[path]?.includes(w)) return original;
  return encodeURI(path.replace(PHOTO, `-w${w}.webp`)) + query;
}

export default function loader({ src, width }: { src: string; width: number; quality?: number }): string {
  return imageUrl(src, width);
}

/** `sizes` of the product page's main photo: full width up to the two-column layout (lg), then at most ~520 px wide. */
export const GALLERY_SIZES = "(max-width: 1023px) 100vw, 520px";

/** Product cards, 2 per row on phones up to 4 per row on wide screens (default of ProductCard / RoProductCard). */
export const GRID_CARD_SIZES = "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw";
/** Product cards on the listings that show 1 per row on phones, 2 on tablets, 3 on desktop (watches, leather goods). */
export const LISTING_CARD_SIZES = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw";
