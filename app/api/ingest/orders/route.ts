import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual, createHash } from "crypto";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { newOrderRef } from "@/lib/order-ref";
import { sendChronobgNotify } from "@/lib/ingest-notify";

export const runtime = "nodejs";

// ── Rate limit: 30 req/min per IP (in-memory, resets on cold start) ──────────
const rateBuckets = new Map<string, number[]>();
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const window = 60_000;
  const max = 30;
  const times = (rateBuckets.get(ip) ?? []).filter((t) => now - t < window);
  if (times.length >= max) return false;
  times.push(now);
  rateBuckets.set(ip, times);
  return true;
}

// ── Auth ──────────────────────────────────────────────────────────────────────
function checkBearer(req: NextRequest): boolean {
  const secret = process.env.ORDER_WEBHOOK_SECRET ?? "";
  if (!secret) return false;
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || token.length !== secret.length) return false;
  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(secret));
  } catch {
    return false;
  }
}

// ── Zod schema ────────────────────────────────────────────────────────────────
const ItemSchema = z.object({
  handle: z.string().optional(),
  no: z.string().optional(),
  title: z.string().optional(),
  qty: z.number().int().positive().optional(),
  unit_price: z.number().nonnegative().optional(),
});

const IngestSchema = z.object({
  source: z.string().min(1),
  order_ref: z.string().optional(),
  created_at: z.string().optional(),
  customer: z.object({
    name: z.string().min(1),
    phone: z.string().min(6),
    email: z.string().email().optional().or(z.literal("")).optional(),
  }),
  delivery: z.object({
    city: z.string().optional(),
    econt_office: z.string().optional(),
  }).optional(),
  payment: z.string().optional(),
  items: z.array(ItemSchema).optional(),
  subtotal: z.number().nonnegative().optional(),
  shipping: z.number().nonnegative().optional(),
  total: z.number().nonnegative().optional(),
  order_summary: z.string().optional(),
});

type IngestPayload = z.infer<typeof IngestSchema>;

// ── order_summary parser ──────────────────────────────────────────────────────
// Formats:
//   "N. Артикул #XXX — Заглавие"
//   "Количество: Q бр. × €P = €S"
//   "Междинна сума: €X"
//   "Доставка с Еконт: €Y"
//   "ОБЩО ЗА ПЛАЩАНЕ: €Z"
type ParsedItem = { handle: string; no: string; title: string; qty: number; unit_price: number };
type ParsedSummary = {
  items: ParsedItem[];
  subtotal: number | null;
  shipping: number | null;
  total: number | null;
  ok: boolean;
};

function parseOrderSummary(text: string): ParsedSummary {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const items: ParsedItem[] = [];
  let subtotal: number | null = null;
  let shipping: number | null = null;
  let total: number | null = null;

  let pendingItem: Partial<ParsedItem> | null = null;

  for (const line of lines) {
    // "1. Артикул #golden-eclipse-watch — Golden Eclipse Watch"
    const headerMatch = line.match(/^\d+\.\s+Артикул\s+#([^\s—–-]+)\s*[—–-]+\s*(.+)$/);
    if (headerMatch) {
      if (pendingItem?.handle) items.push(pendingItem as ParsedItem);
      pendingItem = { handle: headerMatch[1].trim(), no: headerMatch[1].trim(), title: headerMatch[2].trim() };
      continue;
    }
    // "Количество: 2 бр. × €89.00 = €178.00"
    const qtyMatch = line.match(/Количество:\s*(\d+)\s*бр\.\s*×\s*€([\d.,]+)/);
    if (qtyMatch && pendingItem) {
      pendingItem.qty = parseInt(qtyMatch[1], 10);
      pendingItem.unit_price = parseFloat(qtyMatch[2].replace(",", "."));
      items.push(pendingItem as ParsedItem);
      pendingItem = null;
      continue;
    }
    // "Междинна сума: €178.00"
    const subMatch = line.match(/Междинна сума:\s*€([\d.,]+)/i);
    if (subMatch) { subtotal = parseFloat(subMatch[1].replace(",", ".")); continue; }
    // "Доставка с Еконт: €5.99"
    const shipMatch = line.match(/Доставка.*?:\s*€([\d.,]+)/i);
    if (shipMatch) { shipping = parseFloat(shipMatch[1].replace(",", ".")); continue; }
    // "ОБЩО ЗА ПЛАЩАНЕ: €183.99"
    const totalMatch = line.match(/ОБЩО ЗА ПЛАЩАНЕ:\s*€([\d.,]+)/i);
    if (totalMatch) { total = parseFloat(totalMatch[1].replace(",", ".")); continue; }
  }
  if (pendingItem?.handle) items.push(pendingItem as ParsedItem);

  return {
    items,
    subtotal,
    shipping,
    total,
    ok: items.length > 0 || total !== null,
  };
}

// ── Idempotency key ───────────────────────────────────────────────────────────
function makeExternalId(payload: IngestPayload): string {
  if (payload.order_ref) return payload.order_ref;
  const seed = [
    payload.source,
    payload.customer.phone,
    payload.created_at ?? "",
    payload.order_summary ?? "",
  ].join("|");
  return createHash("sha256").update(seed).digest("hex");
}

// ── Handler ───────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ ok: false, error: "Rate limit exceeded" }, { status: 429 });
  }

  if (!checkBearer(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = IngestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Validation error", details: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  // Normalize phone: +359XXXXXXXXX → 0XXXXXXXXX; 359XXXXXXXXX → 0XXXXXXXXX
  const rawPhone = data.customer.phone;
  const phone = (() => {
    let d = rawPhone.replace(/[\s()/-]/g, "");
    if (d.startsWith("+359")) d = "0" + d.slice(4);
    else if (d.startsWith("00359")) d = "0" + d.slice(5);
    else if (d.startsWith("359") && d.length === 12) d = "0" + d.slice(3);
    return d || rawPhone;
  })();

  // Resolve items + totals
  let items: Array<{ handle?: string; no?: string; title?: string; qty: number; unit_price: number }>;
  let subtotal = data.subtotal ?? null;
  let shipping = data.shipping ?? null;
  let total = data.total ?? null;
  let needs_review = false;

  if (data.items?.length) {
    items = data.items.map((it) => ({
      handle: it.handle, no: it.no, title: it.title, qty: it.qty ?? 1, unit_price: it.unit_price ?? 0,
    }));
  } else if (data.order_summary) {
    const p = parseOrderSummary(data.order_summary);
    if (p.ok) {
      items = p.items.map((it) => ({ handle: it.handle, no: it.no, title: it.title, qty: it.qty, unit_price: it.unit_price }));
      if (subtotal === null) subtotal = p.subtotal;
      if (shipping === null) shipping = p.shipping;
      if (total === null) total = p.total;
    } else {
      items = [];
      needs_review = true;
    }
  } else {
    items = [];
    needs_review = true;
  }

  // Map to orders.items format (uses name + slug for panel display)
  const orderItems = items.map((it) => ({
    name: it.title ?? it.handle ?? "—",
    slug: it.handle ?? "",
    sku: it.no ?? "",
    quantity: it.qty,
    price: it.unit_price,
    currency: "€",
  }));

  const externalId = makeExternalId(data);
  const sourceSite = data.source; // e.g. "chronobg"
  const orderRef = newOrderRef("LR");
  const createdAt = data.created_at ?? new Date().toISOString();

  const sb = supabaseAdmin();

  // Check for duplicate
  const { data: existing } = await sb
    .from("orders")
    .select("id, order_ref")
    .eq("source_site", sourceSite)
    .eq("external_order_id", externalId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ ok: true, order_id: existing.id, order_number: existing.order_ref ?? externalId });
  }

  // Insert order (resilient: optional columns may not exist yet)
  const row: Record<string, unknown> = {
    order_ref: orderRef,
    source_site: sourceSite,
    external_order_id: externalId,
    needs_review,
    raw_payload: body as object,
    name: data.customer.name,
    phone,
    email: data.customer.email || null,
    city: data.delivery?.city ?? null,
    address: data.delivery?.econt_office ?? null,
    shipping_method: "econt",
    courier: "econt",
    items: orderItems,
    total,
    subtotal,
    shipping_cost: shipping,
    notes: null,
    status: "new",
    call_state: "pending",
    call_attempts: 0,
    excluded_from_stock: false,
    is_international: false,
    is_manual: false,
    created_at: createdAt,
    lang: "bg",
  };

  const { data: inserted, error } = await sb
    .from("orders")
    .insert(row)
    .select("id")
    .single();

  if (error) {
    // If the unique index fires (race condition), return 200 with existing
    if (error.code === "23505") {
      const { data: dup } = await sb.from("orders").select("id, order_ref").eq("source_site", sourceSite).eq("external_order_id", externalId).maybeSingle();
      if (dup) return NextResponse.json({ ok: true, order_id: dup.id, order_number: dup.order_ref ?? externalId });
    }
    console.error("[ingest/orders] insert error:", error.message);
    return NextResponse.json({ ok: false, error: "Database error" }, { status: 500 });
  }

  const orderId = (inserted as { id: number }).id;

  // Fire-and-forget: email notification — a failure must never lose the order
  sendChronobgNotify({
    orderId,
    orderRef,
    sourceSite,
    customer: { name: data.customer.name, phone, email: data.customer.email },
    delivery: { city: data.delivery?.city, econt_office: data.delivery?.econt_office },
    items: orderItems,
    total,
    payment: data.payment ?? "Наложен платеж",
    needsReview: needs_review,
  }).catch((e) => console.error("[ingest/orders] notify failed:", e instanceof Error ? e.message : e));

  return NextResponse.json({ ok: true, order_id: orderId, order_number: orderRef });
}
