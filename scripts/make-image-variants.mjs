// Resized copies of every photo in public/ (images.unoptimized was on since the 05.10.2026 optimiser outage, so the site served
// 1500-2048 px originals into 60-300 px slots). For each photo it writes "<name>-w<W>.webp" for every width in lib/image-widths.json
// that is smaller than the photo; lib/image-loader.ts (next.config images.loaderFile) points every next/image srcset entry at them,
// and anything wider than the largest copy gets the original. A width that is not smaller than the photo gets no file: the loader
// then uses the original (lib/image-small.json lists, per photo, the widths it does NOT have).
//
// Runs before every build ("prebuild"), so a photo added without running it still gets its copies on Vercel. Copies are made
// once and kept in git; when an original's content changes (scripts/image-variant-hashes.json) its copies are made again. Run by hand after adding photos:  node scripts/make-image-variants.mjs
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { widths: WIDTHS, dirs: DIRS, quality: Q } = JSON.parse(fs.readFileSync(path.join(ROOT, "lib/image-widths.json"), "utf8"));

let sharp = null;
try { sharp = require("sharp"); } catch { console.warn("image variants: sharp is not installed - no new copies made, photos without them use the original"); }

const IS_PHOTO = /\.(webp|jpe?g|png)$/i;
const IS_COPY = /-w\d+\.webp$/;
const files = [];
const walk = (dir) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) walk(p); else if (IS_PHOTO.test(e.name) && !IS_COPY.test(e.name)) files.push(p); } };
for (const d of DIRS) if (fs.existsSync(path.join(ROOT, "public", d))) walk(path.join(ROOT, "public", d));

const HASHES = path.join(ROOT, "scripts/image-variant-hashes.json");
const oldHash = fs.existsSync(HASHES) ? JSON.parse(fs.readFileSync(HASHES, "utf8")) : {};
const newHash = {};
const SMALL = path.join(ROOT, "lib/image-small.json");
const oldNone = fs.existsSync(SMALL) ? JSON.parse(fs.readFileSync(SMALL, "utf8")) : {}; // widths a photo had no copy for last time
const copyPath = (file, w) => file.replace(IS_PHOTO, `-w${w}.webp`);
const missing = {}; // public path -> widths with no copy (photo too small for it, or no sharp)
let made = 0, kept = 0;
async function one(file) {
  const pub = "/" + path.relative(path.join(ROOT, "public"), file).split(path.sep).join("/");
  const hash = crypto.createHash("sha1").update(fs.readFileSync(file)).update(JSON.stringify(Q)).digest("hex").slice(0, 12); // the encoder settings are part of it: changing them makes every copy again
  const changed = oldHash[pub] !== undefined && oldHash[pub] !== hash;
  const origSize = fs.statSync(file).size;
  let width = null;
  const none = [];
  // A copy that is not lighter than the original (an original that is already strongly compressed) is dropped: the original is used.
  const notLighter = (out) => { if (fs.statSync(out).size < origSize) return false; fs.unlinkSync(out); return true; };
  for (const w of WIDTHS) {
    const out = copyPath(file, w);
    if (!changed && fs.existsSync(out)) { if (notLighter(out)) none.push(w); else kept++; continue; }
    if ((!changed && oldHash[pub] !== undefined && oldNone[pub]?.includes(w)) || !sharp) { none.push(w); continue; }
    if (width === null) width = (await sharp(file).metadata()).width ?? 0;
    if (w >= width) { if (fs.existsSync(out)) fs.unlinkSync(out); none.push(w); continue; }
    await sharp(file).rotate().resize({ width: w }).webp({ quality: w <= 200 ? Q.thumb : Q.photo, effort: 6, smartSubsample: true }).toFile(out);
    if (notLighter(out)) { none.push(w); continue; }
    made++;
  }
  if (none.length) missing[pub] = none;
  if (sharp) newHash[pub] = hash; else if (oldHash[pub]) newHash[pub] = oldHash[pub];
}
const queue = [...files];
await Promise.all(Array.from({ length: 4 }, async () => { while (queue.length) await one(queue.shift()); }));
const sorted = Object.fromEntries(Object.entries(missing).sort(([a], [b]) => a.localeCompare(b)));
fs.writeFileSync(HASHES, JSON.stringify(Object.fromEntries(Object.entries(newHash).sort(([a], [b]) => a.localeCompare(b))), null, 1) + "\n");
fs.writeFileSync(SMALL, JSON.stringify(sorted, null, 1) + "\n");
console.log(`image variants: ${files.length} photos, ${made} copies made, ${kept} kept, ${Object.keys(sorted).length} photos smaller than some widths`);
