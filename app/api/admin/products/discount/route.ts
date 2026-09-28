import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { getProductBySlug } from "@/lib/products";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { PRICE_OVERRIDES_TAG } from "@/lib/price-overrides";

// After every successful write, invalidate the price-overrides Data Cache entry
// (lib/price-overrides.ts) AND force-regenerate the specific static routes that
// show a price, so the storefront reflects the change within seconds — no redeploy,
// no force-dynamic rendering. This route is already gated by middleware.ts (any
// request under /api/admin/* requires an authenticated admin session), so there is
// no separate public revalidation endpoint.
function revalidateStorefront(slug: string) {
  revalidateTag(PRICE_OVERRIDES_TAG);
  revalidatePath("/");
  revalidatePath("/watches");
  revalidatePath("/leather-goods");
  revalidatePath("/jewellery");
  revalidatePath("/bundles");
  revalidatePath(`/products/${slug}`);
}

// Plain Route Handler (not a "use server" action) — same reasoning as before this
// rewrite: a stable URL route doesn't go stale across a hot-reload/deploy boundary
// the way a Server Action's build-specific action id can.
//
// Persistence: writes/deletes a row in product_price_overrides via supabaseAdmin()
// (service role, bypasses RLS) instead of fs.writeFileSync on lib/products.ts. That
// file lives in a read-only/ephemeral serverless container on Vercel — the write was
// silently lost on the next cold start or deploy, which was the "Не се записа" bug.
// See supabase/product_price_overrides.sql.
//
// Request/response contract — InventoryTable.tsx is the only caller:
//   POST { slug, action: "apply", type: "percent", pct }     → { ok: true, newPrice, originalPrice } | { ok: false, error }
//   POST { slug, action: "apply", type: "fixed", newPrice }  → { ok: true, newPrice, originalPrice } | { ok: false, error }
//   POST { slug, action: "remove" }                          → { ok: true, restoredPrice }           | { ok: false, error }

const VALID_PCT = new Set([10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70]);

type Body =
  | { slug: string; action: "apply"; type: "percent"; pct: number }
  | { slug: string; action: "apply"; type: "fixed"; newPrice: number }
  | { slug: string; action: "remove" };

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Partial<Body>;
  const { slug, action } = body;
  if (!slug || (action !== "apply" && action !== "remove")) {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }

  // lib/products.ts is the live catalog price — always the ground truth. When
  // applying a NEW discount on a product that's already discounted (a row already
  // exists), it must apply against the current CATALOG price, not the stale
  // original_price sitting in the override row, or discounts would compound.
  const product = getProductBySlug(slug);
  if (!product) return NextResponse.json({ ok: false, error: "Product not found" }, { status: 404 });
  const catalogPrice = product.price;

  if (action === "apply") {
    let newPrice: number;

    if (body.type === "fixed") {
      const requested = (body as { newPrice?: number }).newPrice;
      if (typeof requested !== "number" || !Number.isFinite(requested) || requested <= 0) {
        return NextResponse.json({ ok: false, error: "Невалидна цена" }, { status: 400 });
      }
      if (requested >= catalogPrice) {
        return NextResponse.json({ ok: false, error: `Трябва да е под €${catalogPrice}` }, { status: 400 });
      }
      newPrice = parseFloat(requested.toFixed(2));
    } else {
      const pct = (body as { pct?: number }).pct;
      if (typeof pct !== "number" || !VALID_PCT.has(pct)) {
        return NextResponse.json({ ok: false, error: `Valid: ${[...VALID_PCT].join(", ")}` }, { status: 400 });
      }
      newPrice = parseFloat((catalogPrice * (1 - pct / 100)).toFixed(2));
    }

    const { error } = await supabaseAdmin()
      .from("product_price_overrides")
      .upsert({ slug, price: newPrice, original_price: catalogPrice, updated_at: new Date().toISOString() });
    if (error) {
      console.error("[discount] upsert failed:", error.message);
      return NextResponse.json({ ok: false, error: "Грешка при запис" }, { status: 500 });
    }

    revalidateStorefront(slug);
    return NextResponse.json({ ok: true, newPrice, originalPrice: catalogPrice });
  }

  // action === "remove" — restore the plain catalog price by deleting the override row.
  const { error } = await supabaseAdmin().from("product_price_overrides").delete().eq("slug", slug);
  if (error) {
    console.error("[discount] delete failed:", error.message);
    return NextResponse.json({ ok: false, error: "Грешка при запис" }, { status: 500 });
  }

  revalidateStorefront(slug);
  return NextResponse.json({ ok: true, restoredPrice: catalogPrice });
}
