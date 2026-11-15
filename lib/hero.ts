// Home hero (BG): which products the two slides show. Rule (owner, 15.11.2026): a hero slide NEVER shows a sold-out product.
// The home page passes the live sold-out set (lib/sold-out.ts getSoldOutSlugs: catalogue switch + wallet_inventory at 0); the page
// is rebuilt as soon as something sells out (lib/stock-pages.ts), so the hero falls back to the next in-stock option by itself.
//
//   Slide 1 (jewellery): the on-model photos of a necklace + bracelet of the same design and metal, both in the shop and in stock.
//   Slide 2 (watch + gift): the first in-stock Yachting (Blue, Black, White) with the cardholder Onice next to it while that is in
//   stock (images: scripts/make-hero-watch.mjs). No in-stock watch at all = no watch slide.
import { COLLECTION_PHOTOS, collectionPhoto, pieceLive } from "./new-collection";

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
      alts: { necklace: `Колие ${p.label} на модел, дамска колекция Lorenzo Ricci`, bracelet: `Гривна ${p.label} на модел, дамска колекция Lorenzo Ricci` },
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
  const w = WATCHES.find((x) => !soldOut.has(x.slug));
  if (!w) return null;
  const card = !soldOut.has(GIFT_CARDHOLDER);
  return {
    src: `/covers/hero-watch-${w.colour}${card ? "-onice" : ""}.webp`,
    alt: card ? `Часовник ${w.name} и кардхолдър от крокодилска кожа Onice – подарък` : `Часовник ${w.name}`,
    slugs: card ? [w.slug, GIFT_CARDHOLDER] : [w.slug],
  };
}
