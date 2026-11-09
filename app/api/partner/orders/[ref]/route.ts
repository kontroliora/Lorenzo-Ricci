import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { forbidden, noStore, partnerOrderRow, requirePartner } from "@/lib/partner/server";
import { PARTNER_SETTABLE, partnerView, type PartnerStatus } from "@/lib/partner/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** One of his orders (same projection as the list). */
export async function GET(req: NextRequest, ctx: { params: Promise<{ ref: string }> }) {
  const p = await requirePartner(req);
  if (p instanceof NextResponse) return p;
  const { ref } = await ctx.params;
  const row = await partnerOrderRow(ref);
  if (!row) return forbidden();
  const { data: st } = await supabaseAdmin().from("partner_order_state").select("status, note, updated_at").eq("order_ref", ref).maybeSingle();
  return NextResponse.json({ order: partnerView(row, st) }, { headers: noStore });
}

/**
 * The ONLY thing he may change: his status (Обадено / Потвърдено / Отказано / Не вдига) and his note, on an order he may see.
 * Written to partner_order_state (never to `orders`), every change logged in partner_status_log.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ ref: string }> }) {
  const p = await requirePartner(req);
  if (p instanceof NextResponse) return p;
  const { ref } = await ctx.params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const extra = Object.keys(body).filter((k) => k !== "status" && k !== "note");
  if (extra.length) return forbidden();                                   // any other field = not his to change
  const status = body.status as PartnerStatus | undefined;
  if (status !== undefined && !PARTNER_SETTABLE.includes(status)) return NextResponse.json({ error: "Невалиден статус" }, { status: 400 });
  if (body.note !== undefined && typeof body.note !== "string") return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 1000) : undefined;
  if (status === undefined && note === undefined) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const row = await partnerOrderRow(ref);
  if (!row) return forbidden();

  const sb = supabaseAdmin();
  const { data: prev } = await sb.from("partner_order_state").select("status, note").eq("order_ref", ref).maybeSingle();
  const next = { status: status ?? prev?.status ?? "new", note: note ?? prev?.note ?? null };
  const up = await sb.from("partner_order_state").upsert({ order_ref: ref, ...next, updated_at: new Date().toISOString(), updated_by: p.email }, { onConflict: "order_ref" })
    .select("status, note, updated_at").single();
  if (up.error) return NextResponse.json({ error: "Грешка при запис" }, { status: 500 });
  const log = await sb.from("partner_status_log").insert({
    order_ref: ref, old_status: prev?.status ?? "new", new_status: next.status, old_note: prev?.note ?? null, new_note: next.note,
    email: p.email, ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  });
  if (log.error) console.error("[partner] status log failed:", log.error.message);
  return NextResponse.json({ order: partnerView(row, up.data) }, { headers: noStore });
}

export const PUT = async () => forbidden();
export const PATCH = async () => forbidden();
export const DELETE = async () => forbidden();
