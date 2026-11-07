// New collection: make every white-background product photo the same size, on pure white.
//
//   node scripts/collection-photos.mjs                 process the photos not done yet (public/ + the source folders)
//   node scripts/collection-photos.mjs --out <dir>     dry run: write the results to <dir> only
//   node scripts/collection-photos.mjs --force         redo every white-background photo
//
// Run it after adding or renumbering photos (step of the photo processing, see public/Products/README.md).
// Bracelets only: the necklaces keep the owner's original photos exactly as given (no resize, zoom, re-centring or background
// change). Which photo is a white-background one comes from lib/new-collection.ts COLLECTION_PHOTOS: "p" (product on white) and
// "d" (detail / another angle on white). On-model ("m") and box ("b", "c") photos are never touched; the numbering and order
// stay exactly as they are.
//
// Per photo: the background is only changed where that is safe (see steps 1-3: a clean or a styled backdrop is left alone, a near-white
// tint is whitened by an edge flood outside a product mask - never a pixel of the product, its highlights or its shadow); the product is
// found (everything that is not background) and scaled so it fills 80% of the frame width (bracelets) or 65% of the height
// (necklaces, centred a little below the middle, a chain cut by the source fading out at the top), never more than 90% of the other side, centred on a 2000×2000 white square. Nothing of the product is cut: when the
// source already cuts it at an edge (a necklace chain running out of the top), it stays against that same edge.
// Done files are listed with their hash in scripts/collection-photos.json, so a re-run leaves them alone (no second re-encode).
// Every run also rewrites lib/collection-photo-versions.json (a hash per photo, used as ?v= in the photo URLs): run it after ANY
// photo change (added, replaced, renumbered), even one with no white-background photo.
import sharp from "sharp";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readdirSync } from "node:fs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUB = path.join(ROOT, "public/Products/jewellery/new-collection");
const SRC = path.join(ROOT, "../New Jewellery"); // the owner's source folders ("Гривна Spira - Злато", ...), kept in sync
const MANIFEST = path.join(ROOT, "scripts/collection-photos.json");
const N = 2000, FILL = 0.8, MAX_OTHER = 0.9, NECK_FILL = 0.65, NECK_CENTRE = 0.54;

const args = process.argv.slice(2);
const out = args.includes("--out") ? path.resolve(args[args.indexOf("--out") + 1]) : null;
const force = args.includes("--force");
const only = args.includes("--only") ? args[args.indexOf("--only") + 1].split(",") : null; // e.g. --only a-1.webp,b-2.webp (redo just these)

const ts = readFileSync(path.join(ROOT, "lib/new-collection.ts"), "utf8");
const at = ts.indexOf("export const COLLECTION_PHOTOS");
const block = ts.slice(at, ts.indexOf("};", at));
const photos = [...block.matchAll(/"((necklace|bracelet)-([a-z]+)-(gold|silver))": "([pmbcd]+)"/g)]
  .map(([, slug, type, key, metal, kinds]) => ({ slug, type, key, metal, kinds }));

const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : {};
const sha = (buf) => createHash("sha1").update(buf).digest("hex");

/** The source folder holding a file (the folder names are the product names; found by the file's own name). */
const srcDirs = existsSync(SRC) ? readdirSync(SRC, { withFileTypes: true }).filter((d) => d.isDirectory() && d.name !== "_originals").map((d) => path.join(SRC, d.name)) : [];
const srcOf = (file) => srcDirs.map((d) => path.join(d, file)).find((p) => existsSync(p));

async function normalise(file, type) {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  const px = (x, y) => (y * W + x) * 3;

  // 1-3. Background, made safe for silver (owner, 07.11.2026: the earlier whitening washed out bright silver links).
  //   - The photo's own background colour = the median of a 12px band round the edge.
  //   - Already clean (every channel >= 250): no pixel is singled out; a backdrop of #FAFAFA-#FEFEFE gets one uniform lift of the
  //     whole photo (at most 2%) so it meets the white padding without a visible square.
  //   - A darker / styled backdrop (< 236, e.g. window light on a grey surface): nothing is changed either - it cannot be cleaned
  //     without touching pixels next to the metal.
  //   - A near-white tinted backdrop (236-249): only pixels reached by a flood fill FROM THE IMAGE EDGES, each within 10 levels of
  //     that colour and of its neighbour (low tolerance), and outside a protective mask (everything that differs from the backdrop,
  //     widened by 8px) become #FFFFFF. Nothing connected to or inside the product - its bright highlights, the soft shadow, the
  //     band round its edge - is ever changed.
  const img = Buffer.from(data);
  const band = [[], [], []];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (x > 11 && x < W - 12 && y > 11 && y < H - 12) continue;
    const i = px(x, y); for (let c = 0; c < 3; c++) band[c].push(data[i + c]);
  }
  const bg = band.map((v) => v.sort((p, q) => p - q)[v.length >> 1]);
  const bgMin = Math.min(...bg);
  let bgAction = "untouched (clean)";
  if (bgMin >= 250 && Math.max(...bg) < 255) {
    // Almost white (#FAFAFA-#FEFEFE): one uniform 0.4-2% lift of the whole photo puts its backdrop on pure white, so no faint square
    // shows where it meets the white padding. No mask, no pixel singled out: the metal gets the same imperceptible lift as the rest.
    for (let i = 0; i < img.length; i += 3) for (let c = 0; c < 3; c++) img[i + c] = Math.min(255, Math.round((img[i + c] * 255) / bg[c]));
    bgAction = `uniform lift ${bg.join(",")} -> 255 (${(100 * (255 / bgMin - 1)).toFixed(1)}%)`;
  }
  if (bgMin < 250 && bgMin >= 236) {
    const TOL = 10, STEP = 4, GROW = 8;
    const diff = (i) => Math.max(Math.abs(img[i] - bg[0]), Math.abs(img[i + 1] - bg[1]), Math.abs(img[i + 2] - bg[2]));
    const core = new Uint8Array(W * H); for (let k = 0; k < W * H; k++) core[k] = diff(k * 3) > TOL ? 1 : 0;
    // protective mask = core widened by GROW px (two separable passes of a max filter)
    const tmp = new Uint8Array(W * H), mask = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) { let last = -1e9; for (let x = 0; x < W; x++) { if (core[y * W + x]) last = x; tmp[y * W + x] = x - last <= GROW ? 1 : 0; }
      last = 1e9; for (let x = W - 1; x >= 0; x--) { if (core[y * W + x]) last = x; if (last - x <= GROW) tmp[y * W + x] = 1; } }
    for (let x = 0; x < W; x++) { let last = -1e9; for (let y = 0; y < H; y++) { if (tmp[y * W + x]) last = y; mask[y * W + x] = y - last <= GROW ? 1 : 0; }
      last = 1e9; for (let y = H - 1; y >= 0; y--) { if (tmp[y * W + x]) last = y; if (last - y <= GROW) mask[y * W + x] = 1; } }
    const seen = new Uint8Array(W * H); const stack = [];
    const ok = (k, from) => !seen[k] && !mask[k] && (from < 0 || Math.max(Math.abs(img[k * 3] - img[from * 3]), Math.abs(img[k * 3 + 1] - img[from * 3 + 1]), Math.abs(img[k * 3 + 2] - img[from * 3 + 2])) <= STEP);
    const seed = (x, y) => { const k = y * W + x; if (ok(k, -1)) { seen[k] = 1; stack.push(k); } };
    for (let x = 0; x < W; x++) { seed(x, 0); seed(x, H - 1); } for (let y = 0; y < H; y++) { seed(0, y); seed(W - 1, y); }
    let n = 0;
    while (stack.length) { const k = stack.pop(); n++; const x = k % W, y = (k / W) | 0;
      for (const q of [x > 0 ? k - 1 : -1, x < W - 1 ? k + 1 : -1, y > 0 ? k - W : -1, y < H - 1 ? k + W : -1]) if (q >= 0 && ok(q, k)) { seen[q] = 1; stack.push(q); } }
    for (let k = 0; k < W * H; k++) if (seen[k]) { const i = k * 3; img[i] = img[i + 1] = img[i + 2] = 255; }
    bgAction = `tint ${bg.join(",")} -> white on ${(100 * n / (W * H)).toFixed(1)}% of the photo (edge flood, product masked)`;
  } else if (bgMin < 236) {
    // A styled photo (product on a lit surface, not on white): there is no product-on-white to resize either - left exactly as it is.
    console.log(`   ${path.basename(file)}: styled backdrop ${bg.join(",")} - photo left exactly as it is`);
    return null;
  }
  console.log(`   ${path.basename(file)}: background ${bgAction}`);

  // 4. The product: everything clearly darker or more coloured than white (a faint shadow does not count).
  //    Rows / columns need a few such pixels, so dust and JPEG noise don't stretch the box.
  const ink = (i) => { const mn = Math.min(img[i], img[i + 1], img[i + 2]), mx = Math.max(img[i], img[i + 1], img[i + 2]); return 255 - mn > 38 || mx - mn > 30; };
  const rows = new Uint32Array(H), cols = new Uint32Array(W);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (ink(px(x, y))) { rows[y]++; cols[x]++; }
  const first = (a, n) => { for (let i = 0; i < a.length; i++) if (a[i] >= n) return i; return -1; };
  const last = (a, n) => { for (let i = a.length - 1; i >= 0; i--) if (a[i] >= n) return i; return -1; };
  let top = first(rows, 3), bot = last(rows, 3), left = first(cols, 3), right = last(cols, 3);
  if (top < 0) throw new Error(`no product found in ${file}`);
  const m = 6; // keep the anti-aliased edge
  top = Math.max(0, top - m); left = Math.max(0, left - m); bot = Math.min(H - 1, bot + m); right = Math.min(W - 1, right + m);
  const bw = right - left + 1, bh = bot - top + 1;

  // 5. Scale. Bracelets: 80% of the width (the height at most 90%), centred; a side the source already cuts stays on that edge.
  //    Necklaces: pendant + the V of chain fill 65% of the height (the width at most 90%), centred a little below the middle;
  //    a chain the source cuts at the top fades softly into the white over its top 12%, so no hard cut floats in the frame.
  const neck = type === "necklace";
  const s = neck ? Math.min((NECK_FILL * N) / bh, (MAX_OTHER * N) / bw) : Math.min((FILL * N) / bw, (MAX_OTHER * N) / bh);
  const w = Math.round(bw * s), h = Math.round(bh * s);
  const touch = { t: top <= 3 + m, b: bot >= H - 4 - m, l: left <= 3 + m, r: right >= W - 4 - m };
  const x0 = !neck && touch.l && !touch.r ? 0 : !neck && touch.r && !touch.l ? N - w : Math.round((N - w) / 2);
  const y0 = neck ? Math.round(NECK_CENTRE * N - h / 2) : touch.t && !touch.b ? 0 : touch.b && !touch.t ? N - h : Math.round((N - h) / 2);
  if (neck && touch.t) {
    const fade = Math.round(bh * 0.12);
    for (let y = top; y < top + fade; y++) { const a = 1 - (y - top) / fade; // 1 at the cut .. 0
      for (let x = left; x <= right; x++) { const i = px(x, y); for (let c = 0; c < 3; c++) img[i + c] = Math.round(img[i + c] + (255 - img[i + c]) * a * a); } }
  }

  // The WHOLE photo is scaled and placed so the product lands at (x0, y0) - not a crop of the product: its soft shadow and the
  // backdrop around it then run out naturally, with no crop edge cutting the shadow (owner: "a visible square").
  const SW = Math.round(W * s), SH = Math.round(H * s);
  const offX = x0 - Math.round(left * s), offY = y0 - Math.round(top * s);
  const vx = Math.max(0, -offX), vy = Math.max(0, -offY);
  const vw = Math.min(SW, N - offX) - vx, vh = Math.min(SH, N - offY) - vy;
  // Where the scaled photo stops short of the canvas, its own edge meets the white padding: that edge must be white (>= 253 almost
  // everywhere) or a visible line appears (a grey "floor" cut off) - such a photo is left exactly as it is.
  const sides = [offX > 0 && [0, 0, 1, H], offY > 0 && [0, 0, W, 1], offX + SW < N && [W - 1, 0, 1, H], offY + SH < N && [0, H - 1, W, 1]].filter(Boolean);
  for (const [sx, sy, sw, sh] of sides) {
    const v = []; for (let y = sy; y < sy + sh; y++) for (let x = sx; x < sx + sw; x++) { const i = px(x, y); v.push(Math.min(img[i], img[i + 1], img[i + 2])); }
    v.sort((p, q) => p - q);
    if (v[Math.floor(v.length * 0.05)] < 253) { console.log(`   ${path.basename(file)}: backdrop not white at its own edge - photo left exactly as it is`); return null; }
  }
  const piece = await sharp(img, { raw: { width: W, height: H, channels: 3 } })
    .resize(SW, SH, { kernel: "lanczos3" }).extract({ left: vx, top: vy, width: vw, height: vh }).png().toBuffer();
  return sharp({ create: { width: N, height: N, channels: 3, background: "#ffffff" } })
    .composite([{ input: piece, left: Math.max(0, offX), top: Math.max(0, offY) }]).flatten({ background: "#ffffff" })
    .webp({ quality: 88, effort: 6 }).toBuffer();
}

if (out) mkdirSync(out, { recursive: true });
let done = 0, skipped = 0;
for (const p of photos) for (const [i, kind] of [...p.kinds].entries()) {
  if (kind !== "p" && kind !== "d") continue;
  if (p.type === "necklace") continue; // necklaces: the owner's original photos exactly as given, never processed (owner, 07.11.2026)
  const name = `${p.key}-${p.type}-${p.metal}-${i + 1}.webp`, file = path.join(PUB, name);
  if (!existsSync(file)) { console.warn("missing", name); continue; }
  if (only && !only.includes(name)) continue;
  if (!force && !only && !out && manifest[name] === sha(readFileSync(file))) { skipped++; continue; }
  const buf = await normalise(file, p.type);
  if (buf === null) { // kept exactly as is: record it, and make the owner's folder copy the same file
    if (!out) { manifest[name] = sha(readFileSync(file)); const src = srcOf(name); if (src) copyFileSync(file, src); }
    skipped++; continue;
  }
  if (out) { writeFileSync(path.join(out, name), buf); console.log("->", name); done++; continue; }
  // Keep the untouched original once (New Jewellery/_originals/<name>), so a photo can always be redone from it.
  const keep = path.join(SRC, "_originals", name);
  if (existsSync(SRC) && !existsSync(keep)) { mkdirSync(path.dirname(keep), { recursive: true }); copyFileSync(file, keep); }
  writeFileSync(file, buf); manifest[name] = sha(buf);
  const src = srcOf(name); if (src) copyFileSync(file, src); else console.warn("  no source folder file for", name);
  console.log("done", name); done++;
}
// Version tag per photo (content hash): the site requests "<file>.webp?v=<hash>", so a replaced or renumbered photo is never
// served from Cloudflare's cache under its old content (photos are cached a day by name).
if (!out) {
  const versions = Object.fromEntries(readdirSync(PUB).filter((f) => f.endsWith(".webp")).sort().map((f) => [f, sha(readFileSync(path.join(PUB, f))).slice(0, 10)]));
  writeFileSync(path.join(ROOT, "lib/collection-photo-versions.json"), JSON.stringify(versions, null, 1) + "\n");
}
if (!out) writeFileSync(MANIFEST, JSON.stringify(Object.fromEntries(Object.entries(manifest).sort()), null, 1) + "\n");
console.log(`${done} processed, ${skipped} already done`);
