"use server";
import fs from "fs";
import path from "path";

const VALID = new Set([10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70]);

export async function applyProductDiscount(
  slug: string,
  pct: number
): Promise<
  | { ok: true; newPrice: number; originalPrice: number }
  | { ok: false; error: string }
> {
  if (!VALID.has(pct)) return { ok: false, error: `Valid: ${[...VALID].join(", ")}` };

  const filePath = path.join(process.cwd(), "lib", "products.ts");
  const src = fs.readFileSync(filePath, "utf8");

  // Find this product's section: from its slug line to the next slug line
  const slugRx = /slug:\s*["']([^"']+)["']/g;
  let thisStart = -1;
  let nextStart = src.length;
  let m: RegExpExecArray | null;

  while ((m = slugRx.exec(src)) !== null) {
    if (m[1] === slug) {
      thisStart = m.index;
    } else if (thisStart !== -1) {
      nextStart = m.index;
      break;
    }
  }

  if (thisStart === -1) return { ok: false, error: "Product not found" };

  const prefix = src.slice(0, thisStart);
  let segment = src.slice(thisStart, nextStart);
  const suffix = src.slice(nextStart);

  // Extract current price and its indentation
  const priceMatch = /^(\s*)(price:\s*)(\d+(?:\.\d+)?)(,)/m.exec(segment);
  if (!priceMatch) return { ok: false, error: "price field not found" };

  const indent = priceMatch[1];
  const currentPrice = parseFloat(priceMatch[3]);
  const newPrice = parseFloat((currentPrice * (1 - pct / 100)).toFixed(2));

  // Replace price value
  segment = segment.replace(
    /^(\s*price:\s*)(\d+(?:\.\d+)?)(,)/m,
    `$1${newPrice}$3`
  );

  // Update or insert originalPrice
  if (/^\s*originalPrice:/m.test(segment)) {
    segment = segment.replace(
      /^(\s*originalPrice:\s*)(\d+(?:\.\d+)?)(,)/m,
      `$1${currentPrice}$3`
    );
  } else {
    // Insert originalPrice on the line immediately after price:
    segment = segment.replace(
      /^(\s*price:\s*\d+(?:\.\d+)?,)/m,
      `$1\n${indent}originalPrice: ${currentPrice},`
    );
  }

  fs.writeFileSync(filePath, prefix + segment + suffix, "utf8");
  return { ok: true, newPrice, originalPrice: currentPrice };
}

export async function removeProductDiscount(
  slug: string
): Promise<{ ok: true; restoredPrice: number } | { ok: false; error: string }> {
  const filePath = path.join(process.cwd(), "lib", "products.ts");
  const src = fs.readFileSync(filePath, "utf8");

  const slugRx = /slug:\s*["']([^"']+)["']/g;
  let thisStart = -1;
  let nextStart = src.length;
  let m: RegExpExecArray | null;

  while ((m = slugRx.exec(src)) !== null) {
    if (m[1] === slug) {
      thisStart = m.index;
    } else if (thisStart !== -1) {
      nextStart = m.index;
      break;
    }
  }

  if (thisStart === -1) return { ok: false, error: "Product not found" };

  const prefix = src.slice(0, thisStart);
  let segment = src.slice(thisStart, nextStart);
  const suffix = src.slice(nextStart);

  const origMatch = /^\s*originalPrice:\s*(\d+(?:\.\d+)?),/m.exec(segment);
  if (!origMatch) return { ok: false, error: "No originalPrice on this product" };
  const restoredPrice = parseFloat(origMatch[1]);

  // Restore price to originalPrice value
  segment = segment.replace(
    /^(\s*price:\s*)(\d+(?:\.\d+)?)(,)/m,
    `$1${restoredPrice}$3`
  );

  // Remove the originalPrice line entirely
  segment = segment.replace(/^\s*originalPrice:\s*\d+(?:\.\d+)?,\r?\n/m, "");

  fs.writeFileSync(filePath, prefix + segment + suffix, "utf8");
  return { ok: true, restoredPrice };
}
