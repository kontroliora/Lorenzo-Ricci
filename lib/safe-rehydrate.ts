// Restore a persisted zustand store (skipHydration) without ever breaking the page.
// When the browser blocks storage (localStorage throws: storage disabled, some privacy modes, sandboxed crawlers), zustand's
// persist middleware returns the plain store WITHOUT `.persist`, so `store.persist.rehydrate()` threw
// "Cannot read properties of undefined (reading 'rehydrate')" in an effect and React unmounted the page (alert 16.11.2026,
// /products/necklace-lumen-gold). Here: no persist API or any failure = keep the in-memory cart (empty after a reload);
// add to cart keeps working, the cart is just not saved between reloads.
type Persisted = { persist?: { rehydrate: () => Promise<void> | void } };

export async function safeRehydrate(store: Persisted, after?: () => Promise<void> | void): Promise<void> {
  try {
    if (typeof store.persist?.rehydrate !== "function") return;
    await store.persist.rehydrate();
  } catch {
    return; // unreadable saved cart: start from the empty in-memory cart
  }
  try {
    await after?.();
  } catch { /* the re-check failed (offline etc.): keep the restored lines; the order routes check them again */ }
}
