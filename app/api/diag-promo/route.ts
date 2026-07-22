import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// TEMPORARY read-only. ZERO writes. Does the order carry the promo code at all,
// what did LR-W2LII0 actually use, and can past codes be recovered by email?
const TOKEN = "prm7k2m9x";
const REF = "LR-W2LII0";
const mask = (e: string | null) => { const [u, d] = String(e ?? "").split("@"); return u && d ? `${u[0]}${"*".repeat(Math.max(1, Math.min(u.length - 2, 4)))}${u[u.length - 1]}@${d}` : "—"; };

type Item = { name?: string; slug?: string; price?: number; quantity?: number; qty?: number };

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("k") !== TOKEN) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = supabaseAdmin();

  // 1) do the promo columns exist on orders?
  const probe = await sb.from("orders").select("promo_code, promo_discount").limit(1);
  const columnsExist = !probe.error;

  // 2) the order itself
  const cols = "order_ref, name, email, items, subtotal, total, status, created_at";
  const od = await sb.from("orders").select(columnsExist ? `${cols}, promo_code, promo_discount` : cols).eq("order_ref", REF).single();
  const o = od.data as (Record<string, unknown> & { items?: Item[]; email?: string | null; subtotal?: number | null; total?: number | null }) | null;
  const items = Array.isArray(o?.items) ? (o!.items as Item[]) : [];
  const goods = items.reduce((s, i) => s + (Number(i.price) || 0) * Math.max(1, Number(i.quantity ?? i.qty ?? 1)), 0);

  // 3) can we recover the code from the newsletter table by email?
  const email = String(o?.email ?? "").trim().toLowerCase();
  const nl = email ? await sb.from("newsletter_subscribers").select("email, promo_code, code_used, subscribed_at").eq("email", email).maybeSingle() : null;

  // 4) how many orders look discounted (sizing the gap)
  const all = await sb.from("orders").select("order_ref, email, items, subtotal, total, excluded_from_stock, created_at");
  type R = { order_ref: string | null; email: string | null; items: Item[]; subtotal: number | null; total: number | null; excluded_from_stock: boolean; created_at: string };
  const rows = ((all.data ?? []) as R[]).filter((r) => !r.excluded_from_stock);
  const discounted = rows
    .map((r) => {
      const g = (Array.isArray(r.items) ? r.items : []).reduce((s, i) => s + (Number(i.price) || 0) * Math.max(1, Number(i.quantity ?? i.qty ?? 1)), 0);
      const t = Number(r.total) || 0;
      return { ref: r.order_ref, email: r.email, goods: Math.round(g * 100) / 100, total: t, gap: Math.round((g - t) * 100) / 100, pct: g > 0 ? Math.round(((g - t) / g) * 1000) / 10 : 0, created: r.created_at };
    })
    .filter((x) => x.gap > 0.5);

  // of those, how many can be traced to a used newsletter code?
  const emails = Array.from(new Set(discounted.map((d) => String(d.email ?? "").trim().toLowerCase()).filter(Boolean)));
  const subs = emails.length ? await sb.from("newsletter_subscribers").select("email, promo_code, code_used").in("email", emails) : null;
  const subMap = new Map((subs?.data ?? []).map((s) => { const x = s as { email: string; promo_code: string; code_used: boolean }; return [x.email.toLowerCase(), x]; }));

  return NextResponse.json({
    Q1_isCodeStoredOnOrder: {
      promoColumnsExistOnOrders: columnsExist,
      probeError: probe.error?.message ?? null,
      verdict: columnsExist ? "code IS stored on the order" : "code is NOT stored — /api/order silently drops it (resilient fallback)",
    },
    Q2_theOrder: {
      order: o ? { ref: o.order_ref, name: o.name, email: mask(o.email ?? null), subtotal: o.subtotal, total: o.total, created_at: o.created_at, promo_code: o.promo_code ?? "(column missing)", promo_discount: o.promo_discount ?? "(column missing)" } : "(not found)",
      items: items.map((i) => ({ name: i.name, price: i.price, qty: i.quantity ?? i.qty ?? 1 })),
      goodsValue: Math.round(goods * 100) / 100,
      totalCharged: Number(o?.total ?? 0),
      gap: Math.round((goods - Number(o?.total ?? 0)) * 100) / 100,
      gapPct: goods > 0 ? Math.round(((goods - Number(o?.total ?? 0)) / goods) * 1000) / 10 : 0,
      recoveredFromNewsletter: nl?.data
        ? { promo_code: (nl.data as { promo_code: string }).promo_code, code_used: (nl.data as { code_used: boolean }).code_used, subscribed_at: (nl.data as { subscribed_at: string }).subscribed_at }
        : "(this email is not in newsletter_subscribers)",
    },
    Q3_scale: {
      ordersLookingDiscounted: discounted.length,
      recoverableViaNewsletterEmail: discounted.filter((d) => subMap.has(String(d.email ?? "").toLowerCase())).length,
      rows: discounted.map((d) => {
        const s = subMap.get(String(d.email ?? "").toLowerCase());
        return { ref: d.ref, goods: d.goods, total: d.total, gap: d.gap, pct: d.pct, recoveredCode: s ? s.promo_code : null, codeUsedFlag: s ? s.code_used : null };
      }),
    },
  });
}
