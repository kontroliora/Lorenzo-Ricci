// The black velvet LORENZO RICCI box the NEW cardholders ship in (owner, 14.11.2026): the 2026-09-27 batch (Onice, Giada, Cremisi,
// Perla, Topazio) and the 2026-11-03 ones (Marina, Panna). The four original cardholders (Ambra, Bianco, Valentina, Zaffiro) ship in a
// different box and keep their own "кутия с сертификат" photo - no box photo and no box line on them.
// The photo is the last one of these products' galleries (lib/products.ts); the product pages show the box line under the price.
// ?v= = first 10 hex of the photo's sha1: change it whenever the file is replaced.

export const CARDHOLDER_BOX_PHOTO = "/Products/wallets/box/kardholder-velurena-kutiya-lorenzo-ricci.webp?v=ea70adb0e3";

const VELVET_BOX_CARDHOLDERS = new Set([
  "cardholder-onice",
  "cardholder-giada",
  "cardholder-cremisi",
  "cardholder-perla",
  "cardholder-topazio",
  "cardholder-marina",
  "cardholder-panna",
]);

export const isVelvetBoxCardholder = (slug: string): boolean => VELVET_BOX_CARDHOLDERS.has(slug);
