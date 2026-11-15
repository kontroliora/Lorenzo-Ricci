// Home hero, watch slide (BG): the watch + the crocodile cardholder gift, built from the site's own originals exactly like the
// "Часовник + кардхолдър ПОДАРЪК" e-mail hero (private/email-campaigns/2026-11/make-assets-watch-gift.mjs): the watch's transparent
// cutout, a gold "+", and the black cardholder Onice on its photo's own off-white (#FCFBFC), which is also the slide's background,
// so no seam shows. One image per fallback watch (lib/hero.ts picks the first one in stock), with and without the cardholder.
//   node scripts/make-hero-watch.mjs   -> public/covers/hero-watch-<colour>[-onice].webp  (2000 x 1200, WebP q97)
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "public/covers");
const W = 2000, H = 1200, BG = { r: 252, g: 251, b: 252 };
const WATCHES = {
  blue: "public/Products/watches/Yachting Blue/yachting-blue-hronograf-preden-izgled-v2.webp",
  black: "public/Products/watches/Yachting Black/yachting-black-hronograf-preden-izgled-v2.webp",
  white: "public/Products/watches/Yachting White/yachting-white-hronograf-preden-izgled-v2.webp",
};
const CARD = "public/Products/wallets/Onice/kardholder-onice-cheren-krokodilska-kozha.webp";
const plusSize = 110, gap = 80;
const plus = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${plusSize}" height="${plusSize}"><rect x="49" y="8" width="12" height="94" fill="#9A7B2F"/><rect x="8" y="49" width="94" height="12" fill="#9A7B2F"/></svg>`);
const card = await sharp(path.join(ROOT, CARD)).trim({ threshold: 12 }).resize({ width: 640 }).toBuffer({ resolveWithObject: true });

for (const [colour, file] of Object.entries(WATCHES)) {
  const watch = await sharp(path.join(ROOT, file)).trim({ threshold: 1 }).resize({ height: 1040 }).toBuffer({ resolveWithObject: true });
  for (const withCard of [true, false]) {
    const total = watch.info.width + (withCard ? gap + plusSize + gap + card.info.width : 0);
    const x0 = Math.round((W - total) / 2);
    const layers = [{ input: watch.data, left: x0, top: Math.round((H - watch.info.height) / 2) }];
    if (withCard) layers.push(
      { input: plus, left: x0 + watch.info.width + gap, top: Math.round((H - plusSize) / 2) },
      { input: card.data, left: x0 + watch.info.width + gap + plusSize + gap, top: Math.round((H - card.info.height) / 2) },
    );
    const name = `hero-watch-${colour}${withCard ? "-onice" : ""}.webp`;
    const info = await sharp({ create: { width: W, height: H, channels: 3, background: BG } }).composite(layers)
      .webp({ quality: 97, effort: 6 }).toFile(path.join(OUT, name));
    console.log(name, `${info.width}x${info.height}`, `${Math.round(info.size / 1024)} KB`);
  }
}
