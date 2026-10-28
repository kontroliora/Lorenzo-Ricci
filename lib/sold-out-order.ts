// Sold-out products stay visible in normal browsing (owner, 28.10.2026: "visible but not buyable") but always come LAST in every
// grid and carousel, so they show the range without blocking sales. Stable: buyable products keep their order, then the sold-out
// ones in theirs. Pure (no server imports) so client sections with live stock can use it too. Recommendation spots
// (related products, cart cross-sell, set upsells, /namalenia, the sale banner) still leave sold-out products out completely.
export function soldOutLast<T extends { slug: string }>(list: readonly T[], isSold: (slug: string) => boolean): T[] {
  const buyable: T[] = [], sold: T[] = [];
  for (const p of list) (isSold(p.slug) ? sold : buyable).push(p);
  return [...buyable, ...sold];
}
