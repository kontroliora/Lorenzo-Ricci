// 800 px copies of the product gallery photos for phones (images.unoptimized is on since the 05.10.2026 optimiser outage, so
// next/image cannot resize). For every gallery / cover image wider than 900 px it writes "<name>-w800.webp" next to it (once) and
// lists them in lib/image-variants.json; ProductGallery serves them through srcset. Run after adding product photos:
//   node scripts/make-image-variants.mjs
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const ts = require("typescript");
const sharp = require("sharp");
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const src = fs.readFileSync(path.join(ROOT, "lib/products.ts"), "utf8");
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const mod = { exports: {} }; new Function("module", "exports", "require", js)(mod, mod.exports, require);
const images = new Set();
for (const p of mod.exports.products) for (const img of [p.coverImage, ...(p.images ?? [])]) if (img?.src && /\.(webp|jpe?g|png)$/i.test(img.src)) images.add(img.src);
const variants = {}; let made = 0, kept = 0;
for (const s of images) {
  const file = path.join(ROOT, "public", decodeURIComponent(s));
  if (!fs.existsSync(file)) continue;
  const meta = await sharp(file).metadata();
  if ((meta.width ?? 0) <= 900) continue;
  const outSrc = s.replace(/\.(webp|jpe?g|png)$/i, "-w800.webp");
  const outFile = path.join(ROOT, "public", decodeURIComponent(outSrc));
  if (!fs.existsSync(outFile)) { await sharp(file).rotate().resize({ width: 800, height: 800, fit: "inside" }).webp({ quality: 78 }).toFile(outFile); made++; } else kept++;
  variants[s] = outSrc;
}
fs.writeFileSync(path.join(ROOT, "lib/image-variants.json"), JSON.stringify(variants, null, 1) + "\n");
console.log(`image variants: ${Object.keys(variants).length} listed (${made} new, ${kept} existing)`);
