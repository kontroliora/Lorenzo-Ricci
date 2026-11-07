# Product photography

## Photo policy

A product's public gallery (`images` / `coverImage` in [`lib/products.ts`](../../lib/products.ts)) shows only our own
products: photos of the actual item, or AI-generated images of our own products, which are allowed.

Never use other brands' or suppliers' listing photos, not even temporarily. Keep them out of `public/` entirely; if a
working copy is needed during processing, keep it in an untracked source folder and delete it once the real product
photos are in place.

## New collection photos (`jewellery/new-collection/`)

Source of truth: the owner's folders in `New Jewellery/` (one per product, named exactly as the product, e.g.
"Гривна Spira - Злато"; never the "back up" or "Реалните снимки" folders). The owner's own numbering is the gallery order:
file no. 1 is the main photo, no. 2 the second, and so on - never re-sorted by kind. A file without a number goes after the
numbered ones.

Processing, every time photos are added or renumbered:

1. Convert each photo to WebP 2000×2000, product centred on white, never cropped; name
   `{model}-{necklace|bracelet}-{gold|silver}-{n}.webp` with the owner's n; same file in the folder and here.
2. List the piece in `lib/new-collection.ts` `COLLECTION_PHOTOS`, one letter per photo in that order
   (p white background, m on model, b open box, c closed box, d detail on white). A piece without photos stays hidden.
3. Run `node scripts/collection-photos.mjs`: every white-background photo (p, d) gets a pure #FFFFFF background and the
   same product size (80% of the width for bracelets, 80% of the height for necklaces, never cut), in place, here and in the
   folder. On-model and box photos are left alone. Done files are recorded in `scripts/collection-photos.json` and skipped on the
   next run; `--force` redoes all, `--out <dir>` is a dry run.
