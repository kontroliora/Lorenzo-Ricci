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
// Per photo: the near-white background (the photo's own off-white / grey backdrop and anything ≥ #EEEEEE, connected to the edge) becomes
// pure #FFFFFF over the whole image, the product and its soft shadow stay natural; the product is
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

  // 1. Background = near-white, colourless pixels connected to the border (flood fill). White inside the product
  //    (mother-of-pearl clovers inside their rims) is never reached, so it is never bleached.
  const img = Buffer.from(data);
  const FLOOR = 196, SAT = 26;
  const mnOf = (i) => Math.min(img[i], img[i + 1], img[i + 2]);
  const near = (i) => { const mn = mnOf(i), mx = Math.max(img[i], img[i + 1], img[i + 2]); return mn >= FLOOR && mx - mn <= SAT; };
  const isBg = new Uint8Array(W * H); const stack = [];
  const push = (x, y) => { const k = y * W + x; if (!isBg[k] && near(k * 3)) { isBg[k] = 1; stack.push(k); } };
  for (let x = 0; x < W; x++) { push(x, 0); push(x, H - 1); }
  for (let y = 0; y < H; y++) { push(0, y); push(W - 1, y); }
  while (stack.length) { const k = stack.pop(); const x = k % W, y = (k / W) | 0;
    if (x > 0) push(x - 1, y); if (x < W - 1) push(x + 1, y); if (y > 0) push(x, y - 1); if (y < H - 1) push(x, y + 1); }

  // 1b. Background shut in by the product (inside a bangle or a chain loop): the near-white areas the edge fill can't reach.
  //     An area counts as background when it is big (over 2% of the photo: the inside of a bangle or a chain loop; a clover's
  //     interior is under 2% and is never touched, however light) and as light as the backdrop (average ≥ #EEEEEE);
  //     mother-of-pearl clovers average ~#E2 and stay as they are. STATS=1 prints each area's numbers.
  const comp = new Int32Array(W * H).fill(-1); const comps = [];
  for (let k0 = 0; k0 < W * H; k0++) {
    if (isBg[k0] || comp[k0] >= 0 || !near(k0 * 3)) continue;
    const id = comps.length, list = [k0]; comp[k0] = id; let n = 0, sum = 0, sq = 0;
    while (list.length) { const k = list.pop(); const m = mnOf(k * 3); n++; sum += m; sq += m * m;
      const x = k % W, y = (k / W) | 0;
      for (const q of [x > 0 ? k - 1 : -1, x < W - 1 ? k + 1 : -1, y > 0 ? k - W : -1, y < H - 1 ? k + W : -1])
        if (q >= 0 && comp[q] < 0 && !isBg[q] && near(q * 3)) { comp[q] = id; list.push(q); } }
    const mean = sum / n; comps.push({ n, mean, sd: Math.sqrt(Math.max(0, sq / n - mean * mean)), x: k0 % W, y: (k0 / W) | 0 });
  }
  const bgIds = new Set();
  comps.forEach((c, id) => {
    const flat = c.n > W * H * 0.02 && c.mean >= 238;
    if (process.env.STATS && c.n > W * H * 0.002) console.log(`   ${path.basename(file)} area ${c.n} mean ${c.mean.toFixed(1)} sd ${c.sd.toFixed(2)} at ${c.x},${c.y} -> ${flat ? "background" : "kept"}`);
    if (flat) bgIds.add(id);
  });
  if (bgIds.size) for (let k = 0; k < W * H; k++) if (comp[k] >= 0 && bgIds.has(comp[k])) isBg[k] = 1;

  // 2. The level of the photo's own background (an off-white / grey square inside earlier white padding, or a grey studio
  //    backdrop): the 20th percentile of the background pixels that are not already pure white. Everything from that level
  //    (and anything at #EEEEEE or lighter) up becomes pure #FFFFFF over the WHOLE image, so no square or edge is left;
  //    below it a short ramp keeps the soft shadow natural; darker pixels (the shadow core, the product) are untouched.
  const hist = new Uint32Array(256); let inner = 0;
  for (let k = 0; k < W * H; k++) if (isBg[k]) { const m = mnOf(k * 3); if (m < 253) { hist[m]++; inner++; } }
  let FULL = 238;
  if (inner > W * H * 0.01) { let acc = 0, p20 = 255; for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= inner * 0.2) { p20 = v; break; } } FULL = Math.max(205, Math.min(238, p20 - 2)); }
  const LO = FULL - 36;
  for (let k = 0; k < W * H; k++) if (isBg[k]) {
    const i = k * 3; const a = Math.min(1, Math.max(0, (mnOf(i) - LO) / (FULL - LO))); // 0 at LO .. 1 at FULL and above
    for (let c = 0; c < 3; c++) img[i + c] = Math.round(img[i + c] + (255 - img[i + c]) * a);
  }

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

  const piece = await sharp(img, { raw: { width: W, height: H, channels: 3 } })
    .extract({ left, top, width: bw, height: bh }).resize(w, h, { kernel: "lanczos3" }).png().toBuffer();
  return sharp({ create: { width: N, height: N, channels: 3, background: "#ffffff" } })
    .composite([{ input: piece, left: x0, top: y0 }]).flatten({ background: "#ffffff" })
    .webp({ quality: 88, effort: 6 }).toBuffer();
}

if (out) mkdirSync(out, { recursive: true });
let done = 0, skipped = 0;
for (const p of photos) for (const [i, kind] of [...p.kinds].entries()) {
  if (kind !== "p" && kind !== "d") continue;
  if (p.type === "necklace") continue; // necklaces: the owner's original photos exactly as given, never processed (owner, 07.11.2026)
  const name = `${p.key}-${p.type}-${p.metal}-${i + 1}.webp`, file = path.join(PUB, name);
  if (!existsSync(file)) { console.warn("missing", name); continue; }
  if (!force && !out && manifest[name] === sha(readFileSync(file))) { skipped++; continue; }
  const buf = await normalise(file, p.type);
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
