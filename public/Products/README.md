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
3. Run `node scripts/collection-photos.mjs` (bracelets only; necklaces keep the owner's originals exactly as given). It never
   singles out a pixel of the product: a clean white backdrop is left as it is (an almost-white one gets one uniform lift of at most
   2%), a near-white tint is whitened only by a low-tolerance flood from the photo's edges outside a mask round the product (its
   highlights, edges and soft shadow are never changed), and a styled backdrop (a grey surface, window light, a floor that runs to
   the edge) is left exactly as it is, size included. Clean photos are then scaled so the product fills 80% of the width - the whole
   photo is scaled, so no crop edge cuts the shadow. On-model and box photos are never touched. Before changing a photo it keeps the
   untouched original in `New Jewellery/_originals/`. Done files are recorded in `scripts/collection-photos.json` and skipped next
   time; `--only a.webp,b.webp` redoes just those, `--out <dir>` is a dry run. Every run rewrites `lib/collection-photo-versions.json`
   (a content hash per photo, sent as `?v=` in the URL), so run it after ANY photo change.