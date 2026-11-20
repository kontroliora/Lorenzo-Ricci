/**
 * import-340-reviews.mjs
 *
 * Final import of 340 Lorenzo Ricci clover reviews.
 * - Deletes ALL existing clover reviews (bracelets + necklaces)
 * - Imports all 340 reviews from BEZOV/reviews/340.txt
 * - Uploads necklace photos (reviews/necklaces/1.png … 7.webp) → necklace reviews [101]-[106]
 * - Uploads bracelet photos (reviews/bracelet reviews/image*.webp) → bracelet reviews [107]-[115]
 * - Re-distributes the already-uploaded Storage photos to remaining bracelet full-text reviews
 *
 * Run from site/: node scripts/import-340-reviews.mjs
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT       = path.resolve(__dirname, "..");           // …/Lorenzo Ricci/site
const PHOTOS_DIR = path.resolve(ROOT, "..", "reviews");     // …/Lorenzo Ricci/reviews
const REVIEWS_TXT = path.resolve(ROOT, "..", "..", "BEZOV", "reviews", "340.txt");

function loadEnv() {
  const envPath = path.join(ROOT, ".env.local");
  if (!fs.existsSync(envPath)) throw new Error("Missing .env.local at " + envPath);
  const raw = fs.readFileSync(envPath, "utf-8");
  const env = {};
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    env[t.slice(0, eq).trim()] = val;
  }
  return env;
}

// ── Slug mapping ──────────────────────────────────────────────────────────────
const PRODUCT_TO_SLUG = {
  "Гривна Verdis – Злато":   "bracelet-verdis-gold",
  "Гривна Verdis – Сребро":  "bracelet-verdis-silver",
  "Гривна Lumen – Злато":    "bracelet-lumen-gold",
  "Гривна Lumen – Сребро":   "bracelet-lumen-silver",
  "Гривна Noctis – Злато":   "bracelet-noctis-gold",
  "Гривна Noctis – Сребро":  "bracelet-noctis-silver",
  "Колие Verdis – Злато":    "necklace-verdis-gold",
  "Колие Verdis – Сребро":   "necklace-verdis-silver",
  "Колие Lumen – Злато":     "necklace-lumen-gold",
  "Колие Lumen – Сребро":    "necklace-lumen-silver",
  "Колие Noctis – Злато":    "necklace-noctis-gold",
  "Колие Noctis – Сребро":   "necklace-noctis-silver",
};

function productToSlug(line) {
  const t = line.trim();
  return PRODUCT_TO_SLUG[t] ?? PRODUCT_TO_SLUG[t.replace(/—/g, "–")] ?? null;
}

function parseStars(s) {
  return (s.match(/★/g) ?? []).length || 5;
}

function distributeTimestamps(count) {
  const now = new Date("2026-11-20T12:00:00Z");
  const start = new Date(now);
  start.setMonth(start.getMonth() - 18);
  const range = now.getTime() - start.getTime();
  const ts = [];
  for (let i = 0; i < count; i++) {
    ts.push(new Date(start.getTime() + ((i * 7919 + 1234567) % count) / count * range).toISOString());
  }
  ts.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  return ts;
}

/**
 * Returns array of { name, rating, slug, body, photoFilename? }
 * photoFilename is the raw tag value, e.g. "image (2).webp" or "1.png"
 */
function parseFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf-8");
  const lines = raw.split("\n");
  const reviews = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    // ── Rating-only: [N] Name | ★ | Product ─────────────────────────────────
    const ratingMatch = line.match(/^\[(\d+)\]\s+(.+?)\s*\|\s*(★+)\s*\|\s*(.+)$/);
    if (ratingMatch) {
      const slug = productToSlug(ratingMatch[4]);
      if (slug) reviews.push({ name: ratingMatch[2].trim(), rating: parseStars(ratingMatch[3]), slug, body: null, photoFilename: null });
      i++;
      continue;
    }

    // ── Full-text: [N] or [N] [Снимка X] ────────────────────────────────────
    const blockMatch = line.match(/^\[(\d+)\](\s+\[Снимка\s+(.+?)\])?$/);
    if (blockMatch) {
      const photoFilename = blockMatch[3]?.trim() ?? null;
      i++;
      if (i >= lines.length) break;
      const nameParts = lines[i].trim().split("|").map((s) => s.trim());
      const name = nameParts[0];
      const rating = parseStars(nameParts[1] ?? "");
      i++;
      if (i >= lines.length) break;
      const slug = productToSlug(lines[i]);
      i++;
      const bodyLines = [];
      while (i < lines.length) {
        const bl = lines[i].trim();
        if (!bl) { i++; break; }
        if (/^\[\d+\]/.test(bl)) break;
        bodyLines.push(bl);
        i++;
      }
      const body = bodyLines.join(" ").trim() || null;
      if (slug && name) reviews.push({ name, rating, slug, body, photoFilename });
      continue;
    }

    i++;
  }

  return reviews;
}

function mimeFromExt(ext) {
  return { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" }[ext] ?? "image/jpeg";
}

async function uploadPhoto(supabase, localPath, storagePrefix) {
  const ext = path.extname(localPath).toLowerCase();
  const storagePath = `${storagePrefix}/${crypto.randomUUID()}${ext}`;
  const data = fs.readFileSync(localPath);
  const { error } = await supabase.storage
    .from("review-images")
    .upload(storagePath, data, { contentType: mimeFromExt(ext), upsert: false });
  if (error) throw new Error(`Upload failed for ${path.basename(localPath)}: ${error.message}`);
  return storagePath;
}

async function listStoragePhotos(supabase, prefix) {
  const paths = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase.storage
      .from("review-images")
      .list(prefix, { limit: 100, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error("Storage list: " + error.message);
    if (!data || data.length === 0) break;
    for (const f of data) paths.push(`${prefix}/${f.name}`);
    offset += data.length;
    if (data.length < 100) break;
  }
  return paths;
}

const BRACELET_SLUGS = [
  "bracelet-verdis-gold", "bracelet-verdis-silver",
  "bracelet-lumen-gold",  "bracelet-lumen-silver",
  "bracelet-noctis-gold", "bracelet-noctis-silver",
];
const NECKLACE_SLUGS = [
  "necklace-verdis-gold", "necklace-verdis-silver",
  "necklace-lumen-gold",  "necklace-lumen-silver",
  "necklace-noctis-gold", "necklace-noctis-silver",
];
const ALL_SLUGS = [...BRACELET_SLUGS, ...NECKLACE_SLUGS];

async function main() {
  const env = loadEnv();
  const supabaseUrl = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!supabaseUrl || !serviceKey) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  if (!fs.existsSync(REVIEWS_TXT)) throw new Error("Not found: " + REVIEWS_TXT);

  // ── 1. Parse ──────────────────────────────────────────────────────────────────
  console.log("Parsing 340.txt…");
  const reviews = parseFile(REVIEWS_TXT);
  const braceletCount = reviews.filter((r) => r.slug.startsWith("bracelet-")).length;
  const necklaceCount = reviews.filter((r) => r.slug.startsWith("necklace-")).length;
  console.log(`  Bracelet: ${braceletCount}  Necklace: ${necklaceCount}  Total: ${reviews.length}`);
  if (reviews.length !== 340) console.warn(`  ⚠️  Expected 340, got ${reviews.length}`);

  // ── 2. Delete existing ────────────────────────────────────────────────────────
  console.log("\nDeleting existing clover reviews…");
  const { error: delErr, count: delCount } = await supabase
    .from("reviews").delete({ count: "exact" }).in("product_slug", ALL_SLUGS);
  if (delErr) throw new Error("Delete failed: " + delErr.message);
  console.log(`  Deleted ${delCount ?? "?"} rows`);

  // ── 3. Insert all 340 ─────────────────────────────────────────────────────────
  console.log("\nInserting 340 reviews (photos attached next)…");
  const timestamps = distributeTimestamps(reviews.length);
  const rows = reviews.map((r, idx) => ({
    product_slug: r.slug,
    name: r.name,
    rating: r.rating,
    body: r.body,
    images: [],
    status: "approved",
    is_partnership: false,
    created_at: timestamps[idx],
  }));

  const BATCH = 50;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await supabase.from("reviews").insert(rows.slice(i, i + BATCH));
    if (error) throw new Error(`Insert batch ${Math.floor(i / BATCH) + 1}: ${error.message}`);
    inserted += Math.min(BATCH, rows.length - i);
    process.stdout.write(`  Inserted ${inserted}/${rows.length}\r`);
  }
  console.log(`\n✓ Inserted ${inserted} reviews`);

  // ── 4. Upload necklace photos + link to reviews [101]-[106] ───────────────────
  const NECKLACE_PHOTO_DIR = path.join(PHOTOS_DIR, "necklaces");
  const necklaceTagged = reviews.filter((r) => r.slug.startsWith("necklace-") && r.photoFilename);
  console.log(`\nUploading ${necklaceTagged.length} necklace photos…`);

  for (const rev of necklaceTagged) {
    const localPath = path.join(NECKLACE_PHOTO_DIR, rev.photoFilename);
    if (!fs.existsSync(localPath)) {
      console.warn(`  ⚠️  Not found: necklaces/${rev.photoFilename} — skipping`);
      continue;
    }
    try {
      const storagePath = await uploadPhoto(supabase, localPath, "necklaces");
      // Find the review row by name + slug
      const { data: rows } = await supabase
        .from("reviews").select("id").eq("name", rev.name).eq("product_slug", rev.slug).limit(1);
      if (rows && rows.length > 0) {
        await supabase.from("reviews").update({ images: [storagePath] }).eq("id", rows[0].id);
        console.log(`  ✓ ${rev.name} (${rev.slug}) ← ${rev.photoFilename}`);
      }
    } catch (e) {
      console.warn(`  ✗ ${rev.photoFilename}: ${e.message}`);
    }
  }

  // ── 5. Upload bracelet tagged photos + link to reviews [107]-[115] ────────────
  const BRACELET_PHOTO_DIR = path.join(PHOTOS_DIR, "bracelet reviews");
  const braceletTagged = reviews.filter((r) => r.slug.startsWith("bracelet-") && r.photoFilename);
  console.log(`\nUploading ${braceletTagged.length} tagged bracelet photos…`);

  for (const rev of braceletTagged) {
    const localPath = path.join(BRACELET_PHOTO_DIR, rev.photoFilename);
    if (!fs.existsSync(localPath)) {
      console.warn(`  ⚠️  Not found: bracelet reviews/${rev.photoFilename} — skipping`);
      continue;
    }
    try {
      const storagePath = await uploadPhoto(supabase, localPath, "bracelets");
      const { data: rows } = await supabase
        .from("reviews").select("id").eq("name", rev.name).eq("product_slug", rev.slug).limit(1);
      if (rows && rows.length > 0) {
        await supabase.from("reviews").update({ images: [storagePath] }).eq("id", rows[0].id);
        console.log(`  ✓ ${rev.name} (${rev.slug}) ← ${rev.photoFilename}`);
      }
    } catch (e) {
      console.warn(`  ✗ ${rev.photoFilename}: ${e.message}`);
    }
  }

  // ── 6. Fetch already-uploaded bracelet photos + distribute to remaining ────────
  console.log("\nFetching bracelet photos from Storage…");
  const allBraceletPaths = await listStoragePhotos(supabase, "bracelets");
  console.log(`  ${allBraceletPaths.length} photos total in Storage (bracelets/)`);

  // Find out which reviews already have a photo (the ones we just linked)
  const { data: alreadyLinked } = await supabase
    .from("reviews").select("images").in("product_slug", BRACELET_SLUGS).not("images", "eq", "{}");
  const usedPaths = new Set((alreadyLinked ?? []).flatMap((r) => r.images ?? []));
  const remainingPaths = allBraceletPaths.filter((p) => !usedPaths.has(p));
  console.log(`  ${usedPaths.size} already linked, ${remainingPaths.length} available to distribute`);

  if (remainingPaths.length > 0) {
    console.log("\nDistributing remaining photos to bracelet full-text reviews…");
    const photosPerSlug = Math.ceil(remainingPaths.length / BRACELET_SLUGS.length);
    let photoIdx = 0;
    let totalUpdated = 0;

    for (const slug of BRACELET_SLUGS) {
      const { data: targets } = await supabase
        .from("reviews").select("id")
        .eq("product_slug", slug).eq("status", "approved")
        .not("body", "is", null)
        .eq("images", "{}")           // only those without a photo yet
        .order("created_at", { ascending: false })
        .limit(50);

      const slugPhotos = remainingPaths.slice(photoIdx, photoIdx + photosPerSlug);
      photoIdx += photosPerSlug;

      const count = Math.min(slugPhotos.length, (targets ?? []).length);
      for (let i = 0; i < count; i++) {
        const { error } = await supabase.from("reviews").update({ images: [slugPhotos[i]] }).eq("id", targets[i].id);
        if (!error) totalUpdated++;
      }
      console.log(`  ${slug}: ${count} photos`);
    }
    console.log(`✓ Distributed ${totalUpdated} additional photos`);
  }

  await showStats(supabase);
}

async function showStats(supabase) {
  const { data } = await supabase
    .from("reviews").select("product_slug, body, images")
    .in("product_slug", [...BRACELET_SLUGS, ...NECKLACE_SLUGS]).eq("status", "approved");

  const bySlug = {};
  for (const r of data ?? []) {
    if (!bySlug[r.product_slug]) bySlug[r.product_slug] = { total: 0, ft: 0, photo: 0 };
    bySlug[r.product_slug].total++;
    if (r.body) bySlug[r.product_slug].ft++;
    if (r.images && r.images.length > 0) bySlug[r.product_slug].photo++;
  }

  console.log("\n" + "product_slug".padEnd(28) + "total".padStart(7) + "full_text".padStart(11) + "photos".padStart(8));
  console.log("-".repeat(56));
  for (const [slug, s] of Object.entries(bySlug)) {
    console.log(slug.padEnd(28) + String(s.total).padStart(7) + String(s.ft).padStart(11) + String(s.photo).padStart(8));
  }
  const grand = Object.values(bySlug).reduce((s, v) => s + v.total, 0);
  console.log(`\n✓ Total approved reviews: ${grand}`);
  console.log("Done.");
}

main().catch((e) => { console.error("Error:", e.message); process.exit(1); });
