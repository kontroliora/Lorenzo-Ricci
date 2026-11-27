// Home hero (BG): which products the two slides show. Rule (owner, 15.11.2026): a hero slide NEVER shows a sold-out product.
// The home page passes the live sold-out set (lib/sold-out.ts getSoldOutSlugs: catalogue switch + wallet_inventory at 0); the page
// is rebuilt as soon as something sells out (lib/stock-pages.ts), so the hero falls back to the next in-stock option by itself.
//
//   Slide 1 (jewellery): the on-model photos of a necklace + bracelet of the same design and metal, both in the shop and in stock.
//   Slide 2 (watch + gift): the first in-stock Yachting (Blue, Black, White) with the cardholder Onice next to it while that is in
//   stock (images: scripts/make-hero-watch.mjs). No in-stock watch at all = no watch slide.
import { COLLECTION_PHOTOS, collectionPhoto, pieceLive } from "./new-collection";
import { getProductBySlug } from "./products";
import { SHELF } from "./storefront";

type Pair = { design: string; metal: "gold" | "silver"; label: string };
const JEWEL_PAIRS: Pair[] = [
  { design: "lumen", metal: "silver", label: "Lumen – Сребро" },
  { design: "lumen", metal: "gold", label: "Lumen – Злато" },
  { design: "verdis", metal: "gold", label: "Verdis – Злато" },
  { design: "verdis", metal: "silver", label: "Verdis – Сребро" },
  { design: "noctis", metal: "silver", label: "Noctis – Сребро" },
  { design: "noctis", metal: "gold", label: "Noctis – Злато" },
];

/** The on-model photo (kind "m") of a collection piece, or null. */
function modelPhoto(slug: string): string | null {
  const kinds = COLLECTION_PHOTOS[slug];
  const i = kinds?.indexOf("m") ?? -1;
  if (i < 0) return null;
  const [type, key, metal] = slug.split("-");
  return collectionPhoto(`${key}-${type}-${metal}-${i + 1}.webp`);
}

export type HeroJewel = { necklace: string; bracelet: string; alts: { necklace: string; bracelet: string }; slugs: string[] };

export function heroJewel(soldOut: ReadonlySet<string>): HeroJewel | null {
  const ok = (slug: string) => pieceLive(slug) && !soldOut.has(slug) && modelPhoto(slug) !== null;
  for (const p of JEWEL_PAIRS) {
    const n = `necklace-${p.design}-${p.metal}`, b = `bracelet-${p.design}-${p.metal}`;
    if (ok(n) && ok(b)) return {
      necklace: modelPhoto(n)!, bracelet: modelPhoto(b)!, slugs: [n, b],
      alts: { necklace: `Колие ${p.label} на модел, дамска колекция Lorenzo Ricci`, bracelet: `Гривна ${p.label.replace(/ – .*$/, "")} ${p.metal === "gold" ? "Gold" : "Silver"} на модел, дамска колекция Lorenzo Ricci` },
    };
  }
  // No matching pair in stock: any in-stock necklace and bracelet with an on-model photo.
  const all = JEWEL_PAIRS.flatMap((p) => [`necklace-${p.design}-${p.metal}`, `bracelet-${p.design}-${p.metal}`]);
  const n = all.find((s) => s.startsWith("necklace") && ok(s)), b = all.find((s) => s.startsWith("bracelet") && ok(s));
  if (!n || !b) return null;
  return { necklace: modelPhoto(n)!, bracelet: modelPhoto(b)!, slugs: [n, b], alts: { necklace: "Колие на модел, дамска колекция Lorenzo Ricci", bracelet: "Гривна на модел, дамска колекция Lorenzo Ricci" } };
}

const WATCHES = [
  { slug: "yachting-blue", colour: "blue", name: "Yachting Blue" },
  { slug: "yachting-black", colour: "black", name: "Yachting Black" },
  { slug: "yachting-white", colour: "white", name: "Yachting White" },
] as const;
const GIFT_CARDHOLDER = "cardholder-onice";

export type HeroWatch = { src: string; alt: string; slugs: string[] };

export function heroWatch(soldOut: ReadonlySet<string>): HeroWatch | null {
  if (!SHELF.watches || !SHELF.leather) return null; // hidden collection (lib/storefront.ts): no watch slide (it shows a cardholder too)
  const w = WATCHES.find((x) => !soldOut.has(x.slug));
  if (!w) return null;
  const card = !soldOut.has(GIFT_CARDHOLDER);
  return {
    src: `/covers/hero-watch-${w.colour}${card ? "-onice" : ""}.webp`,
    alt: card ? `Часовник ${w.name} и кардхолдър от крокодилска кожа Onice – подарък` : `Часовник ${w.name}`,
    slugs: card ? [w.slug, GIFT_CARDHOLDER] : [w.slug],
  };
}

// General brand slide (owner, 15.11.2026): a watch, a jewellery piece and a crocodile-leather piece together, each the first one in
// stock. The watch is its transparent cutout; the bracelet's photo no. 1 and the wallets' covers are on white, like the slide.
const GENERAL_WATCHES = [
  { slug: "yachting-blue", src: "/Products/watches/Yachting Blue/yachting-blue-hronograf-preden-izgled-v2.webp", name: "Yachting Blue" },
  { slug: "yachting-black", src: "/Products/watches/Yachting Black/yachting-black-hronograf-preden-izgled-v2.webp", name: "Yachting Black" },
  { slug: "yachting-white", src: "/Products/watches/Yachting White/yachting-white-hronograf-preden-izgled-v2.webp", name: "Yachting White" },
];
const GENERAL_DESIGNS = ["verdis", "lumen", "noctis", "solaris", "spira", "linea"];
const GENERAL_JEWELS = [...GENERAL_DESIGNS.map((d) => `bracelet-${d}-gold`), ...GENERAL_DESIGNS.map((d) => `bracelet-${d}-silver`)];
// Dark crocodile first (it reads on the white slide): the green / red wallets, else the black cardholder Onice, ...; the white wallet last.
const GENERAL_LEATHER = ["wallet-smeraldo", "wallet-rubino", "cardholder-onice", "cardholder-giada", "cardholder-cremisi", "cardholder-zaffiro", "wallet-alabastro"];

export type HeroGeneralItem = { src: string; alt: string; slug: string; kind: "watch" | "jewel" | "leather" };
export type HeroGeneral = { items: HeroGeneralItem[]; slugs: string[] };

export function heroGeneral(soldOut: ReadonlySet<string>): HeroGeneral | null {
  // The brand slide shows a watch + a jewellery piece + a leather piece side by side (lib/storefront.ts): with the watches or the
  // leather goods hidden it would show hidden products, so it is not built (the women's collection slide stays the hero).
  if (!SHELF.watches || !SHELF.leather) return null;
  const items: HeroGeneralItem[] = [];
  const w = GENERAL_WATCHES.find((x) => !soldOut.has(x.slug));
  if (w) items.push({ src: w.src, alt: `Часовник ${w.name}`, slug: w.slug, kind: "watch" });
  const j = GENERAL_JEWELS.find((s) => pieceLive(s) && !soldOut.has(s) && COLLECTION_PHOTOS[s]);
  if (j) { const [type, key, metal] = j.split("-"); items.push({ src: collectionPhoto(`${key}-${type}-${metal}-1.webp`), alt: `Гривна ${key[0].toUpperCase()}${key.slice(1)} ${metal === "gold" ? "Gold" : "Silver"}`, slug: j, kind: "jewel" }); }
  const l = GENERAL_LEATHER.map((s) => getProductBySlug(s)).find((p) => p && !soldOut.has(p.slug));
  if (l) items.push({ src: l.coverImage.src, alt: l.coverImage.alt, slug: l.slug, kind: "leather" });
  return items.length >= 2 ? { items, slugs: items.map((i) => i.slug) } : null;
}
