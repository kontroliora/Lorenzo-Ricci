import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { reconcileShippedOrders } from "@/lib/econt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// TEMPORARY verification of the approved return-detection fix. `mode=run` calls
// the SAME reconcile the daily cron calls (nothing extra), so LR-B0L1J7 lands in
// `returning` now instead of at 10:00 UTC. Snapshots the leather stock of that
// order's items before/after to prove nothing is restocked while `returning`.
const TOKEN = "vrt7k2m9x";
const REF = "LR-B0L1J7";
const IS_LEATHER = (s: string) => s.startsWith("wallet-") || s.startsWith("cardholder-");
const ORD = "order_ref, status, tracking_number, returning_at, restocked_at, restocked_source, items";

type Item = { slug?: string; quantity?: number; qty?: number; name?: string };

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("k") !== TOKEN) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = supabaseAdmin();

  const snap = async () => {
    const o = (await sb.from("orders").select(ORD).eq("order_ref", REF).single()).data as
      | { order_ref: string; status: string; tracking_number: string; returning_at: string | null; restocked_at: string | null; restocked_source: string | null; items: Item[] }
      | null;
    const slugs = (o?.items ?? []).map((i) => String(i.slug ?? "")).filter(Boolean);
    const wi = await sb.from("wallet_inventory").select("slug, stock").in("slug", slugs.length ? slugs : ["__none__"]);
    return {
      order: o ? { ref: o.order_ref, status: o.status, returning_at: o.returning_at, restocked_at: o.restocked_at, restocked_source: o.restocked_source } : null,
      items: (o?.items ?? []).map((i) => ({ slug: i.slug, name: i.name, qty: i.quantity ?? i.qty ?? 1, isLeather: IS_LEATHER(String(i.slug ?? "")) })),
      stock: (wi.data ?? []).reduce((m, r) => { const x = r as { slug: string; stock: number }; m[x.slug] = Number(x.stock); return m; }, {} as Record<string, number>),
    };
  };

  const before = await snap();
  if (req.nextUrl.searchParams.get("mode") !== "run") return NextResponse.json({ mode: "inspect", before });

  const result = await reconcileShippedOrders(sb);
  const after = await snap();

  const stockUnchanged = JSON.stringify(before.stock) === JSON.stringify(after.stock);
  return NextResponse.json({
    mode: "run",
    reconcileResult: { checked: result.checked, completed: result.completed, returned: result.returned, restocked: result.restocked },
    before, after,
    checks: {
      movedToReturning: after.order?.status === "returning",
      returningAtSet: !!after.order?.returning_at,
      notRestocked: after.order?.restocked_at == null,
      stockUnchanged,
    },
  });
}
