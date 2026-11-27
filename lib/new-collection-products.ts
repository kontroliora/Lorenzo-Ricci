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
import { COLLECTION_PHOTOS, COLLECTION_PIECES, collectionPhoto, pieceLive, type CollectionKey, type Metal, type PieceType } from "./new-collection";

// Placeholder for a piece with no photos yet: the brand logo.
const PLACEHOLDER = "/logo.webp";

// The photo list (which pieces have photos, in what order) is COLLECTION_PHOTOS in lib/new-collection.ts; this is the alt text
// each kind of photo adds to the product name.
const PHOTO_ALT: Record<string, Lang> = {
  p: { bg: "", ro: "" },
  m: { bg: " – на модел", ro: " – purtat" },
  b: { bg: " в кутия", ro: " în cutie" },
  c: { bg: " – кутия LORENZO RICCI", ro: " – cutie LORENZO RICCI" },
  d: { bg: " – детайл", ro: " – detaliu" },
};
const photos = (slug: string, type: PieceType, key: CollectionKey, metal: Metal, alt: string, lang: "bg" | "ro") => {
  const kinds = COLLECTION_PHOTOS[slug];
  if (!kinds) return [{ src: PLACEHOLDER, alt }];
  return [...kinds].map((k, i) => ({
    src: collectionPhoto(`${key}-${type}-${metal}-${i + 1}.webp`),
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
// Women's bracelets (owner, 27.11.2026): "Гривна Verdis Gold" / "Silver" in the BG title (no dash), and the BG description says
// "в златист цвят" / "в сребрист цвят" - never that the piece is made of gold or silver. Necklaces and the RO texts are unchanged.
const BRACELET_METAL_NAME: Record<Metal, string> = { gold: "Gold", silver: "Silver" };
const BRACELET_METAL_COLOUR: Record<Metal, string> = { gold: "в златист цвят", silver: "в сребрист цвят" };
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
        bg: "Четирилистна детелина с наситено зелена вложка в гранулиран обков. Носи се самостоятелно или с други колиета.",
        ro: "Un trifoi cu patru foi, cu inserție de un verde intens, într-o ramă granulată. Se poartă singur sau alături de alte coliere.",
      },
      bracelet: {
        bg: "Детелини с наситено зелена вложка по цялата верижка. Изглежда добре сама или в комбинация с часовник и други гривни.",
        ro: "Trifoi cu inserție de un verde intens de-a lungul întregului lănțișor. Arată bine singură sau în combinație cu un ceas și cu alte brățări.",
      },
    },
    features: {
      necklace: [{ bg: "Четирилистна детелина с наситено зелена вложка", ro: "Trifoi cu patru foi, cu inserție de un verde intens" }, { bg: "Фин гранулиран обков около детелината", ro: "Ramă fină granulată în jurul trifoiului" }, { bg: "Регулируема дължина с удължител", ro: "Lungime reglabilă, cu prelungitor" }, { bg: "Изчистен акцент за всеки ден и за вечер", ro: "Un accent curat, de zi și de seară" }],
      bracelet: [{ bg: "Четирилистни детелини с наситено зелена вложка", ro: "Trifoi cu patru foi, cu inserție de un verde intens" }, { bg: "Фин гранулиран обков около всяка детелина", ro: "Ramă fină granulată în jurul fiecărui trifoi" }, { bg: "Регулируема дължина с удължител", ro: "Lungime reglabilă, cu prelungitor" }, { bg: "Стои добре сама или до часовник", ro: "Arată bine singură sau lângă un ceas" }],
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
        bg: "Детелини с дълбоко черна вложка в рамка {metal}, подредени по фината верижка. Графичен контраст, който придава характер на китката – самостоятелно или в комбинация.",
        ro: "Trifoi cu inserție de un negru profund, în ramă {metal}, așezați de-a lungul unui lănțișor fin. Un contrast grafic care dă caracter încheieturii – singură sau în combinație.",
      },
    },
    features: {
      necklace: [{ bg: "Четирилистна детелина с дълбоко черна вложка", ro: "Trifoi cu patru foi, cu inserție de un negru profund" }, { bg: "Фин гранулиран обков около детелината", ro: "Ramă fină granulată în jurul trifoiului" }, { bg: "Регулируема дължина с удължител", ro: "Lungime reglabilă, cu prelungitor" }, { bg: "Изчистен контраст за всеки ден и за вечер", ro: "Un contrast curat, de zi și de seară" }],
      bracelet: [{ bg: "Четирилистни детелини с дълбоко черна вложка", ro: "Trifoi cu patru foi, cu inserție de un negru profund" }, { bg: "Фин гранулиран обков около всяка детелина", ro: "Ramă fină granulată în jurul fiecărui trifoi" }, { bg: "Регулируема дължина с удължител", ro: "Lungime reglabilă, cu prelungitor" }, { bg: "Изчистен контраст за всеки ден и за вечер", ro: "Un contrast curat, de zi și de seară" }],
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
        bg: "Детелини с перлено бяла вложка, която прелива на светлина. Лека и изчистена, за всеки ден.",
        ro: "Trifoi cu inserție alb-sidefie, care se irizează în lumină. Ușoară și simplă, de purtat în fiecare zi.",
      },
    },
    features: {
      necklace: [{ bg: "Четирилистна детелина с перлено бяла вложка", ro: "Trifoi cu patru foi, cu inserție alb-sidefie" }, { bg: "Мек, преливащ блясък на светлина", ro: "Strălucire blândă, irizată, în lumină" }, { bg: "Фин гранулиран обков", ro: "Ramă fină granulată" }, { bg: "Регулируема дължина с удължител", ro: "Lungime reglabilă, cu prelungitor" }],
      bracelet: [{ bg: "Четирилистни детелини с перлено бяла вложка", ro: "Trifoi cu patru foi, cu inserție alb-sidefie" }, { bg: "Мек, преливащ блясък на светлина", ro: "Strălucire blândă, irizată, în lumină" }, { bg: "Фин гранулиран обков", ro: "Ramă fină granulată" }, { bg: "Регулируема дължина с удължител", ro: "Lungime reglabilă, cu prelungitor" }],
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
      bracelet: [{ bg: "Тънка твърда гривна с форма на пирон", ro: "Brățară rigidă, subțire, în formă de cui" }, { bg: "Камъни по главата и върха", ro: "Pietre pe cap și pe vârf" }, { bg: "Отваря се със скрита закопчалка", ro: "Se deschide cu o închizătoare ascunsă" }, { bg: "Минималистична, лесна за комбиниране", ro: "Minimalistă, ușor de asortat" }],
    },
    extraSpecs: [STONES],
  },
  solaris: {
    short: { necklace: { bg: "", ro: "" }, bracelet: { bg: "Блясък при всяко движение", ro: "Strălucire la fiecare mișcare" } },
    description: {
      necklace: { bg: "", ro: "" },
      bracelet: {
        bg: "Гривна пирон с камъни до половината. Повече блясък от Linea, но все така изчистена за всеки ден.",
        ro: "Brățară-cui cu pietre până la jumătate. Mai multă strălucire decât Linea, dar la fel de minimalistă, pentru fiecare zi.",
      },
    },
    features: {
      necklace: [],
      bracelet: [{ bg: "Гривна пирон с камъни до половината", ro: "Brățară-cui cu pietre până la jumătate" }, { bg: "Повече блясък от Linea", ro: "Mai multă strălucire decât Linea" }, { bg: "Отваря се със скрита закопчалка", ro: "Se deschide cu o închizătoare ascunsă" }, { bg: "Ефектна сама или до Linea", ro: "Spectaculoasă singură sau alături de Linea" }],
    },
    extraSpecs: [STONES],
  },
  spira: {
    short: { necklace: { bg: "", ro: "" }, bracelet: { bg: "Змия от светлина", ro: "Un șarpe de lumină" } },
    description: {
      necklace: { bg: "", ro: "" },
      bracelet: {
        bg: "Змия, увита около китката, с люспи, покрити с камъни. Смел акцент, който се забелязва.",
        ro: "Un șarpe înfășurat în jurul încheieturii, cu solzi acoperiți cu pietre. Un accent îndrăzneț, care nu trece neobservat.",
      },
    },
    features: {
      necklace: [],
      bracelet: [{ bg: "Змия, увита около китката", ro: "Un șarpe înfășurat în jurul încheieturii" }, { bg: "Люспи, покрити с камъни", ro: "Solzi acoperiți cu pietre" }, { bg: "Отваря се със скрита закопчалка", ro: "Se deschide cu o închizătoare ascunsă" }, { bg: "Смел акцент за всеки ден", ro: "Un accent îndrăzneț, de purtat zilnic" }],
    },
    extraSpecs: [STONES],
  },
};

// The "Материал" row in "Спецификации" on the women's pieces: hidden 20.11.2026, shown again 23.11.2026 (owner). false hides it.
const SHOW_MATERIAL_ROW = true;
// The "Покритие" row (gold pieces) is hidden the same way, code kept (owner, 21.11.2026). Set to true to show it again.
const SHOW_PLATING_ROW = false;
const materialSpecs = (metal: Metal, lang: "bg" | "ro"): ProductSpec[] =>
  allMaterialSpecs(metal, lang).filter(
    (r) =>
      (SHOW_MATERIAL_ROW || (r.label !== "Материал" && r.label !== "Material")) &&
      (SHOW_PLATING_ROW || (r.label !== "Покритие" && r.label !== "Placare")),
  );
// Material rows: the gold version uses the existing gold jewellery's wording word for word; the silver version claims only the steel.
const allMaterialSpecs = (metal: Metal, lang: "bg" | "ro"): ProductSpec[] =>
  metal === "gold"
    ? lang === "bg"
      // owner's wording, 23.11.2026
      ? [{ label: "Материал", value: "Неръждаема стомана 316L с 4 слоя PVD покритие 18к злато" }, { label: "Покритие", value: "4-слойно 18K PVD златно" }]
      : [{ label: "Material", value: "Oțel inoxidabil 316L cu 4 straturi de placare PVD aur 18K" }, { label: "Placare", value: "Aurie 18K PVD, în 4 straturi" }]
    // silver pieces: the steel only (no gold plating to claim), same word order as the gold row
    : lang === "bg"
      ? [{ label: "Материал", value: "Неръждаема стомана 316L" }]
      : [{ label: "Material", value: "Oțel inoxidabil 316L" }];

// "Детайли" under the bullets (ProductDetails): Метал · Вложка / Камъни · Дължина · Закопчаване · Артикул. A row with no value is
// hidden, so the pending answers (silver finish, stones, bangle sizes - owner) only need their value filled in here.
const METAL_ROW: Record<Metal, Lang> = {
  gold: { bg: "316L неръждаема стомана с 18K PVD покритие", ro: "Oțel inoxidabil 316L cu placare 18K PVD" }, // the old gold jewellery's wording
  silver: { bg: "316L неръждаема стомана", ro: "Oțel inoxidabil 316L" }, // finish pending (owner)
};
// Supplier's measurements (owner, 07.11.2026): the clover pieces only - Linea / Solaris / Spira have none yet (rows hidden).
const CLOVER: Record<CollectionKey, boolean> = { verdis: true, noctis: true, lumen: true, linea: false, solaris: false, spira: false };
const LENGTH_ROW: Record<PieceType, Lang> = {
  necklace: { bg: "38 cm + 6 cm удължител", ro: "38 cm + 6 cm prelungitor" },
  bracelet: { bg: "16,5 cm + 5 cm удължител", ro: "16,5 cm + 5 cm prelungitor" },
};
const CLOVER_SIZE_ROW: Partial<Record<PieceType, Lang>> = { bracelet: { bg: "1,3 cm", ro: "1,3 cm" } }; // necklace: not given yet
const CLOVER_CLASP: Lang = { bg: "Карабинер с удължител", ro: "Carabină cu prelungitor" };
const lengthOf = (key: CollectionKey, type: PieceType, lang: "bg" | "ro"): string => (CLOVER[key] ? LENGTH_ROW[type][lang] : "");

const CLASP_ROW: Partial<Record<CollectionKey, Lang>> = {
  verdis: CLOVER_CLASP,
  noctis: CLOVER_CLASP,
  lumen: CLOVER_CLASP,
  linea: { bg: "Скрита закопчалка", ro: "Închizătoare ascunsă" },
  solaris: { bg: "Скрита закопчалка", ro: "Închizătoare ascunsă" },
  spira: { bg: "Скрита закопчалка", ro: "Închizătoare ascunsă" },
};
function details(key: CollectionKey, type: PieceType, metal: Metal, skuCode: string, lang: "bg" | "ro"): ProductSpec[] {
  return [
    { label: lang === "bg" ? "Метал" : "Metal", value: METAL_ROW[metal][lang] },
    ...(TEXT[key].extraSpecs ?? []).map((s) => ({ label: s.label[lang], value: s.value?.[lang] ?? "" })), // Вложка / Камъни
    { label: lang === "bg" ? "Дължина" : "Lungime", value: lengthOf(key, type, lang) },
    { label: lang === "bg" ? "Размер на детелината" : "Dimensiunea trifoiului", value: CLOVER[key] ? (CLOVER_SIZE_ROW[type]?.[lang] ?? "") : "" },
    { label: lang === "bg" ? "Закопчаване" : "Închidere", value: CLASP_ROW[key]?.[lang] ?? "" },
    { label: lang === "bg" ? "Опаковка" : "Ambalaj", value: lang === "bg" ? "Масивна велурена кутия LORENZO RICCI" : "Cutie masivă din catifea LORENZO RICCI" },
    { label: lang === "bg" ? "Гаранция" : "Garanție", value: lang === "bg" ? "Доживотна" : "Pe viață" }, // same terms as the other jewellery (/warranty/jewelry)
    { label: lang === "bg" ? "Артикул" : "Cod produs", value: skuCode },
  ];
}


// ── Sizes per article (BG shop, owner 18.11.2026). ONE place: the "Спецификации" rows and the short size line under the piece's name
//    (ProductInfo) are both built from it. Only measured values go here - no guesses. A missing value hides its row; with nothing
//    known, the piece shows no size line. Source: the owner's size list of 18.11.2026 (the clover numbers are the supplier's
//    measurements of 07.11.2026). Linea / Solaris: measured by the owner, 18.11.2026. Spira has no numbers yet: "Стандартен дамски
//    размер" until the owner measures it.
//    Still missing (owner to give): see the comment on each line.
export type PieceSize = {
  lengthCm?: number;        // bracelet length / necklace chain length, without the extender
  extenderCm?: number;      // the extender on top of it
  widthMm?: number;         // bracelet width
  innerCm?: string;         // bangles (Linea / Solaris / Spira): the inside, e.g. "6 × 5"
  innerShape?: string;      // ... and its shape, e.g. "овал"
  wristCm?: string;         // bangles: the wrist they fit, e.g. "до ~16,5"
  cloverCm?: number;        // clover bracelets: the size of one clover
  pendantMm?: string;       // necklaces: the pendant, e.g. "15 × 15"
  sizeText?: string;        // a size in words (row "Размер" and the short line) while there are no numbers - the bangles
};
const CLOVER_BRACELET_SIZE: PieceSize = { lengthCm: 16.5, extenderCm: 5, cloverCm: 1.3 }; // missing: widthMm
const CLOVER_NECKLACE_SIZE: PieceSize = { lengthCm: 38, extenderCm: 6 };                  // missing: pendantMm
const NAIL_BANGLE_SIZE: PieceSize = { innerCm: "6 × 5", innerShape: "овал", wristCm: "до ~16,5" }; // Linea = Solaris; missing: widthMm
const BANGLE_SIZE_UNKNOWN: PieceSize = { sizeText: "Стандартен дамски размер" };         // Spira - missing: innerCm, wristCm, widthMm
export const COLLECTION_SIZES: Record<string, PieceSize> = {
  "GR-VERDIS-G": CLOVER_BRACELET_SIZE, "GR-VERDIS-S": CLOVER_BRACELET_SIZE,
  "GR-NOCTIS-G": CLOVER_BRACELET_SIZE, "GR-NOCTIS-S": CLOVER_BRACELET_SIZE,
  "GR-LUMEN-G": CLOVER_BRACELET_SIZE, "GR-LUMEN-S": CLOVER_BRACELET_SIZE,
  "KO-VERDIS-G": CLOVER_NECKLACE_SIZE, "KO-VERDIS-S": CLOVER_NECKLACE_SIZE,
  "KO-NOCTIS-G": CLOVER_NECKLACE_SIZE, "KO-NOCTIS-S": CLOVER_NECKLACE_SIZE,
  "KO-LUMEN-G": CLOVER_NECKLACE_SIZE, "KO-LUMEN-S": CLOVER_NECKLACE_SIZE,
  "GR-LINEA-G": NAIL_BANGLE_SIZE, "GR-LINEA-S": NAIL_BANGLE_SIZE,
  "GR-SOLARIS-G": NAIL_BANGLE_SIZE, "GR-SOLARIS-S": NAIL_BANGLE_SIZE,
  "GR-SPIRA-G": BANGLE_SIZE_UNKNOWN, "GR-SPIRA-S": BANGLE_SIZE_UNKNOWN,
};

const num = (n: number) => String(n).replace(".", ","); // 16.5 -> "16,5"
/** "Спецификации" size rows (BG), in the order they follow Материал / Покритие. */
function sizeRowsBg(type: PieceType, bangle: boolean, s: PieceSize): ProductSpec[] {
  // "16,5 см + 5 см удължител (регулира се от 16,5 до 21,5 см)" (owner, 18.11.2026)
  const len = s.lengthCm === undefined ? ""
    : s.extenderCm
      ? `${num(s.lengthCm)} см + ${num(s.extenderCm)} см удължител (регулира се от ${num(s.lengthCm)} до ${num(s.lengthCm + s.extenderCm)} см)`
      : `${num(s.lengthCm)} см`;
  if (type === "necklace") {
    return [
      { label: "Дължина на верижката", value: len },
      { label: "Размер на висулката", value: s.pendantMm ? `${s.pendantMm} мм` : "" },
    ];
  }
  return [
    ...(bangle
      ? [
          { label: "Размер", value: s.sizeText ?? "" },
          { label: "Вътрешен размер", value: s.innerCm ? `${s.innerCm} см${s.innerShape ? ` (${s.innerShape})` : ""}` : "" }, // "6 × 5 см (овал)"
          { label: "Подходяща за китка", value: s.wristCm ? `${s.wristCm} см` : "" },                                     // "до ~16,5 см"
        ]
      : [{ label: "Дължина", value: len }]),
    { label: "Ширина", value: s.widthMm !== undefined ? `${num(s.widthMm)} мм` : "" },
    { label: "Размер на детелината", value: s.cloverCm !== undefined ? `${num(s.cloverCm)} см` : "" },
  ];
}
/** The short line under the piece's name (owner's wording, 18.11.2026): "Регулируема 16,5–21,5 см", "Верижка 38–44 см, регулируема",
 *  "Стандартен дамски размер"; "" when nothing is known. */
export function sizeLineBg(type: PieceType, bangle: boolean, s: PieceSize): string {
  const to = s.lengthCm !== undefined && s.extenderCm ? `${num(s.lengthCm)}–${num(s.lengthCm + s.extenderCm)} см` : null;
  const plain = s.lengthCm !== undefined ? `${num(s.lengthCm)} см` : "";
  if (type === "necklace") return [to ? `Верижка ${to}, регулируема` : plain && `Верижка ${plain}`, s.pendantMm && `висулка ${s.pendantMm} мм`].filter(Boolean).join(" · ");
  if (bangle) {
    // "Вътрешен овал 6 × 5 см, за китка до ~16,5 см" (owner, 18.11.2026)
    const nums = [
      s.innerCm && `Вътрешен ${s.innerShape ?? "размер"} ${s.innerCm} см`,
      s.wristCm && `за китка ${s.wristCm} см`,
    ].filter(Boolean).join(", ");
    return nums || s.sizeText || "";
  }
  return to ? `Регулируема ${to}` : plain && `Дължина ${plain}`;
}

// BG "Спецификации": Материал, Покритие, then the size rows, then the rest; Опаковка and Гаранция last (the page shows those two once
// under both pieces of the 1+1 - ProductInfo COMMON_SPEC_LABELS). Empty rows are hidden by the tab.
function specsBg(key: CollectionKey, type: PieceType, metal: Metal, skuCode: string): ProductSpec[] {
  const bangle = COLLECTION_DESIGNS_KIND[key] === "bangle";
  const d = details(key, type, metal, skuCode, "bg");
  const row = (label: string) => d.filter((r) => r.label === label);
  return [
    ...materialSpecs(metal, "bg"),
    ...sizeRowsBg(type, bangle, COLLECTION_SIZES[skuCode] ?? {}),
    ...(TEXT[key].extraSpecs ?? []).map((s) => ({ label: s.label.bg, value: s.value?.bg ?? "" })), // Вложка / Камъни
    ...row("Закопчаване"),
    { label: "Пол", value: "Дамски" },
    { label: "Цвят", value: COLOR[metal].bg },
    ...row("Артикул"),
    ...row("Опаковка"),
    ...row("Гаранция"),
  ];
}
const COLLECTION_DESIGNS_KIND: Record<CollectionKey, "clover" | "bangle"> = Object.fromEntries(
  COLLECTION_PIECES.map((p) => [p.design.key, p.design.kind]),
) as Record<CollectionKey, "clover" | "bangle">;

function specs(key: CollectionKey, type: PieceType, metal: Metal, skuCode: string, lang: "bg" | "ro"): ProductSpec[] {
  // "Спецификации" tab = the specs and the former "Детайли" rows in one list, no duplicates: "Метал" says the same as "Материал"
  // (same value), and Вложка / Камъни / Дължина are in both - each shown once. A row with no value stays hidden (the tab skips it).
  const rows: ProductSpec[] = [
    ...materialSpecs(metal, lang),
    ...details(key, type, metal, skuCode, lang).filter((r) => r.label !== "Метал" && r.label !== "Metal" && r.label !== "Артикул" && r.label !== "Cod produs" && r.label !== "Гаранция" && r.label !== "Garanție"),
    { label: lang === "bg" ? "Пол" : "Gen", value: lang === "bg" ? "Дамски" : "Damă" },
    { label: lang === "bg" ? "Цвят" : "Culoare", value: COLOR[metal][lang] },
    ...details(key, type, metal, skuCode, lang).filter((r) => r.label === "Гаранция" || r.label === "Garanție" || r.label === "Артикул" || r.label === "Cod produs"),
  ];
  return rows.filter((r, i) => rows.findIndex((x) => x.label === r.label) === i);
}

const sku = (type: PieceType, key: CollectionKey, metal: Metal) =>
  `${type === "necklace" ? "KO" : "GR"}-${key.toUpperCase()}-${metal === "gold" ? "G" : "S"}`;

const fill = (s: string, metal: Metal, lang: "bg" | "ro", type: PieceType = "necklace") =>
  s.replace("{metal}", lang === "bg" && type === "bracelet" ? BRACELET_METAL_COLOUR[metal] : METAL_WORD[metal][lang]);

export const NEW_COLLECTION_PRODUCTS: Product[] = COLLECTION_PIECES.map(({ slug, design, type, metal, price }) => {
  const t = TEXT[design.key];
  const name = type === "bracelet"
    ? `${TYPE_NAME[type].bg} ${design.name} ${BRACELET_METAL_NAME[metal]}`
    : `${TYPE_NAME[type].bg} ${design.name} – ${METAL_NAME[metal].bg}`;
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
    description: fill(t.description[type].bg, metal, "bg", type),
    features: t.features[type].map((f) => f.bg),
    specs: specsBg(design.key, type, metal, sku(type, design.key, metal)), // incl. the former "Детайли" rows + the sizes
    sizeLine: sizeLineBg(type, design.kind === "bangle", COLLECTION_SIZES[sku(type, design.key, metal)] ?? {}),
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
  details: ProductSpec[];
  deliveryNote: string;
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
      specs: specs(design.key, type, metal, sku(type, design.key, metal), "ro"),
      details: [], // merged into specs ("Specificații")
      deliveryNote: "", // the box is said under the price
      warranty: "Garanție pe viață",
      coverAlt: `${name} Lorenzo Ricci`,
      imageAlts: photos(slug, type, design.key, metal, `${name} Lorenzo Ricci`, "ro").map((i) => i.alt),
    }];
  }),
);
