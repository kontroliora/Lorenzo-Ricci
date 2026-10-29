// Romanian product texts for the Romania market test (the whole catalogue: watches, jewellery, crocodile leather goods).
// Source of truth is the Bulgarian catalogue in lib/products.ts: every entry mirrors its structure exactly (same number
// of features / specs / tabDescription paragraphs / descriptionSections / imageAlts) and only translates the wording.
// Names, SKUs, prices, stock and image paths are NOT here: they stay in lib/products.ts. Species names are Latin and kept
// verbatim (they come from the CITES permits). Prices and sale amounts are not part of any text (the RO site shows lei).

import type { Product } from "../types";

export type RoProductText = Partial<Pick<Product, "shortDescription" | "description" | "tabDescription" | "descriptionSections" | "materialNote" | "crocodileSpecies" | "specs" | "features" | "badge" | "warranty" | "commercial_warranty_text">> & {
  /** Alt text of images[i], same order and length as the Bulgarian `images` array (SEO). */
  imageAlts?: string[];
  /** Alt text of coverImage. */
  coverAlt?: string;
};

type Spec = Product["specs"][number];

// ─── Shared wording ──────────────────────────────────────────────────────────

const SIAMESE = "crocodil siamez (Crocodylus siamensis)";
const NILE = "crocodil de Nil (Crocodylus niloticus)";

const BADGE_LIMITED = "SERIE LIMITATĂ";
const BADGE_SALE = "REDUCERE DE TOAMNĂ";
const BADGE_EARLY_BF = "BLACK FRIDAY TIMPURIU";
const BADGE_NEW = "Colecție nouă";
const BADGE_SOLD_OUT = "Stoc epuizat";
const BADGE_LOW_STOCK = "Stoc limitat";

const WARRANTY_WATCH = "Garanție comercială 5 ani";
const WARRANTY_LIFETIME = "Garanție pe viață"; // jewellery: lifetime warranty, as in the Bulgarian catalogue
const WARRANTY_NONE = ""; // leather goods: no warranty is offered (same as the Bulgarian catalogue)

const WATCH_TAGLINE = "Design italian. Precizie japoneză.";

// Yachting collection (3 dial colours of one design)
const YACHTING_FEATURES = [
  "Serie limitată de 100 de bucăți - după epuizare nu va mai fi produsă din nou",
  "Sticlă safir",
  "Mecanism quartz japonez de înaltă precizie",
  "Curea din cauciuc cu textură în relief",
  "Indexuri și ace luminiscente",
  "Rezistență la apă până la 50 de metri",
];

const YACHTING_SPECS: Spec[] = [
  { label: "Dimensiuni", value: "44 mm × 53,7 mm × 12,8 mm" },
  { label: "Greutate", value: "" }, // empty -> row hidden until the owner gives the weight (as in the Bulgarian catalogue)
  { label: "Sticlă", value: "Sticlă safir" },
  { label: "Mecanism", value: "Mecanism quartz japonez" },
  { label: "Curea", value: "Cauciuc cu textură în relief" },
  { label: "Rezistență la apă", value: "Până la 50 de metri" },
];

// Chronograph collection (Chrono Black, Golden Eclipse, Polar Frost)
const CHRONO_FEATURES = [
  "Final de serie - ultimele bucăți disponibile",
  "Sticlă safir - claritate excepțională și protecție împotriva zgârieturilor",
  "Mecanism quartz japonez - precis și fiabil",
  "Rezistență la apă 5 ATM / 50 m",
  "Oțel inoxidabil 316L - hipoalergenic, nu ruginește",
  "Cronograf cu cadran multifuncțional",
  "Curea din silicon hipoalergenic, respirabilă",
];

const CHRONO_SPECS: Spec[] = [
  { label: "Carcasă", value: "Oțel inoxidabil premium 316L" },
  { label: "Dimensiuni", value: "43 mm × 50 mm × 16 mm" },
  { label: "Sticlă", value: "Sticlă safir" },
  { label: "Mecanism", value: "Cronograf quartz japonez" },
  { label: "Cadran", value: "Parțial scheletat, multistrat" },
  { label: "Curea", value: "Silicon hipoalergenic" },
  { label: "Rezistență la apă", value: "5 ATM / 50 m" },
];

// Jewellery (bracelets and necklaces: same material, plating, hallmark and colour rows in the Bulgarian catalogue)
const JEWELLERY_MATERIAL: Spec = { label: "Material", value: "Oțel inoxidabil 316L cu placare 18K PVD" };
const JEWELLERY_PLATING: Spec = { label: "Placare", value: "Aurie 18K PVD, în 4 straturi" };
const JEWELLERY_STAMP: Spec = { label: "Marcaj", value: "750 IT" };
const JEWELLERY_GENDER: Spec = { label: "Gen", value: "Unisex" };
const JEWELLERY_COLOR: Spec = { label: "Culoare", value: "Auriu" };

// Leather goods
const LEATHER_DESC =
  "Fiecare piesă din linia Lorenzo Ricci este o expresie a luxului fără compromisuri. Îmbinăm eleganța brută a pielii autentice de crocodil siamez (Crocodylus siamensis) cu funcționalitate urbană precisă, pentru cei care apreciază o individualitate sobră.";

const LEATHER_NOTE =
  "Realizat din piele autentică de crocodil. Deoarece fiecare piele este unică, desenul și textura pot diferi ușor față de cele din fotografii - este o caracteristică naturală a pielii autentice de crocodil și conferă fiecărei piese un caracter inconfundabil.";

const CLUTCH_DESC =
  "Fiecare piesă din linia Lorenzo Ricci este o expresie a luxului fără compromisuri. Clutch-ul îmbină funcționalitatea urbană compactă cu textura autentică a pielii de crocodil - un accesoriu de seară care nu are nevoie de nimic în afară de el însuși.";

const LEATHER_FEATURES_CITES = [
  "100% piele naturală de crocodil",
  "Origine certificată CITES nr.: 25VN4174/S",
  "Confecționat manual - fiecare piesă este unică",
];

const LEATHER_FEATURES = [
  "100% piele naturală de crocodil",
  "Confecționat manual - fiecare piesă este unică",
];

const CLUTCH_FEATURES = [
  "Serie limitată - după epuizare nu va mai fi produsă din nou",
  "100% piele naturală de crocodil",
  "Fâșie în relief din plăcuțe osoase naturale, specifică zonei dorsale a pielii",
  "Fermoar metalic cu glisare lină, integrat discret în silueta clutch-ului",
  "Compartiment principal și buzunar interior, gândite pentru a găzdui strictul necesar",
  "Format compact pentru seară",
];

/** Wallet / first four cardholders: carry the CITES permit number (as in the Bulgarian catalogue). */
const specsWithCites = (color: string): Spec[] => [
  { label: "Material", value: "100% Piele de crocodil" },
  { label: "Specie", value: SIAMESE },
  { label: "CITES nr.", value: "25VN4174/S" },
  { label: "Confecționare", value: "Manuală" },
  { label: "Culoare", value: color },
];

/** New cardholders and clutches: no CITES number, empty "Dimensiuni" (row hidden until real measurements exist). */
const specsNoCites = (color: string): Spec[] => [
  { label: "Material", value: "100% Piele de crocodil" },
  { label: "Specie", value: SIAMESE },
  { label: "Confecționare", value: "Manuală" },
  { label: "Culoare", value: color },
  { label: "Dimensiuni", value: "" },
];

// ─── Products ────────────────────────────────────────────────────────────────

export const RO_PRODUCTS: Record<string, RoProductText> = {
  // ─── WATCHES ───────────────────────────────────────────────────────────────
  "yachting-black": {
    badge: BADGE_EARLY_BF,
    warranty: WARRANTY_WATCH,
    shortDescription: WATCH_TAGLINE,
    description:
      "Yachting Black este conceput în jurul unei prezențe monocrome expresive, în care carcasa neagră, cadranul și cureaua din cauciuc creează un aspect unitar, echilibrat cu precizie.",
    tabDescription: [
      "Yachting Black este conceput în jurul unei prezențe monocrome expresive, în care carcasa neagră, cadranul și cureaua din cauciuc creează un aspect unitar, echilibrat cu precizie.",
      "Pe cadran, roza busolei și scala în grade conferă un accent nautic distinctiv, fără a afecta compoziția sa curată. Textura în relief a curelei din cauciuc completează caracterul sport al modelului și asigură o potrivire fermă și confortabilă pe încheietura mâinii.",
      "În întuneric, indexurile și acele luminiscente evidențiază funcționalitatea ceasului și îi păstrează aspectul clar și după lăsarea nopții.",
      "Modelul este finalizat cu o busolă YACHTING gravată pe spatele carcasei și este prezentat într-o rolă de lux din piele pentru ceas.",
    ],
    features: YACHTING_FEATURES,
    specs: YACHTING_SPECS,
    coverAlt: "Ceas de lux Lorenzo Ricci Yachting Black - cadran cu busolă, sticlă safir",
    imageAlts: [
      "Lorenzo Ricci Yachting Black - vedere frontală, roza busolei și scala în grade",
      "Lorenzo Ricci Yachting Black în modul de noapte - indexuri și ace luminiscente",
      "Lorenzo Ricci Yachting Black la încheietura mâinii - imagine lifestyle, serie limitată",
      "Lorenzo Ricci Yachting Black - vedere laterală, serie limitată",
      "Lorenzo Ricci Yachting Black - spatele carcasei, busolă YACHTING gravată",
      "Lorenzo Ricci Yachting Black într-o cutie de călătorie de lux",
      "Lorenzo Ricci Yachting Black - cutie de călătorie de lux, alt unghi",
    ],
  },
  "yachting-blue": {
    badge: BADGE_EARLY_BF,
    warranty: WARRANTY_WATCH,
    shortDescription: WATCH_TAGLINE,
    description:
      "Cadranul albastru profund conferă ceasului o adâncime vizuală distinctivă, accentuată de contrastul cu carcasa neagră și cu cureaua albastră din cauciuc. Textura ei în relief urmărește linia încheieturii mâinii și îmbină o înfățișare sport cu un design finisat cu precizie.",
    tabDescription: [
      "Cadranul albastru profund conferă ceasului o adâncime vizuală distinctivă, accentuată de contrastul cu carcasa neagră și cu cureaua albastră din cauciuc. Textura ei în relief urmărește linia încheieturii mâinii și îmbină o înfățișare sport cu un design finisat cu precizie.",
      "În întuneric, indexurile și acele se remarcă printr-o luminiscență pronunțată, care păstrează lizibilitatea cadranului fără a-i afecta compoziția curată.",
      "Ceasul este prezentat într-o rolă de lux din piele pentru ceas, creată pentru păstrare și transport cu atenția cuvenită fiecărui detaliu.",
    ],
    features: YACHTING_FEATURES,
    specs: YACHTING_SPECS,
    coverAlt: "Ceas de lux Lorenzo Ricci Yachting Blue - albastru, cadran cu busolă, sticlă safir",
    imageAlts: [
      "Lorenzo Ricci Yachting Blue - vedere frontală, roza busolei și scala în grade",
      "Lorenzo Ricci Yachting Blue în modul de noapte - indexuri și ace luminiscente",
      "Lorenzo Ricci Yachting Blue la încheietura mâinii - imagine lifestyle, serie limitată",
      "Lorenzo Ricci Yachting Blue - vedere laterală, serie limitată",
      "Lorenzo Ricci Yachting Blue - spatele carcasei, busolă YACHTING gravată",
      "Lorenzo Ricci Yachting Blue într-o rolă de lux din piele pentru ceas",
      "Lorenzo Ricci Yachting Blue - închizătoare, detaliu al curelei din cauciuc",
    ],
  },
  "yachting-white": {
    badge: BADGE_EARLY_BF,
    warranty: WARRANTY_WATCH,
    shortDescription: WATCH_TAGLINE,
    description:
      "Yachting White reinterpretează estetica marină într-o compoziție mai luminoasă și mai grafică, construită în jurul unui finisaj alb curat, cu un accent negru contrastant pe curea.",
    tabDescription: [
      "Yachting White reinterpretează estetica marină într-o compoziție mai luminoasă și mai grafică, construită în jurul unui finisaj alb curat, cu un accent negru contrastant pe curea.",
      "Roza busolei și scala în grade conturează aspectul distinctiv al cadranului, iar cureaua din cauciuc în relief urmărește linia încheieturii mâinii cu o potrivire moale și fermă. Contrastul dintre alb și negru conferă modelului o prezență clară, fără greutate vizuală inutilă.",
      "Indexurile și acele luminiscente asigură lizibilitate în condiții de lumină slabă și completează caracterul funcțional al ceasului.",
      "Pe spatele carcasei se află o busolă YACHTING gravată, iar ceasul este oferit într-o rolă de lux din piele pentru ceas.",
    ],
    features: YACHTING_FEATURES,
    specs: YACHTING_SPECS,
    coverAlt: "Ceas de lux Lorenzo Ricci Yachting White - carcasă albă, cadran cu busolă, sticlă safir",
    imageAlts: [
      "Lorenzo Ricci Yachting White - vedere frontală, roza busolei și scala în grade",
      "Lorenzo Ricci Yachting White în modul de noapte - indexuri și ace luminiscente",
      "Lorenzo Ricci Yachting White la încheietura mâinii - imagine lifestyle, serie limitată",
      "Lorenzo Ricci Yachting White - vedere laterală, serie limitată",
      "Lorenzo Ricci Yachting White - spatele carcasei, busolă YACHTING gravată",
      "Lorenzo Ricci Yachting White într-o cutie de călătorie de lux",
      "Lorenzo Ricci Yachting White - închizătoare, detaliu al curelei din cauciuc",
    ],
  },
  "chrono-black": {
    badge: BADGE_EARLY_BF,
    warranty: WARRANTY_WATCH,
    shortDescription: WATCH_TAGLINE,
    description:
      "Chrono Black întruchipează forța nopții într-un cronograf cu linii curate. Carcasa din oțel inoxidabil premium 316L, cadranul multistrat parțial scheletat și sticla safir creează un ceas care exprimă caracter fără efort. Cureaua din silicon hipoalergenic oferă confort la purtare îndelungată.",
    tabDescription: [
      "Negru pe negru: carcasa, cadranul și cureaua într-o singură nuanță. Oțelul 316L rezistă la lovituri și coroziune, sticla safir la zgârieturi, iar cureaua din silicon rămâne confortabilă ore în șir.",
      "Arată la fel de bine sub o cămașă ca și cu un tricou, iar rezistența la apă 5 ATM suportă ploaia și înotul la suprafață. Ajunge într-o cutie de lux, cu 5 ani de garanție comercială.",
    ],
    features: CHRONO_FEATURES,
    specs: CHRONO_SPECS,
    coverAlt: "Cronograf de lux Lorenzo Ricci Chrono Black - vedere frontală, oțel 316L, sticlă safir",
    imageAlts: [
      "Lorenzo Ricci Chrono Black cronograf - vedere frontală, mecanism quartz japonez",
      "Lorenzo Ricci Chrono Black în modul de noapte - markeri luminiscenți lume, detaliu de cadran",
      "Lorenzo Ricci Chrono Black - fotografie lifestyle, ceas de lux pentru bărbați",
      "Lorenzo Ricci Chrono Black - spatele carcasei din oțel inoxidabil 316L",
      "Lorenzo Ricci Chrono Black - vedere laterală, rezistență la apă 5 ATM",
      "Lorenzo Ricci Chrono Black într-o cutie de lux - ambalaj cadou deschis",
      "Lorenzo Ricci Chrono Black - cutie cadou închisă",
      "Lorenzo Ricci Chrono Black - detaliu al cronografului, cadran scheletat",
    ],
  },
  "golden-eclipse": {
    badge: BADGE_EARLY_BF,
    warranty: WARRANTY_WATCH,
    shortDescription: WATCH_TAGLINE,
    description:
      "Golden Eclipse este o odă adusă soarelui - un cronograf magnific, creat pentru cei care își poartă succesul la încheietura mâinii. Carcasa aurită din oțel 316L, cadranul scheletat și sticla safir alcătuiesc o siluetă cu o prezență inconfundabilă. Design italian rafinat și execuție de maestru, în care fiecare detaliu contează.",
    tabDescription: [
      "Aurirea prinde lumina și o oglindește: un ceas care se observă primul. Baza este oțelul 316L într-o nuanță caldă, aurie, iar cadranul scheletat de sub sticla safir deschide o privire spre mecanică.",
      "Greutate pe care o simți la încheietura mâinii, curea din silicon pentru confort, rezistență la apă 5 ATM. Pentru cină, pentru fotografie, pentru întâlnire. Ajunge într-o cutie de lux, cu 5 ani de garanție comercială.",
    ],
    features: CHRONO_FEATURES,
    specs: CHRONO_SPECS,
    coverAlt: "Cronograf de lux Lorenzo Ricci Golden Eclipse - carcasă aurită, oțel 316L, sticlă safir",
    imageAlts: [
      "Lorenzo Ricci Golden Eclipse cronograf - vedere frontală, carcasă aurită 18K PVD",
      "Lorenzo Ricci Golden Eclipse în modul de noapte - markeri luminiscenți lume, cadran scheletat",
      "Lorenzo Ricci Golden Eclipse la mână - cronograf auriu, imagine lifestyle",
      "Lorenzo Ricci Golden Eclipse - fotografie lifestyle, design italian",
      "Lorenzo Ricci Golden Eclipse - detaliu al cadranului aurit 18K PVD",
      "Lorenzo Ricci Golden Eclipse - spatele carcasei, oțel inoxidabil 316L",
      "Lorenzo Ricci Golden Eclipse - vedere laterală, rezistență la apă 5 ATM",
      "Lorenzo Ricci Golden Eclipse - închizătoare, curea din silicon hipoalergenic",
      "Lorenzo Ricci Golden Eclipse într-o cutie de lux - ambalaj cadou deschis",
      "Lorenzo Ricci Golden Eclipse - cutie cadou închisă",
    ],
  },
  "polar-frost": {
    badge: BADGE_EARLY_BF,
    warranty: WARRANTY_WATCH,
    shortDescription: WATCH_TAGLINE,
    description:
      "Polar Frost poartă încrederea rece a albastrului arctic. Carcasa din oțel 316L, executată cu precizie, sticla safir și cronograful cu cadran multistrat fac din Polar Frost un ceas pentru oameni cu gusturi clare. Rezistență la apă 5 ATM - liniște pentru orice aventură.",
    tabDescription: [
      "Un albastru arctic care se schimbă odată cu lumina: vibrant la soare, profund în interior. Cadran multistrat, parțial scheletat, sub o sticlă safir rezistentă la zgârieturi, într-o carcasă din oțel 316L cu prezență.",
      "Cureaua din silicon stă confortabil, iar rezistența la apă 5 ATM suportă ploaia, transpirația și înotul la suprafață. Albastrul se asortează ușor: cu denim ziua, cu un sacou închis la culoare seara. Ajunge într-o cutie de lux, cu 5 ani de garanție comercială.",
    ],
    features: CHRONO_FEATURES,
    specs: CHRONO_SPECS,
    coverAlt: "Cronograf de lux Lorenzo Ricci Polar Frost - versiune albastru arctic, sticlă safir",
    imageAlts: [
      "Lorenzo Ricci Polar Frost cronograf - vedere frontală, albastru arctic",
      "Lorenzo Ricci Polar Frost în modul de noapte lume - markeri luminiscenți, design arctic",
      "Lorenzo Ricci Polar Frost - fotografie lifestyle, ceas de lux pentru bărbați",
      "Lorenzo Ricci Polar Frost - fotografie lifestyle, design italian",
      "Lorenzo Ricci Polar Frost - spatele carcasei, oțel inoxidabil 316L",
      "Lorenzo Ricci Polar Frost - vedere laterală, rezistență la apă 5 ATM",
      "Lorenzo Ricci Polar Frost - închizătoare, curea din silicon hipoalergenic",
      "Lorenzo Ricci Polar Frost într-o cutie de lux - ambalaj cadou deschis",
      "Lorenzo Ricci Polar Frost - cutie cadou închisă",
    ],
  },

  // ─── JEWELLERY ─────────────────────────────────────────────────────────────
  "bracelet-diamante-cross": {
    badge: BADGE_SALE,
    warranty: WARRANTY_LIFETIME,
    shortDescription: "Strălucire care nu îngreunează",
    description:
      "Crucea cu zirconiu prinde lumina la fiecare mișcare. Un detaliu fin, care strălucește fără să îngreuneze mâna. Subțire și ușoară, se potrivește la fel de bine pe o încheietură de femeie și pe una de bărbat. Poart-o singură sau lângă ceas. Strălucire, nu volum.",
    features: [
      "Cruce de cristal în centru",
      "Lanț tennis elegant",
      "Reglabilă 18-22 cm",
      "Design unisex",
    ],
    specs: [
      JEWELLERY_MATERIAL,
      { label: "Lungime", value: "18 + 4 cm (reglabilă)" },
      JEWELLERY_PLATING,
      JEWELLERY_STAMP,
      JEWELLERY_GENDER,
      JEWELLERY_COLOR,
    ],
    coverAlt: "Brățară Diamante Cross Lorenzo Ricci - placare cu aur 18K PVD, cruce cu zirconiu, oțel 316L",
    imageAlts: [
      "Brățară Diamante Cross Lorenzo Ricci - fotografie de produs pe fundal alb, aur 18K PVD",
      "Brățară Diamante Cross - detaliu al crucii cu zirconiu, brățară de lux",
      "Brățară Diamante Cross - fotografie lifestyle, purtată la încheietura mâinii",
      "Brățară Diamante Cross - vedere laterală, grosimea și detaliul închizătorii",
      "Brățară Diamante Cross în cutie cadou Lorenzo Ricci",
    ],
  },
  "bracelet-milano-forte": {
    warranty: WARRANTY_LIFETIME,
    shortDescription: "Opt milimetri de prezență",
    description:
      "Are o greutate pe care o simți la încheietură, de îndată ce închizătoarea face clic. Opt milimetri de împletitură care are prezență, fără să se impună. Alături de ceas capătă context, iar singură reține atenția. Aur 18K PVD consistent, fără compromisuri.",
    features: [
      "Împletitură masivă de 8 mm",
      "Greutate pronunțată",
      "Lungime 20 cm",
      "Execuție milaneză",
    ],
    specs: [
      JEWELLERY_MATERIAL,
      { label: "Lățime", value: "8 mm" },
      { label: "Lungime", value: "20 cm" },
      JEWELLERY_PLATING,
      JEWELLERY_STAMP,
      JEWELLERY_GENDER,
      JEWELLERY_COLOR,
    ],
    coverAlt: "Brățară Milano Forte Lorenzo Ricci - masivă 8 mm, placare cu aur 18K PVD, oțel 316L",
    imageAlts: [
      "Brățară Milano Forte Lorenzo Ricci - fotografie de produs pe fundal alb, aur 18K PVD",
      "Brățară Milano Forte - fotografie lifestyle, purtată la încheietura mâinii",
      "Brățară Milano Forte - detaliu al împletiturii, lățime 8 mm",
      "Brățară Milano Forte - detaliu al închizătorii, marcaj 750 IT",
      "Brățară Milano Forte în cutie cadou Lorenzo Ricci",
    ],
  },
  "bracelet-milano-twist": {
    warranty: WARRANTY_LIFETIME,
    shortDescription: "Spirală de lumină",
    description:
      "Împletitura răsucită refractă lumina într-o spirală la fiecare mișcare. Mai fină decât modelele masive, dar cu același caracter auriu. Se poartă singură sau în combinație cu altele. Șase milimetri de strălucire reținută.",
    features: [
      "Împletitură răsucită de 6 mm",
      "Joc fluid al luminii",
      "Lungime 22 cm",
      "Eleganță de zi cu zi",
    ],
    specs: [
      JEWELLERY_MATERIAL,
      { label: "Grosime", value: "6 mm" },
      { label: "Lungime", value: "22 cm" },
      JEWELLERY_PLATING,
      JEWELLERY_STAMP,
      JEWELLERY_GENDER,
      JEWELLERY_COLOR,
    ],
    coverAlt: "Brățară Milano Twist Lorenzo Ricci - împletitură răsucită, placare cu aur 18K PVD, oțel 316L",
    imageAlts: [
      "Brățară Milano Twist Lorenzo Ricci - fotografie de produs pe fundal alb, aur 18K PVD",
      "Brățară Milano Twist - fotografie lifestyle, purtată la încheietura mâinii",
      "Brățară Milano Twist - detaliu al împletiturii răsucite, design italian",
      "Brățară Milano Twist - detaliu al închizătorii, marcaj 750 IT",
      "Brățară Milano Twist în cutie cadou Lorenzo Ricci",
    ],
  },
  "bracelet-signature": {
    warranty: WARRANTY_LIFETIME,
    shortDescription: "Semnătura ta la încheietură",
    description:
      "Brățara care rămâne la încheietură. Închizătoarea T se închide cu un clic sigur, cei șase milimetri se așază curat sub mânecă și arată la fel de sigur și cu o cămașă, și cu un tricou. Un însoțitor de zi cu zi, care nu se scoate.",
    features: [
      "Împletitură curb de 6 mm",
      "Pandantiv cruce ca accent",
      "Închizătoare T",
      "Lungime 22 cm",
    ],
    specs: [
      JEWELLERY_MATERIAL,
      { label: "Lățime", value: "6 mm" },
      { label: "Lungime", value: "22 cm" },
      JEWELLERY_PLATING,
      JEWELLERY_STAMP,
      JEWELLERY_GENDER,
      JEWELLERY_COLOR,
    ],
    coverAlt: "Brățară Signature Lorenzo Ricci - clasică 6 mm, placare cu aur 18K PVD, oțel 316L",
    imageAlts: [
      "Brățară Signature Lorenzo Ricci - fotografie de produs pe fundal alb, aur 18K PVD",
      "Brățară Signature - fotografie lifestyle, purtată la încheietura mâinii",
      "Brățară Signature - detaliu al împletiturii, lățime 6 mm",
      "Brățară Signature - detaliu al închizătorii, marcaj 750 IT",
      "Brățară Signature în cutie cadou Lorenzo Ricci",
    ],
  },
  "necklace-aurelius": {
    badge: BADGE_LOW_STOCK,
    warranty: WARRANTY_LIFETIME,
    shortDescription: "Spiritul Romei eterne",
    description:
      "O cruce cu proporții măsurate și geometrie calmă, inspirată de tradiția antică. Un lanț de trei milimetri poartă greutatea cu ușurință și rămâne discret sub guler. Un simbol care vorbește încet, dar cu o convingere clară.",
    features: [
      "Cruce de 3,7 cm, cu proporții curate",
      "Lănțișor de 3 mm",
      "Lungime 60 cm",
      "Siluetă unisex",
    ],
    specs: [
      JEWELLERY_MATERIAL,
      { label: "Dimensiunea crucii", value: "3,7 × 2 cm" },
      { label: "Grosime", value: "3 mm" },
      { label: "Lungime", value: "60 cm" },
      JEWELLERY_PLATING,
      JEWELLERY_STAMP,
      JEWELLERY_GENDER,
      JEWELLERY_COLOR,
    ],
    coverAlt: "Colier Aurelius Cross Lorenzo Ricci - placare cu aur 18K PVD, cruce 3,7×2 cm, oțel 316L",
    imageAlts: [
      "Colier Aurelius Cross Lorenzo Ricci - fotografie de produs pe fundal alb, aur 18K PVD",
      "Colier Aurelius Cross - detaliu al crucii, dimensiuni 3,7×2 cm, grosime 3 mm",
      "Colier Aurelius Cross - fotografie lifestyle, purtat la gât",
      "Colier Aurelius Cross - detaliu al lănțișorului, lungime 60 cm",
      "Colier Aurelius Cross - detaliu al carabinei, marcaj 750 IT",
      "Colier Aurelius Cross în cutie cadou Lorenzo Ricci",
    ],
  },
  "necklace-grande-imperiale": {
    badge: BADGE_SALE,
    warranty: WARRANTY_LIFETIME,
    shortDescription: "Intră înaintea ta",
    description:
      "O cruce de opt centimetri și jumătate, cu o formă impunătoare, dar stăpânită. Grande Imperiale poartă amploare fără ostentație, iar liniile curate transformă volumul în demnitate. Pentru cel care preferă să lase prezența să vorbească în locul lui.",
    features: [
      "Cruce impunătoare de 8,5 cm",
      "Lanț de 3 mm",
      "Lungime 60 cm",
      "Accent expresiv",
    ],
    specs: [
      JEWELLERY_MATERIAL,
      { label: "Dimensiunea crucii", value: "8,5 × 5 cm" },
      { label: "Lățimea lănțișorului", value: "3 mm" },
      { label: "Lungime", value: "60 cm" },
      JEWELLERY_PLATING,
      JEWELLERY_STAMP,
      JEWELLERY_COLOR,
    ],
    coverAlt: "Colier Grande Imperiale Lorenzo Ricci - cruce masivă 8,5×5 cm, placare cu aur 18K PVD, oțel 316L",
    imageAlts: [
      "Colier Grande Imperiale Lorenzo Ricci - fotografie de produs pe fundal alb, aur 18K PVD",
      "Colier Grande Imperiale - detaliu al crucii masive, dimensiuni 8,5×5 cm",
      "Colier Grande Imperiale - fotografie lifestyle, purtat la gât",
      "Colier Grande Imperiale - detaliu al lănțișorului de 3 mm, lungime 60 cm",
      "Colier Grande Imperiale în cutie cadou Lorenzo Ricci",
    ],
  },
  "necklace-milano-forte": {
    warranty: WARRANTY_LIFETIME,
    shortDescription: "Greutatea Milanului",
    description:
      "O împletitură milaneză compactă, de opt milimetri lățime, cu o greutate perceptibilă care se simte la fiecare mișcare. Lanțul își păstrează forma și caracterul fără compromisuri. O prezență încrezătoare, care nu are nevoie de explicații.",
    features: [
      "Lanț compact de 8 mm",
      "Greutate pronunțată",
      "Lungime 55 cm",
      "Împletitură milaneză",
    ],
    specs: [
      JEWELLERY_MATERIAL,
      { label: "Lățime", value: "8 mm" },
      { label: "Lungime", value: "55 cm" },
      JEWELLERY_PLATING,
      JEWELLERY_STAMP,
      JEWELLERY_COLOR,
    ],
    coverAlt: "Colier Milano Forte Lorenzo Ricci - lănțișor împletit masiv, placare cu aur 18K PVD, oțel 316L",
    imageAlts: [
      "Colier Milano Forte Lorenzo Ricci - fotografie de produs pe fundal alb, aur 18K PVD",
      "Colier Milano Forte - fotografie lifestyle, purtat la gât",
      "Colier Milano Forte - detaliu al lănțișorului împletit masiv",
      "Colier Milano Forte - detaliu al carabinei, marcaj 750 IT",
      "Colier Milano Forte în cutie cadou Lorenzo Ricci",
    ],
  },
  "necklace-milano-twist": {
    badge: BADGE_SALE,
    warranty: WARRANTY_LIFETIME,
    shortDescription: "Funie de aur",
    description:
      "Un lanț răsucit, a cărui împletitură în spirală prinde și refractă lumina în mișcare. Mai fin decât modelele masive, dar cu aceeași profunzime a aurului. Se poartă singur sau ca bază pentru un pandantiv ales.",
    features: [
      "Lanț răsucit de 6 mm",
      "Joc fluid al luminii",
      "Lungime 55 cm",
      "Singur sau cu pandantiv",
    ],
    specs: [
      JEWELLERY_MATERIAL,
      { label: "Lățime", value: "6 mm" },
      { label: "Lungime", value: "55 cm" },
      JEWELLERY_PLATING,
      JEWELLERY_STAMP,
      JEWELLERY_COLOR,
    ],
    coverAlt: "Colier Milano Twist Lorenzo Ricci - lănțișor răsucit de 6 mm, placare cu aur 18K PVD, oțel 316L",
    imageAlts: [
      "Colier Milano Twist Lorenzo Ricci - fotografie de produs pe fundal alb, aur 18K PVD",
      "Colier Milano Twist - fotografie lifestyle, purtat la gât",
      "Colier Milano Twist - detaliu al lănțișorului răsucit, lățime 6 mm",
      "Colier Milano Twist - detaliu al carabinei, lungime 55 cm",
      "Colier Milano Twist - prim-plan al împletiturii, marcaj 750 IT",
      "Colier Milano Twist în cutie cadou Lorenzo Ricci",
    ],
  },

  // ─── WALLETS ───────────────────────────────────────────────────────────────
  "wallet-alabastro": {
    badge: BADGE_EARLY_BF,
    warranty: WARRANTY_NONE,
    shortDescription: "Portofel alb din piele de crocodil",
    description: LEATHER_DESC,
    materialNote: LEATHER_NOTE,
    crocodileSpecies: SIAMESE,
    features: LEATHER_FEATURES_CITES,
    specs: specsWithCites("Alb (Alabastro)"),
    coverAlt: "Portofel alb din piele de crocodil Lorenzo Ricci Alabastro - vedere frontală",
    imageAlts: [
      "Portofel alb din piele de crocodil Lorenzo Ricci Alabastro - fotografie de produs",
      "Lorenzo Ricci Alabastro - detaliu al texturii de crocodil",
      "Lorenzo Ricci Alabastro - portofel deschis, interior cu buzunare pentru carduri",
      "Lorenzo Ricci Alabastro - detaliu al execuției manuale, cusături precise",
      "Lorenzo Ricci Alabastro într-o cutie de lux cu Certificat de autenticitate CITES",
    ],
  },
  "wallet-rubino": {
    badge: BADGE_EARLY_BF,
    warranty: WARRANTY_NONE,
    shortDescription: "Portofel roșu din piele de crocodil",
    description: LEATHER_DESC,
    materialNote: LEATHER_NOTE,
    crocodileSpecies: SIAMESE,
    features: LEATHER_FEATURES_CITES,
    specs: specsWithCites("Roșu rubiniu (Rubino)"),
    coverAlt: "Portofel roșu din piele de crocodil Lorenzo Ricci Rubino - vedere frontală",
    imageAlts: [
      "Portofel roșu din piele de crocodil Lorenzo Ricci Rubino - fotografie de produs",
      "Lorenzo Ricci Rubino - detaliu al texturii de crocodil, roșu rubiniu",
      "Lorenzo Ricci Rubino - portofel deschis, interior cu buzunare pentru carduri",
      "Lorenzo Ricci Rubino - detaliu al execuției manuale, cusături precise",
      "Lorenzo Ricci Rubino într-o cutie de lux cu Certificat de autenticitate CITES",
    ],
  },
  "wallet-smeraldo": {
    badge: BADGE_SOLD_OUT,
    warranty: WARRANTY_NONE,
    shortDescription: "Portofel verde din piele de crocodil",
    description: LEATHER_DESC,
    materialNote: LEATHER_NOTE,
    crocodileSpecies: SIAMESE,
    features: LEATHER_FEATURES_CITES,
    specs: specsWithCites("Verde smarald (Smeraldo)"),
    coverAlt: "Portofel verde din piele de crocodil Lorenzo Ricci Smeraldo - vedere frontală",
    imageAlts: [
      "Portofel verde din piele de crocodil Lorenzo Ricci Smeraldo - fotografie de produs",
      "Lorenzo Ricci Smeraldo - detaliu al texturii de crocodil, verde smarald",
      "Lorenzo Ricci Smeraldo - portofel deschis, interior cu buzunare pentru carduri",
      "Lorenzo Ricci Smeraldo - detaliu al execuției manuale, cusături precise",
      "Lorenzo Ricci Smeraldo într-o cutie de lux cu Certificat de autenticitate CITES",
    ],
  },

  // ─── CARDHOLDERS ───────────────────────────────────────────────────────────
  "cardholder-ambra": {
    badge: BADGE_EARLY_BF,
    warranty: WARRANTY_NONE,
    shortDescription: "Port-card portocaliu din piele de crocodil",
    description: LEATHER_DESC,
    materialNote: LEATHER_NOTE,
    crocodileSpecies: SIAMESE,
    features: LEATHER_FEATURES_CITES,
    specs: specsWithCites("Portocaliu chihlimbar (Ambra)"),
    coverAlt: "Port-card portocaliu din piele de crocodil Lorenzo Ricci Ambra - vedere frontală",
    imageAlts: [
      "Port-card portocaliu din piele de crocodil Lorenzo Ricci Ambra - fotografie de produs",
      "Lorenzo Ricci Ambra - detaliu al texturii de crocodil, portocaliu chihlimbar",
      "Lorenzo Ricci Ambra port-card - fotografie lifestyle, utilizare zilnică",
      "Lorenzo Ricci Ambra într-o cutie de lux cu Certificat de autenticitate CITES",
    ],
  },
  "cardholder-bianco": {
    badge: BADGE_EARLY_BF,
    warranty: WARRANTY_NONE,
    shortDescription: "Port-card alb din piele",
    description: LEATHER_DESC,
    materialNote:
      "Fiecare port-card Bianco este realizat dintr-o piele diferită. Toate sunt albe, dar dimensiunea și desenul solzilor diferă vizibil, așa că exemplarul dumneavoastră poate să nu arate exact ca în fotografii.",
    crocodileSpecies: SIAMESE,
    features: LEATHER_FEATURES_CITES,
    specs: specsWithCites("Alb (Bianco)"),
    coverAlt: "Port-card alb din piele de crocodil Lorenzo Ricci Bianco - vedere frontală",
    imageAlts: [
      "Port-card alb din piele de crocodil Lorenzo Ricci Bianco - fotografie de produs",
      "Port-card alb din piele de crocodil Lorenzo Ricci Bianco - suprafață de marmură",
      "Lorenzo Ricci Bianco port-card - fotografie lifestyle, utilizare zilnică",
      "Lorenzo Ricci Bianco într-o cutie de lux cu Certificat de autenticitate CITES",
    ],
  },
  "cardholder-valentina": {
    badge: BADGE_EARLY_BF,
    warranty: WARRANTY_NONE,
    shortDescription: "Port-card roz din piele de crocodil",
    description: LEATHER_DESC,
    materialNote: LEATHER_NOTE,
    crocodileSpecies: SIAMESE,
    features: LEATHER_FEATURES_CITES,
    specs: specsWithCites("Roz (Valentina)"),
    coverAlt: "Port-card roz din piele de crocodil Lorenzo Ricci Valentina - vedere frontală",
    imageAlts: [
      "Port-card roz din piele de crocodil Lorenzo Ricci Valentina - fotografie de produs",
      "Lorenzo Ricci Valentina - detaliu al texturii de crocodil, culoare roz",
      "Lorenzo Ricci Valentina port-card - fotografie lifestyle, utilizare zilnică",
      "Lorenzo Ricci Valentina într-o cutie de lux cu Certificat de autenticitate CITES",
    ],
  },
  "cardholder-zaffiro": {
    badge: BADGE_EARLY_BF,
    warranty: WARRANTY_NONE,
    shortDescription: "Port-card albastru închis din piele de crocodil",
    description: LEATHER_DESC,
    materialNote: LEATHER_NOTE,
    crocodileSpecies: SIAMESE,
    features: LEATHER_FEATURES_CITES,
    specs: specsWithCites("Albastru safir (Zaffiro)"),
    coverAlt: "Port-card albastru închis din piele de crocodil Lorenzo Ricci Zaffiro - vedere frontală",
    imageAlts: [
      "Port-card albastru închis din piele de crocodil Lorenzo Ricci Zaffiro - fotografie de produs",
      "Lorenzo Ricci Zaffiro - detaliu al texturii de crocodil, albastru safir",
      "Lorenzo Ricci Zaffiro port-card - fotografie lifestyle, utilizare zilnică",
      "Lorenzo Ricci Zaffiro într-o cutie de lux cu Certificat de autenticitate CITES",
    ],
  },
  "cardholder-onice": {
    badge: BADGE_EARLY_BF,
    warranty: WARRANTY_NONE,
    shortDescription: "Port-card negru din piele de crocodil",
    description: LEATHER_DESC,
    materialNote: LEATHER_NOTE,
    crocodileSpecies: SIAMESE,
    features: LEATHER_FEATURES,
    specs: specsNoCites("Negru (Onice)"),
    coverAlt: "Port-card negru din piele de crocodil Lorenzo Ricci Onice - vedere frontală",
    imageAlts: [
      "Port-card negru din piele de crocodil Lorenzo Ricci Onice - vedere frontală",
      "Lorenzo Ricci Onice - vedere din spate, compartimente pentru carduri",
    ],
  },
  "cardholder-giada": {
    badge: BADGE_EARLY_BF,
    warranty: WARRANTY_NONE,
    shortDescription: "Port-card verde închis din piele de crocodil",
    description: LEATHER_DESC,
    materialNote: LEATHER_NOTE,
    crocodileSpecies: SIAMESE,
    features: LEATHER_FEATURES,
    specs: specsNoCites("Verde închis (Giada)"),
    coverAlt: "Port-card verde închis din piele de crocodil Lorenzo Ricci Giada - vedere frontală",
    imageAlts: [
      "Port-card verde închis din piele de crocodil Lorenzo Ricci Giada - vedere frontală",
      "Lorenzo Ricci Giada - vedere din spate, compartimente pentru carduri",
    ],
  },
  "cardholder-cremisi": {
    badge: BADGE_EARLY_BF,
    warranty: WARRANTY_NONE,
    shortDescription: "Port-card roșu din piele de crocodil",
    description: LEATHER_DESC,
    materialNote: LEATHER_NOTE,
    crocodileSpecies: SIAMESE,
    features: LEATHER_FEATURES,
    specs: specsNoCites("Roșu (Cremisi)"),
    coverAlt: "Port-card roșu din piele de crocodil Lorenzo Ricci Cremisi - vedere frontală",
    imageAlts: [
      "Port-card roșu din piele de crocodil Lorenzo Ricci Cremisi - vedere frontală",
      "Lorenzo Ricci Cremisi - vedere din spate, compartimente pentru carduri",
    ],
  },
  "cardholder-perla": {
    badge: BADGE_EARLY_BF,
    warranty: WARRANTY_NONE,
    shortDescription: "Port-card gri din piele de crocodil",
    description: LEATHER_DESC,
    materialNote: LEATHER_NOTE,
    crocodileSpecies: SIAMESE,
    features: LEATHER_FEATURES,
    specs: specsNoCites("Gri (Perla)"),
    coverAlt: "Port-card gri din piele de crocodil Lorenzo Ricci Perla - vedere frontală",
    imageAlts: [
      "Port-card gri din piele de crocodil Lorenzo Ricci Perla - vedere frontală",
      "Lorenzo Ricci Perla - vedere din spate, compartimente pentru carduri",
    ],
  },
  "cardholder-topazio": {
    badge: BADGE_EARLY_BF,
    warranty: WARRANTY_NONE,
    shortDescription: "Port-card galben din piele de crocodil",
    description: LEATHER_DESC,
    materialNote: LEATHER_NOTE,
    crocodileSpecies: SIAMESE,
    features: LEATHER_FEATURES,
    specs: specsNoCites("Galben (Topazio)"),
    coverAlt: "Port-card galben din piele de crocodil Lorenzo Ricci Topazio - vedere frontală",
    imageAlts: [
      "Port-card galben din piele de crocodil Lorenzo Ricci Topazio - vedere frontală",
      "Lorenzo Ricci Topazio - vedere din spate, compartimente pentru carduri",
    ],
  },

  // ─── BAGS ──────────────────────────────────────────────────────────────────
  "bag-milano-avorio": {
    badge: "Exemplar unic",
    warranty: WARRANTY_NONE,
    crocodileSpecies: NILE,
    shortDescription: "Geantă mare din crocodil de Nil, cu desen individual al solzilor",
    description:
      "Geanta Milano Avorio este realizată din piele de crocodil de Nil (Crocodylus niloticus), cu finisaj Himalaya. Fiecare piele are propriul desen al solzilor.",
    descriptionSections: [
      {
        heading: "Exemplar unic · 1 din 1",
        body: [
          "**Milano Avorio a fost creată o singură dată.**",
          "Este un exemplar unic, produs într-o ediție limitată la exact **1 bucată**. O a doua geantă cu aceeași combinație de formă, piele de crocodil de Nil, desen natural și finisaj Himalaya nu va fi produsă.",
          "La baza ei stă **Crocodylus niloticus**, transformat prin prelucrarea Himalaya într-un material cu un gradient deschis extrem de distinctiv. Himalaya se numără printre cele mai prestigioase și mai laborioase finisaje din lumea pieilor exotice de lux, apreciat pentru tranziția complexă dintre fildeșul deschis și un ton natural mai profund, care pune în valoare relieful fiecărui solz în parte.",
          "Aici nu există două desene identice. Amplasarea, forma și relieful natural al solzilor aparțin pielii respective și fac ca acest exemplar să nu poată fi repetat identic.",
        ],
      },
      {
        heading: "Himalaya: finisajul devenit simbol al luxului",
        body: [
          "Himalaya nu este doar o culoare. Este un finisaj complex, în care suprafața deschisă trece treptat spre un ton natural mai profund, urmând structura pielii însăși.",
          "Rezultatul este un gradient delicat în nuanțe de fildeș și patină naturală, care se dezvoltă diferit pe fiecare piele. Tocmai această combinație dintre selecția excepțională a materialului și prelucrarea laborioasă face din Himalaya unul dintre cele mai recognoscibile simboluri ale segmentului de top în articolele exotice.",
        ],
      },
      {
        heading: "Piele cu identitate naturală",
        body: [
          "Geanta Milano Avorio este realizată din **piele 100% naturală de crocodil de Nil (Crocodylus niloticus)**.",
          "Solzii nu sunt un șablon, ci un desen format natural. Fiecare porțiune a pielii are propriul ritm, relief și amplasare, care rămân vizibile în produsul final.",
          "Acesta este motivul pentru care exemplarul este **1 din 1**, și nu parte dintr-o serie limitată.",
        ],
      },
      {
        heading: "Confecționare",
        body: [
          "Forma este construită astfel încât pielea să rămână în centrul atenției. Silueta curată permite desenului natural al crocodilului și gradientului Himalaya să definească caracterul genții.",
          "Fiecare detaliu este finisat cu atenție la material și la construcție, iar rezultatul final păstrează relieful natural al pielii și precizia lucrului manual.",
        ],
      },
      {
        heading: "Interior",
        body: [
          "Interiorul este structurat cu un compartiment principal, un buzunar interior pentru obiecte mici și un spațiu separat pentru telefon.",
          "Organizarea este funcțională, dar păstrează caracterul curat al construcției, fără compartimentări inutile.",
        ],
      },
      {
        heading: "Autenticitate și proveniență",
        body: [
          "Pielea este însoțită de **documentație CITES**, care atestă proveniența ei legală și specia materialului utilizat.",
          "Geanta Milano Avorio vine și cu un **certificat de autenticitate nominal**, care identifică exemplarul concret.",
          "**Un exemplar. O singură piele. Un singur desen.\n1 din 1.**",
        ],
      },
    ],
    features: [
      "Material: Crocodylus niloticus, cea mai rară piele de crocodil din lume",
      "100% piele naturală de crocodil",
      "Finisaj Himalaya - contrast între fildeș și patină naturală",
      "Desen individual al solzilor pe fiecare piele",
      "Număr de serie LR-CR-9403",
      "Confecționat manual de un maestru pielar",
    ],
    specs: [
      { label: "Material", value: `${NILE}, finisaj Himalaya` },
      { label: "Dimensiuni", value: "45 cm (Lungime) × 22 cm (Lățime) × 27 cm (Înălțime)" },
      { label: "Culoare", value: "Fildeș (Avorio)" },
      { label: "Interior", value: "Compartiment principal, buzunar interior, buzunar pentru telefon" },
      { label: "Închidere", value: "Fermoar YKK" },
      { label: "Mânere", value: "Două mânere superioare și un mâner de umăr mobil" },
    ],
    coverAlt: "Geantă din piele de crocodil Lorenzo Ricci Milano Avorio - vedere frontală",
    imageAlts: [
      "Lorenzo Ricci Milano Avorio geantă - fotografie de produs, vedere frontală",
      "Lorenzo Ricci Milano Avorio - fotografie lifestyle, purtată pe umăr",
      "Lorenzo Ricci Milano Avorio - detaliu al inscripției ștanțate LORENZO RICCI și al etichetei atașate",
      "Lorenzo Ricci Milano Avorio - vedere tridimensională, din unghi",
      "Lorenzo Ricci Milano Avorio - profil lateral, inel pentru mânerul de umăr",
      "Lorenzo Ricci Milano Avorio - detaliu al mânerelor",
      "Lorenzo Ricci Milano Avorio - partea de jos, cu piciorușe de protecție",
      "Lorenzo Ricci Milano Avorio - interior cu eticheta LORENZO RICCI",
      "Lorenzo Ricci Milano Avorio - etichetă de autenticitate, Genuine Crocodile Leather, Himalaya Finish",
      "Lorenzo Ricci Milano Avorio - detaliu al buzunarului interior",
    ],
  },
  "clutch-torino": {
    badge: BADGE_EARLY_BF,
    warranty: WARRANTY_NONE,
    shortDescription: "Clutch de seară negru din piele de crocodil",
    description: CLUTCH_DESC,
    materialNote: LEATHER_NOTE,
    crocodileSpecies: SIAMESE,
    features: CLUTCH_FEATURES,
    specs: specsNoCites("Negru de noapte (Torino)"),
    coverAlt: "Clutch negru din piele de crocodil Lorenzo Ricci Torino - vedere frontală",
    imageAlts: [
      "Lorenzo Ricci Torino clutch - fotografie de produs, vedere frontală",
      "Lorenzo Ricci Torino - vedere laterală",
      "Lorenzo Ricci Torino - clutch deschis, interior cu etichetă de marcă",
      "Lorenzo Ricci Torino - interior, detaliu al închizătorii",
      "Lorenzo Ricci Torino - detaliu al texturii de crocodil",
    ],
  },
  "clutch-verona": {
    badge: BADGE_EARLY_BF,
    warranty: WARRANTY_NONE,
    shortDescription: "Clutch de seară bordo din piele de crocodil",
    description: CLUTCH_DESC,
    materialNote: LEATHER_NOTE,
    crocodileSpecies: SIAMESE,
    features: CLUTCH_FEATURES,
    specs: specsNoCites("Roșu bordo (Verona)"),
    coverAlt: "Clutch bordo din piele de crocodil Lorenzo Ricci Verona - vedere frontală",
    imageAlts: [
      "Lorenzo Ricci Verona clutch - fotografie de produs, vedere frontală",
      "Lorenzo Ricci Verona - vedere laterală",
      "Lorenzo Ricci Verona - clutch deschis, interior cu etichetă de marcă",
      "Lorenzo Ricci Verona - detaliu al interiorului",
      "Lorenzo Ricci Verona - detaliu al logo-ului",
    ],
  },
  "clutch-toscana": {
    badge: BADGE_EARLY_BF,
    warranty: WARRANTY_NONE,
    shortDescription: "Clutch de seară verde închis din piele de crocodil",
    description: CLUTCH_DESC,
    materialNote: LEATHER_NOTE,
    crocodileSpecies: SIAMESE,
    features: CLUTCH_FEATURES,
    specs: specsNoCites("Verde închis (Toscana)"),
    coverAlt: "Clutch verde închis din piele de crocodil Lorenzo Ricci Toscana - vedere frontală",
    imageAlts: [
      "Lorenzo Ricci Toscana clutch - fotografie de produs, vedere frontală",
      "Lorenzo Ricci Toscana - vedere laterală",
      "Lorenzo Ricci Toscana - detaliu al părții frontale",
      "Lorenzo Ricci Toscana - detaliu al închizătorii",
      "Lorenzo Ricci Toscana - clutch deschis, interior cu etichetă de marcă",
    ],
  },
  "clutch-portofino": {
    badge: BADGE_EARLY_BF,
    warranty: WARRANTY_NONE,
    shortDescription: "Clutch de seară crem din piele de crocodil",
    description: CLUTCH_DESC,
    materialNote: LEATHER_NOTE,
    crocodileSpecies: SIAMESE,
    features: CLUTCH_FEATURES,
    specs: specsNoCites("Crem (Portofino)"),
    coverAlt: "Clutch crem din piele de crocodil Lorenzo Ricci Portofino - vedere frontală",
    imageAlts: [
      "Lorenzo Ricci Portofino clutch - fotografie de produs, vedere frontală",
      "Lorenzo Ricci Portofino - vedere laterală",
      "Lorenzo Ricci Portofino - detaliu al mânerului",
      "Lorenzo Ricci Portofino - clutch deschis, interior",
      "Lorenzo Ricci Portofino - interior cu etichetă de marcă",
    ],
  },
  "clutch-capri": {
    badge: BADGE_EARLY_BF,
    warranty: WARRANTY_NONE,
    shortDescription: "Clutch de seară albastru închis din piele de crocodil",
    description: CLUTCH_DESC,
    materialNote: LEATHER_NOTE,
    crocodileSpecies: SIAMESE,
    features: CLUTCH_FEATURES,
    specs: specsNoCites("Albastru închis (Capri)"),
    coverAlt: "Clutch albastru închis din piele de crocodil Lorenzo Ricci Capri - vedere frontală",
    imageAlts: [
      "Lorenzo Ricci Capri clutch - fotografie de produs, vedere frontală",
      "Lorenzo Ricci Capri - vedere din spate, plăcuțe osoase în relief",
      "Lorenzo Ricci Capri - clutch deschis, interior cu etichetă de marcă",
      "Lorenzo Ricci Capri - etichetă Genuine Crocodile Leather, Crocodylus siamensis",
    ],
  },
};
