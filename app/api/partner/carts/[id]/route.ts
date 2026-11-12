import { NextRequest, NextResponse } from "next/server";
import { forbidden, noStore, requirePartner } from "@/lib/partner/server";
import { PARTNER_BY, partnerCarts } from "@/lib/partner/carts";
import { CART_OUTCOMES, recordCartCall, saveCartNote } from "@/lib/cart-calls";
import type { CartCallState } from "@/lib/abandoned-carts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// His call result and / or note on ONE cart of his list. Only { outcome, note }: anything else, or a cart that is not in his list
// (no women's piece, gone, someone else's), is a 403. No Telegram, no e-mail.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const p = await requirePartner(req);
  if (p instanceof NextResponse) return p;
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object" || Object.keys(body).some((k) => k !== "outcome" && k !== "note")) return forbidden();
  const outcome = body.outcome as CartCallState | undefined;
  if (outcome !== undefined && !CART_OUTCOMES.includes(outcome)) return NextResponse.json({ error: "Невалиден избор" }, { status: 400, headers: noStore });
  if (body.note !== undefined && typeof body.note !== "string") return NextResponse.json({ error: "Невалидна бележка" }, { status: 400, headers: noStore });
  if (outcome === undefined && body.note === undefined) return NextResponse.json({ error: "Нищо за запис" }, { status: 400, headers: noStore });

  const mine = (await partnerCarts()).find((c) => c.id === id);
  if (!mine) return forbidden();
  const err = (body.note !== undefined ? await saveCartNote(id, String(body.note), PARTNER_BY) : null)
    ?? (outcome ? await recordCartCall(id, outcome, PARTNER_BY) : null);
  if (err) return NextResponse.json({ error: err }, { status: 500, headers: noStore });
  const after = (await partnerCarts()).find((c) => c.id === id) ?? null;   // null = it left his list ("не иска", 2x "не вдига")
  return NextResponse.json({ ok: true, cart: after }, { headers: noStore });
}

export const GET = () => forbidden();
export const PUT = () => forbidden();
export const PATCH = () => forbidden();
export const DELETE = () => forbidden();
