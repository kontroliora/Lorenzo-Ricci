import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// Plain Route Handler instead of a "use server" action: Server Actions are called via
// a build-specific action ID, which can go stale when the Next.js dev server hot-reloads
// after this endpoint's own fs.writeFileSync touches lib/products.ts (a file page.tsx
// statically imports) — the request then never reaches the handler at all, silently.
// A stable URL route doesn't have that failure mode (same pattern as /api/admin/inventory).

const VALID = new Set([10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70]);

function findProductSegment(src: string, slug: string) {
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
  if (thisStart === -1) return null;
  return { prefix: src.slice(0, thisStart), segment: src.slice(thisStart, nextStart), suffix: src.slice(nextStart) };
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { slug?: string; action?: "apply" | "remove"; pct?: number };
  const { slug, action } = body;
  if (!slug || (action !== "apply" && action !== "remove")) {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }

  const filePath = path.join(process.cwd(), "lib", "products.ts");
  const src = fs.readFileSync(filePath, "utf8");
  const found = findProductSegment(src, slug);
  if (!found) return NextResponse.json({ ok: false, error: "Product not found" }, { status: 404 });
  const { prefix, suffix } = found;
  let { segment } = found;

  if (action === "apply") {
    const pct = body.pct;
    if (typeof pct !== "number" || !VALID.has(pct)) {
      return NextResponse.json({ ok: false, error: `Valid: ${[...VALID].join(", ")}` }, { status: 400 });
    }

    const priceMatch = /^(\s*)(price:\s*)(\d+(?:\.\d+)?)(,)/m.exec(segment);
    if (!priceMatch) return NextResponse.json({ ok: false, error: "price field not found" }, { status: 500 });

    const indent = priceMatch[1];
    const currentPrice = parseFloat(priceMatch[3]);
    const newPrice = parseFloat((currentPrice * (1 - pct / 100)).toFixed(2));

    segment = segment.replace(/^(\s*price:\s*)(\d+(?:\.\d+)?)(,)/m, `$1${newPrice}$3`);

    if (/^\s*originalPrice:/m.test(segment)) {
      segment = segment.replace(/^(\s*originalPrice:\s*)(\d+(?:\.\d+)?)(,)/m, `$1${currentPrice}$3`);
    } else {
      segment = segment.replace(
        /^(\s*)(price:\s*\d+(?:\.\d+)?,)/m,
        `$1$2\n${indent}originalPrice: ${currentPrice},`
      );
    }

    fs.writeFileSync(filePath, prefix + segment + suffix, "utf8");
    return NextResponse.json({ ok: true, newPrice, originalPrice: currentPrice });
  }

  // action === "remove"
  const origMatch = /^\s*originalPrice:\s*(\d+(?:\.\d+)?),/m.exec(segment);
  if (!origMatch) return NextResponse.json({ ok: false, error: "No originalPrice on this product" }, { status: 400 });
  const restoredPrice = parseFloat(origMatch[1]);

  segment = segment.replace(/^(\s*price:\s*)(\d+(?:\.\d+)?)(,)/m, `$1${restoredPrice}$3`);
  segment = segment.replace(/^\s*originalPrice:\s*\d+(?:\.\d+)?,\r?\n/m, "");

  fs.writeFileSync(filePath, prefix + segment + suffix, "utf8");
  return NextResponse.json({ ok: true, restoredPrice });
}
