import type { Product } from "./types";
import { requiresPrepayment } from "./price";

// Catalog gates for /api/order that the browser can't be trusted with — a stale
// cart or a hand-made request skips the UI. Checked right after the price guard,
// before anything with a side effect:
//   • inStock: false in lib/products.ts is the owner's hard off switch — never
//     orderable, whatever the stock count says;
//   • a prepayment item (price ≥ PREPAYMENT_THRESHOLD_EUR) can't go through the
//     cash-on-delivery checkout.
// Unknown slugs are left to the price guard, which already refuses them.
export type OrderableCheck =
  | { ok: true }
  | { ok: false; code: "not_for_sale" | "prepayment_required"; names: string[] };

export function checkOrderable(
  items: { slug?: unknown }[],
  findProduct: (slug: string) => Product | undefined,
): OrderableCheck {
  const off: string[] = [];
  const prepay: string[] = [];
  for (const it of items) {
    const p = findProduct(String(it.slug ?? ""));
    if (!p) continue;
    if (!p.inStock) off.push(p.name);
    else if (requiresPrepayment(p)) prepay.push(p.name);
  }
  if (off.length) return { ok: false, code: "not_for_sale", names: off };
  if (prepay.length) return { ok: false, code: "prepayment_required", names: prepay };
  return { ok: true };
}
