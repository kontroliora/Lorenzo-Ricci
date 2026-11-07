// Product data of the 2026 women's collection (switch, slugs, photos, sets: lib/new-collection.ts; 1+1: lib/one-plus-one.ts). Each design comes in gold and
// silver, every metal is its own product (like the watches' colours), joined by the "Цвят" swatches on the product page.
// Bulgarian text here; the Romanian overlay is NEW_COLLECTION_RO below (merged into lib/ro/products-ro.ts and lib/ro/names-ro.ts).
//
// MATERIAL WORDING - only what the existing gold-plated jewellery already says (316L + 18K PVD) is claimed. Pending the owner:
//   - the inlay of the clovers: "зелена / черна / перлена вложка", the stone is NOT named (owner, 06.11.2026),
//   - the stones of the bangles, lengths / sizes (no stamp on these pieces - owner, 06.11.2026: never mention one),
//   - the silver version's finish (only "316L неръждаема стомана", colour "Сребърен").
// Empty spec values hide their row (ProductInfo / RoProductInfo), so they can be filled in later without layout changes.
import type { Product, ProductSpec } from "./types";
import { COLLECTION_PHOTOS, COLLECTION_PIECES, pieceLive, type CollectionKey, type Metal, type PieceType } from "./new-collection";

// Placeholder for a piece with no photos yet: the brand logo.
const PLACEHOLDER = "/logo.webp";

// The photo list (which pieces have photos, in what order) is COLLECTION_PHOTOS in lib/new-collection.ts; this is the alt text
// each kind of photo adds to the product name.
const PHOTO_ALT: Record<string, Lang> = {
  p: { bg: "", ro: "" },
  m: { bg: " – на модел", ro: " – purtat" },
  b: { bg: " в кутия", ro: " în cutie" },
  c: { bg: " – луксозна кутия за подарък", ro: " – cutie de cadou de lux" },
  d: { bg: " – детайл", ro: " – detaliu" },
};
const photos = (slug: string, type: PieceType, key: CollectionKey, metal: Metal, alt: string, lang: "bg" | "ro") => {
  const kinds = COLLECTION_PHOTOS[slug];
  if (!kinds) return [{ src: PLACEHOLDER, alt }];
  return [...kinds].map((k, i) => ({
    src: `/Products/jewellery/new-collection/${key}-${type}-${metal}-${i + 1}.webp`,
    alt: `${alt}${PHOTO_ALT[k][lang]}`,
  }));
};

type Lang = { bg: string; ro: string };
type DesignText = {
  short: Record<PieceType, Lang>;
  // {metal} -> "златна" / "сребриста" (BG), "aurie" / "argintie" (RO)
  description: Record<PieceType, Lang>;
  features: Record<PieceType, Lang[]>;
  extraSpecs?: { label: Lang; value?: Lang }[]; // design-specific rows; no value = hidden row until confirmed
};

const METAL_WORD: Record<Metal, Lang> = { gold: { bg: "златна", ro: "aurie" }, silver: { bg: "сребриста", ro: "argintie" } };
const METAL_NAME: Record<Metal, Lang> = { gold: { bg: "Злато", ro: "Auriu" }, silver: { bg: "Сребро", ro: "Argintiu" } };
const COLOR: Record<Metal, Lang> = { gold: { bg: "Златен", ro: "Auriu" }, silver: { bg: "Сребърен", ro: "Argintiu" } };
const TYPE_NAME: Record<PieceType, Lang> = { necklace: { bg: "Колие", ro: "Colier" }, bracelet: { bg: "Гривна", ro: "Brățară" } };

const INLAY = (bg: string, ro: string): { label: Lang; value: Lang } => ({ label: { bg: "Вложка", ro: "Inserție" }, value: { bg, ro } });
const STONES: { label: Lang } = { label: { bg: "Камъни", ro: "Pietre" } };

const TEXT: Record<CollectionKey, DesignText> = {
  verdis: {
    short: { necklace: { bg: "Зелена детелина до сърцето", ro: "Un trifoi verde aproape de inimă" }, bracelet: { bg: "Зелена детелина на китката", ro: "Un trifoi verde la încheietură" } },
    description: {
      necklace: {
        bg: "Четирилистна детелина с наситено зелена вложка в {metal} рамка. Малък символ на късмет, който стои точно там, където трябва – близо до сърцето. Подарък, който се помни дълго след като кутията е отворена.",
        ro: "Un trifoi cu patru foi, cu inserție de un verde intens, într-o ramă {metal}. Un mic simbol al norocului, purtat exact acolo unde îi este locul – aproape de inimă. Un cadou care rămâne în amintire mult după ce cutia a fost deschisă.",
      },
      bracelet: {
        bg: "Детелини с наситено зелена вложка в {metal} рамка, подредени по фината верижка. Носят се сами или до часовник и внасят свежест във всяка визия. Подарък с пожелание за късмет.",
        ro: "Trifoi cu inserție de un verde intens, în ramă {metal}, așezați de-a lungul unui lănțișor fin. Se poartă singuri sau alături de un ceas și aduc prospețime oricărei ținute. Un cadou cu urare de noroc.",
      },
    },
    features: {
      necklace: [{ bg: "Четирилистна детелина", ro: "Trifoi cu patru foi" }, { bg: "Наситено зелена вложка", ro: "Inserție de un verde intens" }, { bg: "Фина верижка", ro: "Lănțișor fin" }, { bg: "Подарък с пожелание за късмет", ro: "Un cadou cu urare de noroc" }],
      bracelet: [{ bg: "Детелини по цялата верижка", ro: "Trifoi de-a lungul lănțișorului" }, { bg: "Наситено зелена вложка", ro: "Inserție de un verde intens" }, { bg: "Самостоятелно или до часовник", ro: "Singură sau alături de un ceas" }, { bg: "Подарък с пожелание за късмет", ro: "Un cadou cu urare de noroc" }],
    },
    extraSpecs: [INLAY("Зелена", "Verde")],
  },
  noctis: {
    short: { necklace: { bg: "Черна детелина с характер", ro: "Un trifoi negru, cu caracter" }, bracelet: { bg: "Черна детелина на китката", ro: "Un trifoi negru la încheietură" } },
    description: {
      necklace: {
        bg: "Детелина с дълбоко черна вложка, изчистена и уверена. Контрастът с {metal} рамка стои еднакво добре с бяла риза сутрин и с вечерна рокля. Сдържана елегантност, която не минава незабелязана.",
        ro: "Un trifoi cu inserție de un negru profund, curat și sigur pe el. Contrastul cu rama {metal} se potrivește la fel de bine cu o cămașă albă dimineața și cu o rochie de seară. O eleganță discretă, care nu trece neobservată.",
      },
      bracelet: {
        bg: "Детелини с дълбоко черна вложка в {metal} рамка, подредени по фината верижка. Графичен контраст, който придава характер на китката – самостоятелно или в комбинация.",
        ro: "Trifoi cu inserție de un negru profund, în ramă {metal}, așezați de-a lungul unui lănțișor fin. Un contrast grafic care dă caracter încheieturii – singură sau în combinație.",
      },
    },
    features: {
      necklace: [{ bg: "Четирилистна детелина", ro: "Trifoi cu patru foi" }, { bg: "Дълбоко черна вложка", ro: "Inserție de un negru profund" }, { bg: "Фина верижка", ro: "Lănțișor fin" }, { bg: "От деня до вечерта", ro: "De zi și de seară" }],
      bracelet: [{ bg: "Детелини по цялата верижка", ro: "Trifoi de-a lungul lănțișorului" }, { bg: "Дълбоко черна вложка", ro: "Inserție de un negru profund" }, { bg: "Графичен контраст", ro: "Contrast grafic" }, { bg: "От деня до вечерта", ro: "De zi și de seară" }],
    },
    extraSpecs: [INLAY("Черна", "Neagră")],
  },
  lumen: {
    short: { necklace: { bg: "Детелина от светлина", ro: "Un trifoi de lumină" }, bracelet: { bg: "Светлина на китката", ro: "Lumină la încheietură" } },
    description: {
      necklace: {
        bg: "Детелина с перлено бяла вложка, която улавя светлината и я връща с мек, преливащ блясък. В {metal} рамка, нежна, но с присъствие. За моментите, които заслужават светлина.",
        ro: "Un trifoi cu inserție alb-sidefie, care prinde lumina și o redă într-o strălucire blândă, irizată. Într-o ramă {metal}, delicat, dar cu prezență. Pentru momentele care merită lumină.",
      },
      bracelet: {
        bg: "Детелини с перлено бяла вложка в {metal} рамка, подредени по фината верижка. Мекият им блясък се променя с всяко движение на ръката. Нежен подарък, който се носи всеки ден.",
        ro: "Trifoi cu inserție alb-sidefie, în ramă {metal}, așezați de-a lungul unui lănțișor fin. Strălucirea lor blândă se schimbă la fiecare mișcare a mâinii. Un cadou delicat, de purtat în fiecare zi.",
      },
    },
    features: {
      necklace: [{ bg: "Четирилистна детелина", ro: "Trifoi cu patru foi" }, { bg: "Перлено бяла вложка", ro: "Inserție alb-sidefie" }, { bg: "Мек, преливащ блясък", ro: "Strălucire blândă, irizată" }, { bg: "Нежен подарък за нея", ro: "Un cadou delicat pentru ea" }],
      bracelet: [{ bg: "Детелини по цялата верижка", ro: "Trifoi de-a lungul lănțișorului" }, { bg: "Перлено бяла вложка", ro: "Inserție alb-sidefie" }, { bg: "Мек, преливащ блясък", ro: "Strălucire blândă, irizată" }, { bg: "Нежен подарък за нея", ro: "Un cadou delicat pentru ea" }],
    },
    extraSpecs: [INLAY("Перлена", "Sidefie")],
  },
  linea: {
    short: { necklace: { bg: "", ro: "" }, bracelet: { bg: "Една линия светлина", ro: "O singură linie de lumină" } },
    description: {
      necklace: { bg: "", ro: "" },
      bracelet: {
        bg: "Гривна във формата на пирон, огъната около китката, с фина линия от камъни по главата. Строг силует и мек блясък – модерна класика, която стои сама или до часовник.",
        ro: "O brățară în formă de cui, curbată în jurul încheieturii, cu o linie fină de pietre pe cap. O siluetă precisă și o strălucire blândă – un clasic modern, purtat singur sau alături de un ceas.",
      },
    },
    features: {
      necklace: [],
      bracelet: [{ bg: "Силует на пирон", ro: "Siluetă de cui" }, { bg: "Фина линия от камъни", ro: "Linie fină de pietre" }, { bg: "Твърда гривна", ro: "Brățară rigidă" }, { bg: "Самостоятелно или до часовник", ro: "Singură sau alături de un ceas" }],
    },
    extraSpecs: [STONES],
  },
  solaris: {
    short: { necklace: { bg: "", ro: "" }, bracelet: { bg: "Блясък при всяко движение", ro: "Strălucire la fiecare mișcare" } },
    description: {
      necklace: { bg: "", ro: "" },
      bracelet: {
        bg: "Гривна във формата на пирон, изцяло обсипана с камъни. Улавя светлината от всеки ъгъл и я превръща в блясък при всяко движение на ръката. За вечерите, в които искате да блестите.",
        ro: "O brățară în formă de cui, acoperită în întregime cu pietre. Prinde lumina din orice unghi și o transformă în strălucire la fiecare mișcare a mâinii. Pentru serile în care vreți să străluciți.",
      },
    },
    features: {
      necklace: [],
      bracelet: [{ bg: "Силует на пирон", ro: "Siluetă de cui" }, { bg: "Изцяло обсипана с камъни", ro: "Acoperită în întregime cu pietre" }, { bg: "Твърда гривна", ro: "Brățară rigidă" }, { bg: "Вечерен блясък", ro: "Strălucire de seară" }],
    },
    extraSpecs: [STONES],
  },
  spira: {
    short: { necklace: { bg: "", ro: "" }, bracelet: { bg: "Змия от светлина", ro: "Un șarpe de lumină" } },
    description: {
      necklace: { bg: "", ro: "" },
      bracelet: {
        bg: "Гривна-змия, която обвива китката с плавна извивка, а камъните следват линията на тялото ѝ. Смел символ, изработен с прецизност. Подарък с характер за жената, която се помни.",
        ro: "O brățară-șarpe care înconjoară încheietura într-o curbă fluidă, iar pietrele urmează linia corpului său. Un simbol îndrăzneț, realizat cu precizie. Un cadou cu caracter pentru femeia care nu se uită.",
      },
    },
    features: {
      necklace: [],
      bracelet: [{ bg: "Силует на змия", ro: "Siluetă de șarpe" }, { bg: "Камъни по линията на тялото", ro: "Pietre de-a lungul corpului" }, { bg: "Твърда гривна", ro: "Brățară rigidă" }, { bg: "Подарък с характер", ro: "Un cadou cu caracter" }],
    },
    extraSpecs: [STONES],
  },
};

// Material rows: the gold version uses the existing gold jewellery's wording word for word; the silver version claims only the steel.
const materialSpecs = (metal: Metal, lang: "bg" | "ro"): ProductSpec[] =>
  metal === "gold"
    ? lang === "bg"
      ? [{ label: "Материал", value: "316L неръждаема стомана с 18K PVD покритие" }, { label: "Покритие", value: "4-слойно 18K PVD златно" }]
      : [{ label: "Material", value: "Oțel inoxidabil 316L cu placare 18K PVD" }, { label: "Placare", value: "Aurie 18K PVD, în 4 straturi" }]
    : lang === "bg"
      ? [{ label: "Материал", value: "316L неръждаема стомана" }]
      : [{ label: "Material", value: "Oțel inoxidabil 316L" }];

function specs(key: CollectionKey, type: PieceType, metal: Metal, lang: "bg" | "ro"): ProductSpec[] {
  return [
    ...materialSpecs(metal, lang),
    ...(TEXT[key].extraSpecs ?? []).map((s) => ({ label: s.label[lang], value: s.value?.[lang] ?? "" })),
    { label: lang === "bg" ? "Дължина" : "Lungime", value: "" }, // pending the owner's measurement
    { label: lang === "bg" ? "Пол" : "Gen", value: lang === "bg" ? "Дамски" : "Damă" },
    { label: lang === "bg" ? "Цвят" : "Culoare", value: COLOR[metal][lang] },
  ];
}

const sku = (type: PieceType, key: CollectionKey, metal: Metal) =>
  `${type === "necklace" ? "KO" : "GR"}-${key.toUpperCase()}-${metal === "gold" ? "G" : "S"}`;

const fill = (s: string, metal: Metal, lang: "bg" | "ro") => s.replace("{metal}", METAL_WORD[metal][lang]);

export const NEW_COLLECTION_PRODUCTS: Product[] = COLLECTION_PIECES.map(({ slug, design, type, metal, price }) => {
  const t = TEXT[design.key];
  const name = `${TYPE_NAME[type].bg} ${design.name} – ${METAL_NAME[metal].bg}`;
  const alt = `${name} Lorenzo Ricci`;
  return {
    id: slug,
    slug,
    sku: sku(type, design.key, metal),
    name,
    category: "jewellery",
    subcategory: type,
    metal,
    hidden: !pieceLive(slug), // collection switched off, or this piece has no photos yet
    // New products: no struck-through "old" price (EU Omnibus) - the 1+1 is their only promotion (lib/one-plus-one.ts, group "jewellery").
    price,
    currency: "€",
    inStock: pieceLive(slug),
    stock: 0,
    warranty: "Доживотна гаранция",
    shortDescription: t.short[type].bg,
    description: fill(t.description[type].bg, metal, "bg"),
    features: t.features[type].map((f) => f.bg),
    specs: specs(design.key, type, metal, "bg"),
    coverImage: photos(slug, type, design.key, metal, alt, "bg")[0],
    images: photos(slug, type, design.key, metal, alt, "bg"),
  };
});

/** Romanian overlay, same shape as lib/ro/products-ro.ts RO_PRODUCTS entries (merged there), plus the Romanian names. */
export const NEW_COLLECTION_RO: Record<string, {
  name: string;
  shortDescription: string;
  description: string;
  features: string[];
  specs: ProductSpec[];
  warranty: string;
  coverAlt: string;
  imageAlts: string[];
}> = Object.fromEntries(
  COLLECTION_PIECES.map(({ slug, design, type, metal }) => {
    const t = TEXT[design.key];
    const name = `${TYPE_NAME[type].ro} ${design.name} – ${METAL_NAME[metal].ro}`;
    return [slug, {
      name,
      shortDescription: t.short[type].ro,
      description: fill(t.description[type].ro, metal, "ro"),
      features: t.features[type].map((f) => f.ro),
      specs: specs(design.key, type, metal, "ro"),
      warranty: "Garanție pe viață",
      coverAlt: `${name} Lorenzo Ricci`,
      imageAlts: photos(slug, type, design.key, metal, `${name} Lorenzo Ricci`, "ro").map((i) => i.alt),
    }];
  }),
);
