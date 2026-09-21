import type { Product } from "./types";

// Server-side price check for /api/order.
//
// The browser reports every unit price and the totals; the server used to take them on
// trust, so a stale tab (old prices) or a tampered request was accepted at whatever it
// claimed. This re-checks what the catalog knows: each line's unit price must equal the
// catalog price for its slug, and the goods subtotal is recomputed from the catalog.
//
// Bundle, promo and shipping RULES are deliberately not re-derived here. The client also
// reports their AMOUNTS (`discount` = bundles, `promoDiscount`, `shipping.cost`); those are
// taken as reported, but they must be non-negative, must not exceed the catalog subtotal,
// and must add up exactly:
//   catalogSubtotal − discount − promoDiscount = subtotal
//   subtotal + shipping.cost                   = total
// Anything else fails, and the caller answers 409 so the customer reloads.

const EPS = 0.01; // one cent — the client's own amounts are 2-decimal, float noise is ~1e-14

export type OrderPricing =
  | {
      ok: true;
      catalogSubtotal: number; // Σ catalog price × qty, before any discount
      subtotal: number;        // goods after bundle + promo discounts
      shippingCost: number;
      total: number;           // amount to collect — the value to report to Meta
    }
  | { ok: false; reason: string };

const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};
const round2 = (n: number) => Math.round(n * 100) / 100;

export function validateOrderPricing(
  order: Record<string, unknown>,
  findProduct: (slug: string) => Pick<Product, "price"> | undefined,
): OrderPricing {
  const items = order.items;
  if (!Array.isArray(items) || items.length === 0) return { ok: false, reason: "no items" };

  let catalogSubtotal = 0;
  for (const raw of items) {
    const it = (raw ?? {}) as Record<string, unknown>;
    const slug = typeof it.slug === "string" ? it.slug : "";
    const product = slug ? findProduct(slug) : undefined;
    if (!product) return { ok: false, reason: `unknown item "${slug}"` };

    // Same precedence as the stock guard (quantity, then qty); if both are sent they must agree.
    const q = num(it.quantity ?? it.qty ?? 1);
    const qAlt = it.quantity != null && it.qty != null ? num(it.qty) : q;
    if (q === null || !Number.isInteger(q) || q < 1 || qAlt !== q) {
      return { ok: false, reason: `bad quantity for ${slug}` };
    }

    const unit = num(it.price);
    if (unit === null || Math.abs(unit - product.price) >= EPS / 2) {
      return { ok: false, reason: `price mismatch for ${slug}: client ${String(it.price)}, catalog ${product.price}` };
    }
    catalogSubtotal += product.price * q;
  }

  const bundleDiscount = order.discount == null ? 0 : num(order.discount);
  const promoDiscount = order.promoDiscount == null ? 0 : num(order.promoDiscount);
  if (bundleDiscount === null || promoDiscount === null || bundleDiscount < 0 || promoDiscount < 0) {
    return { ok: false, reason: "bad discount amount" };
  }
  if (bundleDiscount + promoDiscount > catalogSubtotal + EPS) {
    return { ok: false, reason: "discounts exceed the catalog subtotal" };
  }

  const subtotal = num(order.subtotal);
  if (subtotal === null || Math.abs(catalogSubtotal - bundleDiscount - promoDiscount - subtotal) > EPS) {
    return { ok: false, reason: `subtotal mismatch: client ${String(order.subtotal)}, catalog-based ${round2(catalogSubtotal - bundleDiscount - promoDiscount)}` };
  }

  const shipping = (order.shipping ?? {}) as Record<string, unknown>;
  const shippingCost = num(shipping.cost);
  if (shippingCost === null || shippingCost < 0) return { ok: false, reason: "bad shipping cost" };

  const total = num(order.total);
  if (total === null || Math.abs(subtotal + shippingCost - total) > EPS) {
    return { ok: false, reason: `total mismatch: client ${String(order.total)}, expected ${round2(subtotal + shippingCost)}` };
  }

  return {
    ok: true,
    catalogSubtotal: round2(catalogSubtotal),
    subtotal: round2(catalogSubtotal - bundleDiscount - promoDiscount),
    shippingCost: round2(shippingCost),
    total: round2(catalogSubtotal - bundleDiscount - promoDiscount + shippingCost),
  };
}
