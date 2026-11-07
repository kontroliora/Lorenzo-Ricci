// The 2026 women's collection (Verdis, Noctis, Lumen, Linea, Solaris, Spira): ONE place for the switch, the slugs, the photos,
// the gold/silver swatches and the sets (its 1+1 is a group of lib/one-plus-one.ts). Pure (types only, no React, no server imports): the carts,
// the product pages, /api/order, /api/order-ro, the e-mails and the panel all import the same rules.
// The product data (names, texts, images) is in lib/new-collection-products.ts.

// ─── Switches ────────────────────────────────────────────────────────────────

/**
 * false = every product of the collection is HIDDEN: not in any listing, sitemap, set or search, its page is a 404 and
 * /api/order + /api/order-ro refuse it (unknown product). The admin inventory page still lists it, so stock can be entered.
 * Flip to true once stock is set (supabase/wallet_inventory_new_collection_2026-11.sql). Even then a piece without photos
 * (not in COLLECTION_PHOTOS below) stays hidden: see pieceLive().
 */
export const NEW_COLLECTION_LIVE = true;

// The 1+1 of the collection is the "jewellery" group of lib/one-plus-one.ts (switch, end date, wording, maths), counted apart from
// the cardholders' group. Only the sets' line lives here.
export const COLLECTION_SET_TEXT = {
  bg: { setFree: (partner: "necklace" | "bracelet") => `Добавете и ${partner === "necklace" ? "колието" : "гривната"} – безплатно с 1+1` },
  ro: { setFree: (partner: "necklace" | "bracelet") => `Adăugați și ${partner === "necklace" ? "colierul" : "brățara"} – gratuit cu 1+1` },
} as const;

// ─── The collection ──────────────────────────────────────────────────────────

export type Metal = "gold" | "silver";
export type CollectionKey = "verdis" | "noctis" | "lumen" | "linea" | "solaris" | "spira";
type Piece = { metals: Metal[]; price: number };

export interface CollectionDesign {
  key: CollectionKey;
  name: string;              // the design name, shared by its necklace and bracelet
  kind: "clover" | "bangle";
  necklace?: Piece;
  bracelet: Piece;
}

export const COLLECTION_DESIGNS: CollectionDesign[] = [
  { key: "verdis",  name: "Verdis",  kind: "clover", necklace: { metals: ["gold", "silver"], price: 109 }, bracelet: { metals: ["gold", "silver"], price: 109 } },
  { key: "noctis",  name: "Noctis",  kind: "clover", necklace: { metals: ["gold", "silver"], price: 109 }, bracelet: { metals: ["gold", "silver"], price: 109 } },
  { key: "lumen",   name: "Lumen",   kind: "clover", necklace: { metals: ["gold", "silver"], price: 109 }, bracelet: { metals: ["gold", "silver"], price: 109 } },
  { key: "linea",   name: "Linea",   kind: "bangle", bracelet: { metals: ["gold", "silver"], price: 109 } },
  { key: "solaris", name: "Solaris", kind: "bangle", bracelet: { metals: ["gold", "silver"], price: 115 } },
  { key: "spira",   name: "Spira",   kind: "bangle", bracelet: { metals: ["gold", "silver"], price: 115 } },
];

export type PieceType = "necklace" | "bracelet";
export const collectionSlug = (type: PieceType, key: CollectionKey, metal: Metal): string => `${type}-${key}-${metal}`;

/** Every product of the collection, one entry per piece and metal. */
export const COLLECTION_PIECES: { slug: string; design: CollectionDesign; type: PieceType; metal: Metal; price: number }[] =
  COLLECTION_DESIGNS.flatMap((design) =>
    (["necklace", "bracelet"] as const).flatMap((type) => {
      const piece = design[type];
      return piece ? piece.metals.map((metal) => ({ slug: collectionSlug(type, design.key, metal), design, type, metal, price: piece.price })) : [];
    }),
  );

/**
 * The photos of each piece: public/Products/jewellery/new-collection/{design}-{type}-{metal}-{n}.webp (2000×2000), n = 1 is
 * the cover. One letter per photo, in order, naming what it shows (its alt text, lib/new-collection-products.ts):
 * p = product on white, m = on a model, b = in the box, c = the closed box, d = detail / another angle.
 * A piece missing here has NO photos: it shows the logo placeholder and stays hidden even with NEW_COLLECTION_LIVE on.
 */
export const COLLECTION_PHOTOS: Readonly<Record<string, string>> = {
  "necklace-verdis-gold": "pmbc",
  "necklace-verdis-silver": "pmbc",
  "necklace-lumen-gold": "pmbc",
  "necklace-lumen-silver": "pmbc",
  "necklace-noctis-silver": "pmbc",
  "bracelet-verdis-silver": "pmbcd",
  "bracelet-lumen-silver": "pmbcd",
  "bracelet-linea-gold": "pmbcd",
  "bracelet-linea-silver": "pmbcd",
  "bracelet-solaris-gold": "pmbcd",
  "bracelet-solaris-silver": "pmbcd",
  "bracelet-spira-gold": "pmbcd",
  "bracelet-spira-silver": "pmbcd",
};

/** The piece is in the shop: the collection is switched on AND the piece has its photos. */
export const pieceLive = (slug: string): boolean => NEW_COLLECTION_LIVE && !!COLLECTION_PHOTOS[slug];

export const NEW_COLLECTION_SLUGS: ReadonlySet<string> = new Set(COLLECTION_PIECES.map((p) => p.slug));
export const isCollectionSlug = (slug: string | undefined | null): boolean => !!slug && NEW_COLLECTION_SLUGS.has(slug);


// ─── Gold / silver swatches (like the watches' colours) ──────────────────────

export const METAL_SWATCH: Record<Metal, { bg: string; ro: string; color: string }> = {
  gold:   { bg: "Злато",  ro: "Auriu",    color: "#C9A84C" },
  silver: { bg: "Сребро", ro: "Argintiu", color: "#C4C7CC" },
};

/**
 * The swatch row of a collection product: its gold and silver twin (empty when the piece comes in one metal only, or its
 * twin is not in the shop - no swatch may lead to a hidden piece's 404).
 */
export function collectionSwatches(slug: string, lang: "bg" | "ro"): { slug: string; label: string; color: string; inStock: boolean }[] {
  const me = COLLECTION_PIECES.find((p) => p.slug === slug);
  if (!me) return [];
  const twins = COLLECTION_PIECES.filter((p) => p.design.key === me.design.key && p.type === me.type && pieceLive(p.slug));
  if (twins.length < 2) return [];
  return twins.map((p) => ({ slug: p.slug, label: METAL_SWATCH[p.metal][lang], color: METAL_SWATCH[p.metal].color, inStock: true }));
}

// ─── Sets: necklace + bracelet of one clover design, same metal ──────────────

export const COLLECTION_SETS: { id: string; label: string; labelRo: string; slots: string[][] }[] = COLLECTION_DESIGNS
  .filter((d) => d.kind === "clover" && d.necklace)
  .flatMap((d) =>
    (["gold", "silver"] as const)
      .filter((m) => d.necklace!.metals.includes(m) && d.bracelet.metals.includes(m))
      .map((m) => ({
        id: `${d.key}-${m}-set`,
        label: `Комплект ${d.name} – ${METAL_SWATCH[m].bg}`,
        labelRo: `Set ${d.name} – ${METAL_SWATCH[m].ro}`,
        slots: [[collectionSlug("necklace", d.key, m)], [collectionSlug("bracelet", d.key, m)]],
      })),
  );
