import { revalidateTag } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { STOCK_TAG } from "@/lib/stock-tag";

// The storefront pages (BG and /ro) are rebuilt hourly. What they say about availability - sold-out pieces left out of
// the home sections and "Подобни продукти", sold-out last in the listings, the product JSON-LD - comes from
// wallet_inventory reads tagged STOCK_TAG. Every place that moves stock calls this right after, and the pages are
// rebuilt at once, but only when a product crossed 0 (its last unit sold, or units came back to a sold-out product):
// an ordinary order costs no rebuild. The cards in the browser follow the live count on their own (/api/leather-stock).
// Never throws: stock has already moved, and a failed check refreshes the pages anyway.
export async function refreshStockPages(items: { slug: string; qty: number }[], direction: "reserved" | "restocked"): Promise<void> {
  const qty = new Map<string, number>();
  for (const i of items) if (i.slug) qty.set(i.slug, (qty.get(i.slug) ?? 0) + Math.max(1, Number(i.qty) || 1));
  if (!qty.size) return;
  try {
    const { data, error } = await supabaseAdmin().from("wallet_inventory").select("slug, stock").in("slug", [...qty.keys()]);
    if (error) throw new Error(error.message);
    const crossed = ((data ?? []) as { slug: string; stock: number }[]).some((r) => {
      const now = Number(r.stock);
      return direction === "reserved" ? now <= 0 : now - (qty.get(r.slug) ?? 0) <= 0;
    });
    if (crossed) revalidateTag(STOCK_TAG);
  } catch (e) {
    console.error("[stock-pages] availability check failed, refreshing anyway:", e instanceof Error ? e.message : e);
    try { revalidateTag(STOCK_TAG); } catch { /* outside a request: the hourly rebuild catches up */ }
  }
}

/** A stock number was set by hand (admin inventory): always refresh. */
export function refreshAllStockPages(): void {
  revalidateTag(STOCK_TAG);
}
