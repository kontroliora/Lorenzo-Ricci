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
import PHOTO_VERSIONS_JSON from "./collection-photo-versions.json";
const PHOTO_VERSIONS = PHOTO_VERSIONS_JSON as Record<string, string>;

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
 * The order is the owner's own numbering of the photos in the source folders (New Jewellery/), never re-sorted by kind.
 * A piece missing here has NO photos: it shows the logo placeholder and stays hidden even with NEW_COLLECTION_LIVE on.
 */
export const COLLECTION_PHOTOS: Readonly<Record<string, string>> = {
  "necklace-verdis-gold": "pmbc",
  "necklace-verdis-silver": "pmbc",
  "necklace-lumen-gold": "pmbc",
  "necklace-lumen-silver": "pmbc",
  "necklace-noctis-silver": "pmbc",
  "necklace-noctis-gold": "pmbc",
  // Clover bracelets have 5 clovers (owner, 10.11.2026): photo no. 1 is the new 5-clover photo with the LR tag; the two detail
  // photos (Verdis / Lumen gold) showing 4 clovers were removed; the open-box photos stay (owner's choice). Photo no. 3 is the
  // bracelet laid out straight (owner, 13.11.2026; clasp retouched plain, original backdrop kept - listed in
  // scripts/collection-photos.json so the whitening never touches it): round → on wrist → straight → open box → closed box.
  "bracelet-verdis-gold": "pmdbc",
  "bracelet-verdis-silver": "pmdbc",
  "bracelet-lumen-gold": "pmdbc",
  "bracelet-lumen-silver": "pmdbc",
  "bracelet-noctis-gold": "pmdbc",
  "bracelet-noctis-silver": "pmdbc",
  "bracelet-linea-gold": "pmbdc",
  "bracelet-linea-silver": "pdmbc",
  "bracelet-solaris-gold": "pmcbd",
  "bracelet-solaris-silver": "pmbdc",
  "bracelet-spira-gold": "pmdbc",
  "bracelet-spira-silver": "pmbdc",
};

/** The piece is in the shop: the collection is switched on AND the piece has its photos. */
export const pieceLive = (slug: string): boolean => NEW_COLLECTION_LIVE && !!COLLECTION_PHOTOS[slug];

/** Collection order everywhere (home, /jewellery, picker): by model Verdis → Noctis → Lumen → Linea → Solaris → Spira, and within a
 *  model necklace gold, necklace silver, bracelet gold, bracelet silver (= COLLECTION_PIECES order). */
export const collectionRank = (slug: string): number => { const i = COLLECTION_PIECES.findIndex((p) => p.slug === slug); return i < 0 ? 999 : i; };

/**
 * The home page's "Дамска колекция" row (BG + RO): one row of 4 = the first 4 pieces in collection order (the full Verdis set)
 * that are in the shop, in stock and have a white-background photo as no. 1 (the card shows photo no. 1, so the row looks uniform);
 * a piece without one is skipped and the next one in the same order takes its place.
 */
export const whiteCover = (slug: string): boolean => COLLECTION_PHOTOS[slug]?.[0] === "p";
export function homeCollectionPicks<T extends { slug: string; inStock: boolean }>(shop: T[], soldOut: ReadonlySet<string>, max = 4): T[] {
  return shop
    .filter((p) => isCollectionSlug(p.slug) && p.inStock && !soldOut.has(p.slug) && whiteCover(p.slug))
    .sort((a, b) => collectionRank(a.slug) - collectionRank(b.slug))
    .slice(0, max);
}

/**
 * URL of a new-collection photo, with its version tag (content hash from lib/collection-photo-versions.json, written by
 * scripts/collection-photos.mjs). Photos are cached a day by URL, so a replaced or renumbered file needs a new URL.
 */
export const collectionPhoto = (file: string): string =>
  `/Products/jewellery/new-collection/${file}${PHOTO_VERSIONS[file] ? `?v=${PHOTO_VERSIONS[file]}` : ""}`;

/** The two on-model photos of the home section's large image: a necklace on the neck, a bracelet on the wrist (Lumen Сребро). */
export const HOME_HERO_PHOTOS = {
  necklace: collectionPhoto("lumen-necklace-silver-2.webp"),
  bracelet: collectionPhoto("lumen-bracelet-silver-2.webp"),
} as const;

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

/**
 * "Комбинирайте с 1+1" on a collection product page (BG + RO): only other pieces of the women's collection that are in the shop
 * (photos), in stock and not sold out - never the other jewellery. Order: the matching piece of the same model (necklace <-> bracelet,
 * same metal), then the same model in the other metal, then the other models; each tier in collection order.
 */
export function collectionRelated<T extends { slug: string; inStock: boolean }>(slug: string, shop: T[], soldOut: ReadonlySet<string>, limit = 4): T[] {
  const me = COLLECTION_PIECES.find((p) => p.slug === slug);
  if (!me) return [];
  const tier = (s: string) => {
    const p = COLLECTION_PIECES.find((x) => x.slug === s)!;
    if (p.design.key === me.design.key && p.type !== me.type && p.metal === me.metal) return 0;
    if (p.design.key === me.design.key) return 1;
    return 2;
  };
  return shop
    .filter((p) => p.slug !== slug && isCollectionSlug(p.slug) && pieceLive(p.slug) && p.inStock && !soldOut.has(p.slug))
    .sort((a, b) => tier(a.slug) - tier(b.slug) || collectionRank(a.slug) - collectionRank(b.slug))
    .slice(0, limit);
}

// ─── Model rows under the gold / silver swatches (owner, 08.11.2026) ─────────
//
// Clover pieces: a "Камък" row (Verdis green / Noctis black / Lumen white mother-of-pearl) that keeps the type and the metal.
// Nail bangles: a "Камъни" row (Linea fewer stones / Solaris more stones) that keeps the metal. Spira: none.
// An option whose piece is hidden (pieceLive) or sold out (getSoldOutSlugs: catalogue switch + stock 0) is left out; the
// current piece always shows. A row with fewer than 2 options is not shown at all.

export type ModelOption = { slug: string; label: string; color?: string; background?: string; image?: string };
export type ModelRow = { title: string; kind: "swatch" | "image"; options: ModelOption[] };

const STONE_OPTIONS: Partial<Record<CollectionKey, { bg: string; ro: string; color: string; background?: string }>> = {
  verdis: { bg: "Зелен", ro: "Verde", color: "#1E6B47" },
  noctis: { bg: "Черен", ro: "Negru", color: "#151515" },
  // Mother-of-pearl: white with a soft iridescent sheen
  lumen:  { bg: "Бял",   ro: "Alb",   color: "#F4F1EC", background: "radial-gradient(circle at 30% 28%, #FFFFFF 0%, #F3EEF4 38%, #E6EEF0 68%, #EDE6DA 100%)" },
};
const BANGLE_OPTIONS: Partial<Record<CollectionKey, { bg: string; ro: string }>> = {
  linea:   { bg: "С малко камъни",  ro: "Cu mai puține pietre" },
  solaris: { bg: "С повече камъни", ro: "Cu mai multe pietre" },
};

export function collectionModelRow(slug: string, lang: "bg" | "ro", soldOut: ReadonlySet<string>, allowed: (slug: string) => boolean = () => true): ModelRow | null {
  const me = COLLECTION_PIECES.find((p) => p.slug === slug);
  if (!me) return null;
  const isStone = !!STONE_OPTIONS[me.design.key];
  if (!isStone && !BANGLE_OPTIONS[me.design.key]) return null;
  const keys = Object.keys(isStone ? STONE_OPTIONS : BANGLE_OPTIONS) as CollectionKey[];
  const options = keys
    .map((key) => ({ key, slug: collectionSlug(me.type, key, me.metal) }))
    .filter(({ slug: s }) => s === slug || (NEW_COLLECTION_SLUGS.has(s) && pieceLive(s) && !soldOut.has(s) && allowed(s)))
    .map(({ key, slug: s }): ModelOption => {
      if (isStone) { const o = STONE_OPTIONS[key]!; return { slug: s, label: o[lang], color: o.color, background: o.background }; }
      return { slug: s, label: BANGLE_OPTIONS[key]![lang], image: collectionPhoto(`${key}-${me.type}-${me.metal}-1.webp`) };
    });
  if (options.length < 2) return null;
  return { title: isStone ? (lang === "bg" ? "Камък" : "Piatră") : (lang === "bg" ? "Камъни" : "Pietre"), kind: isStone ? "swatch" : "image", options };
}

/**
 * "Вид" row of a clover piece (owner, 08.11.2026): Колие / Гривна of the same model and metal, as small photo + label, shown above
 * "Цвят". Same hiding rules as collectionModelRow; Linea / Solaris / Spira (bracelets only) get none.
 */
export function collectionTypeRow(slug: string, lang: "bg" | "ro", soldOut: ReadonlySet<string>, allowed: (slug: string) => boolean = () => true): ModelRow | null {
  const me = COLLECTION_PIECES.find((p) => p.slug === slug);
  if (!me || me.design.kind !== "clover") return null;
  const label = { necklace: { bg: "Колие", ro: "Colier" }, bracelet: { bg: "Гривна", ro: "Brățară" } } as const;
  const options = (["necklace", "bracelet"] as const)
    .map((type) => ({ type, slug: collectionSlug(type, me.design.key, me.metal) }))
    .filter(({ slug: s }) => s === slug || (NEW_COLLECTION_SLUGS.has(s) && pieceLive(s) && !soldOut.has(s) && allowed(s)))
    .map(({ type, slug: s }): ModelOption => ({ slug: s, label: label[type][lang], image: collectionPhoto(`${me.design.key}-${type}-${me.metal}-1.webp`) }));
  if (options.length < 2) return null;
  return { title: lang === "bg" ? "Вид" : "Tip", kind: "image", options };
}

// ─── The free-item picker's grouping (owner, 08.11.2026) ─────────────────────

export type CollectionGroup = "clover" | "nail" | "snake";
export const COLLECTION_GROUP_ORDER: CollectionGroup[] = ["clover", "nail", "snake"];
export const COLLECTION_GROUP_LABEL: Record<CollectionGroup, { bg: string; ro: string }> = {
  clover: { bg: "Детелини", ro: "Trifoi" },
  nail:   { bg: "Пирони",   ro: "Brățări-cui" },
  snake:  { bg: "Змия",     ro: "Șarpe" },
};
export function collectionGroupOf(slug: string): CollectionGroup | null {
  const p = COLLECTION_PIECES.find((x) => x.slug === slug);
  if (!p) return null;
  return p.design.kind === "clover" ? "clover" : p.design.key === "spira" ? "snake" : "nail";
}
/** The other half of the set: same clover model, same metal, necklace <-> bracelet (null for the bangles). */
export function collectionMatchOf(slug: string): string | null {
  const p = COLLECTION_PIECES.find((x) => x.slug === slug);
  if (!p || p.design.kind !== "clover") return null;
  const other = collectionSlug(p.type === "necklace" ? "bracelet" : "necklace", p.design.key, p.metal);
  return NEW_COLLECTION_SLUGS.has(other) ? other : null;
}

// ─── 1+1 default (owner, 08.11.2026: the free second piece is pre-selected) ──────────────────────────────────────────────────

/** The piece the 1+1 offers first with `slug`: a clover piece's other half of the set (same model + metal, necklace <-> bracelet);
 *  a bangle (Linea / Solaris / Spira): the same model in the other metal. null = none in the collection. */
export function collectionPartnerOf(slug: string): string | null {
  const p = COLLECTION_PIECES.find((x) => x.slug === slug);
  if (!p) return null;
  if (p.design.kind === "clover") return collectionMatchOf(slug);
  const other = collectionSlug(p.type, p.design.key, p.metal === "gold" ? "silver" : "gold");
  return NEW_COLLECTION_SLUGS.has(other) ? other : null;
}

/** Collection pieces ranked as a free second piece for the pieces in `held` (the page's piece, or the cart's): each one's partner
 *  first, then the closest (most shared slug parts: same model, same type, same metal), then collection order. `available` = the
 *  caller's live check (in the shop, in stock). `exclude` is left out (e.g. what the cart already holds). */
export function collectionFreeRanking(held: string[], available: (slug: string) => boolean, exclude: ReadonlySet<string> = new Set()): string[] {
  const own = held.filter((s) => NEW_COLLECTION_SLUGS.has(s));
  const partners = new Set(own.map(collectionPartnerOf).filter((s): s is string => !!s));
  const parts = own.map((s) => new Set(s.split("-")));
  const score = (slug: string) => Math.max(0, ...parts.map((ps) => slug.split("-").filter((x) => ps.has(x)).length));
  return COLLECTION_PIECES.map((p) => p.slug)
    .filter((s) => !exclude.has(s) && available(s))
    .sort((a, b) => Number(partners.has(b)) - Number(partners.has(a)) || score(b) - score(a) || collectionRank(a) - collectionRank(b));
}

/** Units of collection pieces in a list of cart / order lines (gift lines left out). */
export const collectionUnits = (lines: { slug?: unknown; quantity?: unknown; qty?: unknown; gift?: unknown }[]): number =>
  lines.reduce((n, l) => n + (!l.gift && typeof l.slug === "string" && NEW_COLLECTION_SLUGS.has(l.slug) ? Math.max(0, Math.floor(Number(l.quantity ?? l.qty ?? 1)) || 0) : 0), 0);

// ─── Cart drawer: the 3 free-piece suggestions (owner, 08.11.2026) ───────────────────────────────────────────────────────────

/** When no order data is there (or it cannot be read): the best seller the cart suggests. The real ranking comes from orders
 *  (app/api/collection-best-seller, lib/use-best-sellers.ts). */
export const COLLECTION_BEST_SELLER_FALLBACK = "necklace-verdis-gold";

export type FreeTag = "set" | "again" | "best" | null;

/** The cart's 3 suggestions for the free piece, in this order: the matching piece of the last collection piece in the cart
 *  ("Комплект": a clover piece's other half; a bangle's other metal, untagged), that same piece again ("Още едно такова"), the best
 *  seller (`bestSellers`, most sold first); anything missing (sold out / not addable) is filled from collectionFreeRanking. `canAdd` = the caller's live check
 *  (in the shop, stock above what the cart already holds). */
export function collectionCartTop3(cartSlugs: string[], canAdd: (slug: string) => boolean, bestSellers: string[] = [COLLECTION_BEST_SELLER_FALLBACK]): { slug: string; tag: FreeTag }[] {
  const own = cartSlugs.filter((s) => NEW_COLLECTION_SLUGS.has(s));
  const last = own[own.length - 1];
  const out: { slug: string; tag: FreeTag }[] = [];
  const push = (slug: string | null | undefined, tag: FreeTag) => {
    if (slug && out.length < 3 && !out.some((o) => o.slug === slug) && canAdd(slug)) out.push({ slug, tag });
  };
  if (last) {
    const partner = collectionPartnerOf(last);
    push(partner, partner && partner === collectionMatchOf(last) ? "set" : null);
    push(last, "again");
  }
  for (const s of bestSellers) { if (out.some((o) => o.tag === "best")) break; push(s, "best"); }
  for (const s of collectionFreeRanking(own, canAdd)) push(s, null);
  return out;
}
