// Panel: where customers get stuck in the checkout (rows written by /api/checkout-event, table checkout_events). Pure summary, no server imports.
export type CheckoutEventRow = {
  created_at: string; market: string; kind: string; fields?: string[] | null; code?: string | null; status?: number | null;
  delivery?: string | null; width?: number | null;
};
export type StuckSummary = {
  total: number;
  byField: { market: string; field: string; n: number }[];      // validation stops: which field
  byServer: { market: string; code: string; n: number }[];      // the server refused the order: which code
  network: number;
  last: CheckoutEventRow[];
};

export function summarizeEvents(rows: CheckoutEventRow[], sinceMs: number): StuckSummary {
  const inWindow = rows.filter((r) => Date.parse(r.created_at) >= sinceMs).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  const f = new Map<string, number>(), s = new Map<string, number>();
  let network = 0;
  for (const r of inWindow) {
    if (r.kind === "validation") for (const field of r.fields ?? []) f.set(`${r.market}|${field}`, (f.get(`${r.market}|${field}`) ?? 0) + 1);
    else if (r.kind === "server") { const k = `${r.market}|${r.code || r.status || "?"}`; s.set(k, (s.get(k) ?? 0) + 1); }
    else if (r.kind === "network") network++;
  }
  const out = <T,>(m: Map<string, number>, mk: (a: string, b: string, n: number) => T) => [...m.entries()].map(([k, n]) => { const [a, b] = k.split("|"); return mk(a, b, n); });
  return {
    total: inWindow.length,
    byField: out(f, (market, field, n) => ({ market, field, n })).sort((a, b) => b.n - a.n),
    byServer: out(s, (market, code, n) => ({ market, code, n })).sort((a, b) => b.n - a.n),
    network,
    last: inWindow.slice(0, 6),
  };
}
