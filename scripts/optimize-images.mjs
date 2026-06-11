import { createRequire } from "module";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const PUBLIC = path.join(ROOT, "public");

// Ensure sharp is available
try {
  createRequire(import.meta.url)("sharp");
} catch {
  console.log("Installing sharp...");
  execSync("npm install sharp --save-dev", { cwd: ROOT, stdio: "inherit" });
}
const { default: sharp } = await import("sharp");

// Skip favicon-like files at the root that browsers require as PNG
const SKIP = new Set(["favicon.ico", "favicon.png"]);

function walk(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walk(full));
    else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if ([".png", ".jpg", ".jpeg"].includes(ext) && !SKIP.has(entry.name)) {
        results.push(full);
      }
    }
  }
  return results;
}

const images = walk(PUBLIC);
console.log(`\nFound ${images.length} images to process\n`);

let converted = 0, skipped = 0, failed = 0;
let totalOrigBytes = 0, totalWebpBytes = 0;
const successfulOriginals = [];

for (const src of images) {
  const ext = path.extname(src);
  const dest = src.slice(0, -ext.length) + ".webp";

  if (fs.existsSync(dest)) {
    skipped++;
    continue;
  }

  try {
    await sharp(src).webp({ quality: 85, effort: 4 }).toFile(dest);
    const origSize = fs.statSync(src).size;
    const newSize  = fs.statSync(dest).size;
    totalOrigBytes += origSize;
    totalWebpBytes += newSize;
    const pct = ((1 - newSize / origSize) * 100).toFixed(1);
    const rel = path.relative(PUBLIC, src);
    console.log(`  ✓  ${rel}  (${(origSize/1024).toFixed(0)}KB → ${(newSize/1024).toFixed(0)}KB, -${pct}%)`);
    successfulOriginals.push(src);
    converted++;
  } catch (err) {
    console.error(`  ✗  ${path.relative(PUBLIC, src)}: ${err.message}`);
    failed++;
  }
}

console.log(`\n── Summary ────────────────────────────`);
console.log(`  Converted : ${converted}`);
console.log(`  Skipped   : ${skipped} (WebP already existed)`);
console.log(`  Failed    : ${failed}`);
if (converted > 0) {
  const saved = totalOrigBytes - totalWebpBytes;
  console.log(`  Space saved: ${(saved/1024/1024).toFixed(1)} MB  (${(totalOrigBytes/1024/1024).toFixed(1)} MB → ${(totalWebpBytes/1024/1024).toFixed(1)} MB)`);
}

// Delete originals that were successfully converted
if (successfulOriginals.length > 0) {
  console.log(`\nDeleting ${successfulOriginals.length} original files...`);
  for (const f of successfulOriginals) {
    fs.unlinkSync(f);
  }
  console.log("Done.");
}

if (failed > 0) {
  console.error(`\nWARNING: ${failed} files failed to convert. Check output above.`);
  process.exit(1);
}
