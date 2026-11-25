// Fulfillment-role order visibility (25.11.2026).
// Uses the SAME isCollectionLine predicate as the partner — one source of truth.
// Коко sees all orders EXCEPT those whose every paid line is a women's-collection piece.
// CHRONOBG orders are always visible (the partner does not handle them).

import { isCollectionLine } from "./partner/orders";
import type { OrderItem } from "./orders";

type OrderLike = { items?: OrderItem[] | null; source_site?: string | null };

/** True when the fulfillment role may see this order. */
export function fulfillmentVisible(order: OrderLike): boolean {
  if ((order.source_site ?? "lorenzo-ricci") === "chronobg") return true;
  const paid = (order.items ?? []).filter((it) => !it.gift);
  if (!paid.length) return true; // empty / manual order: visible
  const jCount = paid.filter(isCollectionLine).length;
  // Hidden ONLY when every paid line is a collection piece
  return jCount < paid.length;
}

/** True when the order contains at least one jewelry line (used for the badge). */
export function hasJewelleryLines(order: OrderLike): boolean {
  return (order.items ?? []).some(isCollectionLine);
}
