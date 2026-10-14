// Pairs of equivalent pages in the Bulgarian and the Romanian storefront. Used by the language switch (so a click on RO / BG
// lands on the same page in the other language) and by the geo redirect (middleware.ts). Pure: no React, no server imports.
const PAIRS: [bg: string, ro: string][] = [
  ["/", "/ro"],
  ["/watches", "/ro/ceasuri"],
  ["/jewellery", "/ro/bijuterii"],
  ["/leather-goods", "/ro/piele-de-crocodil"],
  ["/bundles", "/ro/seturi"],
  ["/story", "/ro/despre-noi"],
  ["/faq", "/ro/intrebari-frecvente"],
  ["/watch-manual", "/ro/ghid-ceas"],
  ["/warranty/jewelry", "/ro/garantie-bijuterii"],
  ["/policies/shipping", "/ro/politici/livrare"],
  ["/policies/returns", "/ro/politici/retur"],
  ["/policies/privacy", "/ro/politici/confidentialitate"],
];

const trim = (p: string): string => (p.length > 1 ? p.replace(/\/+$/, "") : p) || "/";

/** Bulgarian path -> the Romanian page that says the same thing (unknown pages land on the Romanian home). */
export function bgToRoPath(pathname: string): string {
  const p = trim(pathname);
  const hit = PAIRS.find(([bg]) => bg === p);
  if (hit) return hit[1];
  const m = p.match(/^\/products\/([a-z0-9-]+)$/);
  if (m) return `/ro/produse/${m[1]}`;
  return "/ro";
}

/** Romanian path -> the Bulgarian page that says the same thing (pages that exist only in Romanian land on the home page). */
export function roToBgPath(pathname: string): string {
  const p = trim(pathname);
  const hit = PAIRS.find(([, ro]) => ro === p);
  if (hit) return hit[0];
  const m = p.match(/^\/ro\/produse\/([a-z0-9-]+)$/);
  if (m) return `/products/${m[1]}`;
  return "/";
}

export const isRoPath = (pathname: string): boolean => pathname === "/ro" || pathname.startsWith("/ro/");

/** Cookie that remembers the visitor's language choice (also written by the geo redirect and read by it). */
export const LANG_COOKIE = "lr_lang";
