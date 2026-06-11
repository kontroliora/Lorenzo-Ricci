/**
 * import-reviews.mjs
 * Parses both reviews CSVs, downloads images, regenerates lib/reviews.ts
 */

import fs from "fs";
import path from "path";
import https from "https";
import http from "http";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const IMG_DIR = path.join(ROOT, "public", "reviews");
const OUT_PATH = path.join(ROOT, "lib", "reviews.ts");

const SLUG_MAP = { chrono: "chrono-black", polar: "polar-frost", "chrono ": "chrono-black", "polar ": "polar-frost" };
const normalise = (h) => SLUG_MAP[h?.trim()] ?? h?.trim();

// ── CSV parser ─────────────────────────────────────────────────────────────
function parseCSV(raw) {
  const lines = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const header = splitLine(lines[0]).map((h) => h.replace(/^﻿/, "").trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const vals = splitLine(lines[i]);
    const obj = {};
    header.forEach((h, idx) => { obj[h] = (vals[idx] ?? "").trim(); });
    rows.push(obj);
  }
  return rows;
}

function splitLine(line) {
  const result = []; let cur = ""; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { if (inQ && line[i+1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
    else if (c === ',' && !inQ) { result.push(cur); cur = ""; }
    else cur += c;
  }
  result.push(cur);
  return result;
}

// ── Normalise rows from either CSV format ──────────────────────────────────
function normaliseRow(r) {
  // primary CSV:   product_handle, state, rating, title, author, email, location, body, imageUrl, reply, created_at
  // additional CSV: product_handle, rating, author, email, body, created_at, photo_url, verified_purchase
  const state = r.state ?? "published";
  if (state && state !== "published") return null;
  const handle = normalise(r.product_handle);
  if (!handle) return null;
  const body = (r.body ?? "").trim();
  if (body.length < 3) return null;
  return {
    handle,
    rating: parseInt(r.rating, 10) || 5,
    author: (r.author ?? "").trim(),
    title: (r.title ?? "").trim() || null,
    body,
    imageUrl: (r.imageUrl || r.photo_url || "").trim() || null,
    date: formatDate(r.created_at ?? ""),
  };
}

// ── Image download ─────────────────────────────────────────────────────────
function download(url, dest) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith("https") ? https : http;
    const file = fs.createWriteStream(dest);
    proto.get(url, (res) => {
      if ([301, 302, 307, 308].includes(res.statusCode)) {
        file.close(); fs.unlinkSync(dest);
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close(); fs.unlinkSync(dest);
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      res.pipe(file);
      file.on("finish", () => file.close(resolve));
    }).on("error", (e) => { fs.unlink(dest, () => {}); reject(e); });
  });
}

function extFromUrl(url) {
  const m = url.split("?")[0].match(/\.(jpg|jpeg|png|webp)$/i);
  return m ? m[0].toLowerCase().replace("jpeg", ".jpg") : ".jpg";
}
function safe(s) { return (s ?? "").replace(/[^a-zA-Z0-9А-яЁёа-яёЀ-ӿ]/g, "").slice(0, 28); }

function formatDate(raw) {
  if (!raw) return "2026-01-01";
  const p = raw.trim().split("/");
  if (p.length === 3) {
    const [m, d, y] = p.map(Number);
    return `${y < 100 ? 2000 + y : y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  }
  return raw.slice(0, 10);
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  fs.mkdirSync(IMG_DIR, { recursive: true });

  const csvFiles = [
    path.join(ROOT, "reviews", "reviews .csv"),
    path.join(ROOT, "reviews", "additional reviews.csv"),
  ];

  let allRows = [];
  for (const f of csvFiles) {
    if (!fs.existsSync(f)) { console.warn("Missing:", f); continue; }
    const raw = fs.readFileSync(f, "utf-8");
    const rows = parseCSV(raw).map(normaliseRow).filter(Boolean);
    console.log(`${path.basename(f)}: ${rows.length} valid rows`);
    allRows.push(...rows);
  }

  // Deduplicate by author+body
  const seen = new Set();
  allRows = allRows.filter((r) => {
    const key = `${r.handle}|${r.author}|${r.body.slice(0, 40)}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
  console.log(`Total unique reviews: ${allRows.length}`);

  // Download images
  let dl = 0, skip = 0, fail = 0;
  for (const r of allRows) {
    if (!r.imageUrl?.startsWith("http")) continue;
    const ext = extFromUrl(r.imageUrl);
    const fname = `${r.handle}-${safe(r.author)}${ext}`;
    const dest = path.join(IMG_DIR, fname);
    r._local = `/reviews/${fname}`;
    if (fs.existsSync(dest)) { skip++; continue; }
    try {
      await download(r.imageUrl, dest);
      dl++; process.stdout.write(`  ↓ ${fname}\n`);
    } catch (e) {
      fail++; console.warn(`  ✗ ${fname}: ${e.message}`); r._local = null;
    }
  }
  console.log(`\nImages: ${dl} new, ${skip} cached, ${fail} failed`);

  // Generate TS
  let id = 1;
  const entries = allRows.map((r) => {
    const imageUrl = r._local ?? (r.imageUrl?.startsWith("/") ? r.imageUrl : null);
    const lines = [
      `  {`,
      `    id: "csv-${id++}",`,
      `    productSlug: ${JSON.stringify(r.handle)},`,
      `    author: ${JSON.stringify(r.author)},`,
      `    rating: ${r.rating},`,
    ];
    if (r.title) lines.push(`    title: ${JSON.stringify(r.title)},`);
    lines.push(`    body: ${JSON.stringify(r.body)},`);
    if (imageUrl) lines.push(`    imageUrl: ${JSON.stringify(imageUrl)},`);
    lines.push(`    date: ${JSON.stringify(r.date)},`);
    lines.push(`  },`);
    return lines.join("\n");
  });

  const ts = `import type { Review } from "./types";

/** Returns a date that is always within the last ~80 days, deterministically derived from the anchor. */
export function dynamicDate(anchor: string): string {
  const now = Date.now();
  const anchorMs = new Date(anchor).getTime();
  const maxAgeMs = 80 * 24 * 60 * 60 * 1000;
  if (now - anchorMs > maxAgeMs) {
    const seed = anchor.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    const daysAgo = 6 + (seed % 58);
    return new Date(now - daysAgo * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  }
  return anchor;
}

export const reviews: Review[] = [
${entries.join("\n")}
];

export function getReviewsBySlug(slug: string): Review[] {
  return reviews.filter((r) => r.productSlug === slug);
}

export function getTopReviews(limit = 6): Review[] {
  return reviews
    .filter((r) => r.body.length > 20)
    .sort((a, b) => (!!a.imageUrl === !!b.imageUrl ? 0 : a.imageUrl ? -1 : 1))
    .slice(0, limit);
}
`;

  fs.writeFileSync(OUT_PATH, ts, "utf-8");
  console.log(`\n✓ Written ${entries.length} reviews → lib/reviews.ts`);

  // Stats per product
  const bySlug = {};
  allRows.forEach((r) => { bySlug[r.handle] = (bySlug[r.handle] ?? 0) + 1; });
  console.log("\nReviews per product:");
  Object.entries(bySlug).sort((a,b) => b[1]-a[1]).forEach(([s,n]) => console.log(`  ${s}: ${n}`));
}

main().catch(console.error);
