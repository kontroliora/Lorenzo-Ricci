// Share images (og:image) for Facebook / Instagram / Messenger: 1200x630 JPEGs in public/og/.
//   - one per product: its photo no. 1 (first gallery photo), trimmed and centred on white
//   - home.jpg: a watch, a jewellery piece and a leather piece side by side on white
// Writes lib/og-images.json ({ slug: "/og/<slug>.jpg?v=<hash>" }); pages fall back to the cover photo for a slug not in it.
// Run by hand after adding/changing a product's first photo:  node scripts/make-og-images.mjs
// (local only, needs Node >= 23 for TypeScript type stripping; not part of the Vercel build)
import { register } from "node:module";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const W = 1200, H = 630, PAD_X = 90, PAD_Y = 40;
const WHITE = { r: 255, g: 255, b: 255 };
const HOME_PICKS = ["yachting-black", "necklace-aurelius", "bag-milano-avorio"];

// Resolve "@/..." and extensionless relative imports of the TypeScript catalog.
const hook = `
import { existsSync, statSync } from "node:fs";
import { pathToFileURL, fileURLToPath } from "node:url";
const ROOT = ${JSON.stringify(ROOT)};
export async function resolve(spec, ctx, next) {
  let base = null;
  if (spec.startsWith("@/")) base = ROOT + "/" + spec.slice(2);
  else if ((spec.startsWith("./") || spec.startsWith("../")) && ctx.parentURL?.startsWith("file:")) base = fileURLToPath(new URL(spec, ctx.parentURL));
  if (base) for (const ext of ["", ".ts", ".tsx", ".js", ".mjs", "/index.ts"]) {
    const f = base + ext;
    if (existsSync(f) && statSync(f).isFile()) return { url: pathToFileURL(f).href, shortCircuit: true, ...(f.endsWith(".json") ? { importAttributes: { type: "json" } } : {}) };
  }
  return next(spec, ctx);
}`;
register("data:text/javascript," + encodeURIComponent(hook), import.meta.url);
const { allProducts } = await import(pathToFileURL(path.join(ROOT, "lib/products.ts")).href);

// Same rule as the product page gallery (app/products/[slug]/page.tsx): watches skip night and side-profile shots.
const firstPhoto = (p) => {
  const g = p.category === "watches" ? p.images.filter((i) => !i.src.includes("night") && !i.src.includes("stranichen")) : p.images;
  return (g[0] ?? p.coverImage).src;
};
const fileOf = (src) => path.join(ROOT, "public", decodeURI(src.split("?")[0]));

// The photo flattened on white, cropped to the piece plus a small margin of its own background, so the piece fills the frame
// and the crop's edges are background (which render() carries out to the full frame).
async function piece(src) {
  const flat = await sharp(fileOf(src)).flatten({ background: WHITE }).toBuffer();
  const { width, height } = await sharp(flat).metadata();
  let info;
  try {
    ({ info } = await sharp(flat).trim({ threshold: 18 }).toBuffer({ resolveWithObject: true })); // background = top-left pixel
  } catch {
    return flat; // nothing to trim
  }
  const x0 = -(info.trimOffsetLeft ?? 0), y0 = -(info.trimOffsetTop ?? 0);
  const m = Math.round(Math.max(info.width, info.height) * 0.04);
  const left = Math.max(0, x0 - m), top = Math.max(0, y0 - m);
  const right = Math.min(width, x0 + info.width + m), bottom = Math.min(height, y0 + info.height + m);
  return sharp(flat).extract({ left, top, width: right - left, height: bottom - top }).toBuffer();
}

const fitInto = async (buf, w, h) => sharp(buf).resize(w, h, { fit: "inside", withoutEnlargement: false, kernel: "lanczos3" }).toBuffer({ resolveWithObject: true });

// True when every pixel along the photo's border is light background (the piece does not touch the edge).
async function lightBorder(buf) {
  const { data } = await sharp(buf).resize(48, 48, { fit: "fill" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) {
    if (x > 0 && x < 47 && y > 0 && y < 47) continue;
    const i = (y * 48 + x) * 3;
    if (Math.min(data[i], data[i + 1], data[i + 2]) < 225) return false;
  }
  return true;
}

const toJpeg = (img) => img.jpeg({ quality: 92, chromaSubsampling: "4:4:4", mozjpeg: true }).toBuffer();

async function render(slots) {
  const slotW = Math.floor((W - 2 * PAD_X) / slots.length);
  // One piece on a light background: the photo's own edge pixels are carried out to 1200x630, so an off-white or softly
  // shaded studio background continues without a visible box (pure white stays pure white).
  if (slots.length === 1 && (await lightBorder(slots[0]))) {
    const { data, info } = await fitInto(slots[0], slotW, H - 2 * PAD_Y);
    const left = Math.floor((W - info.width) / 2), top = Math.floor((H - info.height) / 2);
    return toJpeg(sharp(data).extend({ left, right: W - info.width - left, top, bottom: H - info.height - top, extendWith: "copy" }));
  }
  const layers = [];
  for (let i = 0; i < slots.length; i++) {
    const { data, info } = await fitInto(slots[i], slotW - (slots.length > 1 ? 30 : 0), H - 2 * PAD_Y);
    layers.push({ input: data, left: PAD_X + i * slotW + Math.round((slotW - info.width) / 2), top: Math.round((H - info.height) / 2) });
  }
  return toJpeg(sharp({ create: { width: W, height: H, channels: 3, background: WHITE } }).composite(layers));
}

const outDir = path.join(ROOT, "public/og");
fs.mkdirSync(outDir, { recursive: true });
const manifest = {};
const write = (name, buf) => {
  fs.writeFileSync(path.join(outDir, `${name}.jpg`), buf);
  manifest[name] = `/og/${name}.jpg?v=${createHash("sha1").update(buf).digest("hex").slice(0, 10)}`;
};

const bySlug = new Map(allProducts.map((p) => [p.slug, p]));
for (const p of allProducts) write(p.slug, await render([await piece(firstPhoto(p))]));
write("home", await render(await Promise.all(HOME_PICKS.map((s) => piece(firstPhoto(bySlug.get(s)))))));

fs.writeFileSync(path.join(ROOT, "lib/og-images.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`og images: ${Object.keys(manifest).length} written to public/og/`);
