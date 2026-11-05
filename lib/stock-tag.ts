// Cache tag of every server-side wallet_inventory read that ends up in a page (lib/live-stock.ts, lib/sold-out.ts).
// lib/stock-pages.ts revalidates it when a product sells out or comes back. Kept import-free so any module can use it.
export const STOCK_TAG = "stock";
