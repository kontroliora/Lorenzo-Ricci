import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { markRestocked, getRawStatuses } from "@/lib/econt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// TEMPORARY end-to-end verification of the returning → restocked feature. Runs a
// real cycle through the actual markRestocked() code on a throwaway test order +
// a real leather slug, then RESTORES the stock and DELETES the test order. Also
// re-checks the live Econt signal. Token-guarded; remove after use.
const TOKEN = "rsv9k2m4x";
const clean = (s: unknown) => String(s ?? "").replace(/\s+/g, "");

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("k") !== TOKEN) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = supabaseAdmin();
  const trace: Record<string, unknown> = {};

  // ── 0. Migration applied? ──────────────────────────────────────────────────
  const mig = await sb.from("orders").select("id, returning_at, restocked_at, restocked_source").limit(1);
  trace.columnsExist = !mig.error;
  if (mig.error) return NextResponse.json({ ok: false, step: "columns", error: mig.error.message, hint: "Step 2 (ADD COLUMN) not applied" });
  const retCount = await sb.from("orders").select("id", { count: "exact", head: true }).eq("status", "returning");
  trace.returningCount = retCount.count; // expect ~14 after Step 2's UPDATE

  // clear any leftover test orders from a previous failed run
  await sb.from("orders").delete().like("order_ref", "TEST-RSV%");

  // ── 1. Pick a real leather slug + note its stock ───────────────────────────
  const wi = await sb.from("wallet_inventory").select("slug, stock");
  const leather = (wi.data ?? []).find((r) => /^(wallet-|cardholder-)/.test(String((r as { slug: string }).slug)));
  if (!leather) return NextResponse.json({ ok: false, error: "no leather slug in wallet_inventory" });
  const slug = String((leather as { slug: string }).slug);
  const before = Number((leather as { stock: number }).stock);
  trace.leatherSlug = slug;
  trace.stockBefore = before;

  const stockOf = async (): Promise<number> => {
    const r = await sb.from("wallet_inventory").select("stock").eq("slug", slug).single();
    return Number((r.data as { stock: number } | null)?.stock);
  };
  const orderState = async (id: number) => {
    const r = await sb.from("orders").select("status, restocked_at, restocked_source").eq("id", id).single();
    return r.data;
  };

  // ── 2. Create a throwaway test order in `returning` ────────────────────────
  const ref = `TEST-RSV-${Date.now()}`;
  const ins = await sb.from("orders").insert({
    order_ref: ref, name: "TEST RESTOCK VERIFY", phone: "0000000000",
    items: [{ slug, name: "TEST", sku: "TEST", quantity: 1, price: 1, currency: "€" }],
    total: 1, status: "returning", returning_at: new Date().toISOString(), excluded_from_stock: true,
  }).select("id").single();
  if (ins.error) return NextResponse.json({ ok: false, step: "insert", error: ins.error.message, hint: "Step 1 (enum value 'returning') may not be committed" });
  const testId = Number((ins.data as { id: number }).id);
  trace.testOrderId = testId;

  try {
    // ── 3. FIRST trigger — button path (leather +1) ──────────────────────────
    const first = await markRestocked(sb, testId, "button", new Date().toISOString());
    trace.firstResult = first;                 // expect "done"
    trace.stockAfterFirst = await stockOf();   // expect before + 1
    trace.orderAfterFirst = await orderState(testId); // status restocked, restocked_at set

    // ── 4. SECOND trigger — cron path, must be blocked (idempotency) ─────────
    const second = await markRestocked(sb, testId, "cron", new Date().toISOString());
    trace.secondResult = second;               // expect "already"
    trace.stockAfterSecond = await stockOf();  // expect STILL before + 1
    trace.orderAfterSecond = await orderState(testId);

    trace.PASS_plus1_exactly = trace.stockAfterFirst === before + 1;
    trace.PASS_idempotent = second === "already" && trace.stockAfterSecond === before + 1;
    trace.PASS_timestamp_kept = (trace.orderAfterFirst as { restocked_at?: string })?.restocked_at === (trace.orderAfterSecond as { restocked_at?: string })?.restocked_at;

    // Item 5 — audit: the existing status-change trigger auto-logs the transition.
    const log = await sb.from("order_status_log").select("old_status, new_status, changed_by, change_number").eq("order_id", testId).order("change_number", { ascending: true });
    trace.auditLog = log.data; // expect one row: returning → restocked (changed_by null = service role; a real button press records Koko's uid)
  } finally {
    // ── 5. CLEANUP — restore stock, delete test order + its audit rows ───────
    await sb.from("wallet_inventory").update({ stock: before }).eq("slug", slug);
    await sb.from("order_status_log").delete().eq("order_id", testId);
    await sb.from("orders").delete().eq("id", testId);
    trace.stockRestored = await stockOf(); // expect before
    const gone = await sb.from("orders").select("id").eq("id", testId);
    trace.testOrderDeleted = (gone.data ?? []).length === 0;
  }

  // ── 6. Live Econt signal for the real returning orders ─────────────────────
  const ret = await sb.from("orders").select("order_ref, tracking_number").eq("status", "returning").not("tracking_number", "is", null).limit(14);
  const retRows = (ret.data ?? []) as { order_ref: string; tracking_number: string }[];
  const raws = await getRawStatuses(retRows.map((o) => o.tracking_number));
  trace.econtSignal = retRows.map((o) => {
    const raw = raws.get(clean(o.tracking_number)) as { deliveryTime?: number | null; shortDeliveryStatus?: string | null } | undefined;
    const dt = raw?.deliveryTime ?? null;
    return { ref: o.order_ref, shortStatus: raw?.shortDeliveryStatus ?? null, deliveryTime: dt != null ? new Date(Number(dt)).toISOString() : null, receivedSignal: dt != null };
  });
  trace.note = "The 14 legacy returns have returning_at=NULL → the cron leaves them for the button by design; econtSignal shows the deliveryTime the cron reads for FUTURE returns.";

  return NextResponse.json({ ok: true, trace });
}
