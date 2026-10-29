import VARIANTS from "./image-variants.json";

// 800 px copy of a product photo (scripts/make-image-variants.mjs), or the original when there is none. images.unoptimized is on
// (05.10.2026 optimiser outage), so this is how phones and product cards avoid downloading 1500-2048 px originals.
const MAP = VARIANTS as Record<string, string>;
export const smallVariant = (src: string): string | undefined => MAP[src];
export const smallOrOriginal = (src: string): string => MAP[src] ?? src;
