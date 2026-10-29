// Insert an order row so that an OPTIONAL column the database does not have yet (a migration not run) never loses the order:
// when PostgREST names an unknown column that is in `optional`, that column is dropped and the insert retried.
type InsertClient = { from: (t: string) => { insert: (row: Record<string, unknown>) => PromiseLike<{ error: { message: string } | null }> } };

export async function insertOrderResilient(sb: InsertClient, row: Record<string, unknown>, optional: readonly string[]) {
  let current = { ...row };
  for (let attempt = 0; attempt <= optional.length; attempt++) {
    const res = await sb.from("orders").insert(current);
    if (!res.error) return { error: null, dropped: Object.keys(row).filter((k) => !(k in current)) };
    const msg = res.error.message;
    const named = msg.match(/'([a-z_]+)' column/)?.[1] ?? optional.find((k) => k in current && msg.includes(k));
    if (!named || !optional.includes(named) || !(named in current)) return { error: res.error, dropped: [] as string[] };
    const { [named]: _gone, ...rest } = current; void _gone;
    current = rest;
  }
  return { error: { message: "insert failed after dropping optional columns" }, dropped: [] as string[] };
}
