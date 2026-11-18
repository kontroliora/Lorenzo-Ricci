import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { supabase } from "@/lib/supabase";
import { RESERVING_STATUSES_LEGACY } from "@/lib/order-status";
import { isRoOrder } from "@/lib/market";
import { modeOfSession } from "@/lib/stripe-mode";
import { getProductBySlug } from "@/lib/products";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// "Мария от Пловдив закупи …" toasts (components/ui/SalesNotification.tsx) - ONLY real orders (owner, 18.11.2026; the old
// hardcoded list is gone). An order is used when:
//   - placed in the last 7 days, Bulgarian shop (no /ro, no international test orders);
//   - status new / confirmed / shipped / completed (never cancelled, returned, or an open / dead card attempt), not refused on
//     the confirmation call, not marked "Фалшива" (excluded_from_stock), and a card order only once paid with a live card;
//   - one of its lines (gift lines left out) is a product that is in the shop AND in stock right now (wallet_inventory > 0) -
//     a sold-out piece is never shown, even if it was bought.
// What goes out: the city of the order (for an Econt office it is the office's city), the first name only (or none -> "Клиент"),
// the product, its photo and the real order time. Never a surname, phone, address, e-mail or the order number; the id is a hash.
// No orders -> an empty list, and the toast shows nothing. Vercel's CDN keeps the answer 5 minutes.
const CDN_CACHE = "public, max-age=0, s-maxage=300, stale-while-revalidate=300";
const DAYS = 7;
const MAX = 20;

type Row = {
  id: number; name: string | null; city: string | null; items: unknown; created_at: string; status: string;
  call_state?: string | null; excluded_from_stock?: boolean | null; is_international?: boolean | null;
  ship_country?: string | null; order_ref?: string | null;
  payment_method?: string | null; payment_status?: string | null; stripe_session_id?: string | null;
};

const BASE = "id, name, city, items, created_at, status, call_state, excluded_from_stock, is_international, ship_country, order_ref";
const PAY = "payment_method, payment_status, stripe_session_id";

/** First name only, when it looks like a name ("мария иванова" -> "Мария"); anything else -> null. */
function firstName(full: string | null): string | null {
  const w = String(full ?? "").trim().split(/\s+/)[0] ?? "";
  if (!/^[A-Za-zА-Яа-яЁёЪъЬьЮюЯя-]{2,20}$/.test(w) || /test|тест/i.test(w)) return null;
  return w.charAt(0).toLocaleUpperCase("bg") + w.slice(1).toLocaleLowerCase("bg");
}

/** "гр. софия " -> "София"; empty or odd -> null. */
function cleanCity(c: string | null): string | null {
  const s = String(c ?? "").replace(/^\s*(гр\.?|град|с\.|село)\s*/i, "").replace(/\s+/g, " ").trim();
  if (s.length < 2 || s.length > 30 || /\d/.test(s)) return null;
  return s.split(/([ -])/).map((p) => (p.length > 1 ? p.charAt(0).toLocaleUpperCase("bg") + p.slice(1).toLocaleLowerCase("bg") : p)).join("");
}

export async function GET() {
  try {
    const since = new Date(Date.now() - DAYS * 86400_000).toISOString();
    const query = (cols: string) =>
      supabaseAdmin().from("orders").select(cols).in("status", [...RESERVING_STATUSES_LEGACY]).gte("created_at", since)
        .order("created_at", { ascending: false }).limit(200);
    let res = await query(`${BASE}, ${PAY}`);
    if (res.error && /payment_|stripe_/.test(res.error.message)) res = await query(BASE); // payment columns not migrated
    if (res.error) throw new Error(res.error.message);

    const { data: stock } = await supabase.from("wallet_inventory").select("slug, stock");
    const left = new Map(((stock ?? []) as { slug: string; stock: number }[]).map((r) => [r.slug, Number(r.stock)]));
    if (!left.size) throw new Error("no stock rows"); // cannot tell what is in stock -> show nothing rather than a sold-out piece

    const out: { id: string; at: string; firstName: string | null; city: string; product: string; slug: string; image: string }[] = [];
    for (const o of (res.data ?? []) as unknown as Row[]) {
      if (out.length >= MAX) break;
      if (o.excluded_from_stock || o.is_international || isRoOrder(o)) continue;
      if (o.call_state === "refused") continue;
      if (o.payment_method === "card" && (o.payment_status !== "paid" || modeOfSession(o.stripe_session_id) !== "live")) continue;
      const city = cleanCity(o.city);
      if (!city || !Array.isArray(o.items)) continue;
      const line = (o.items as { slug?: unknown; gift?: unknown }[]).find((it) => {
        if (it.gift || typeof it.slug !== "string") return false;
        const p = getProductBySlug(it.slug);
        return !!p && p.inStock && (left.get(it.slug) ?? 0) > 0 && !!p.images?.[0]?.src;
      });
      if (!line) continue;
      const p = getProductBySlug(String(line.slug))!;
      out.push({
        id: createHash("sha256").update(`lr-sp:${o.id}`).digest("hex").slice(0, 12),
        at: o.created_at,
        firstName: firstName(o.name),
        city,
        product: p.name,
        slug: p.slug,
        image: p.images[0].src,
      });
    }
    return NextResponse.json({ purchases: out }, { headers: { "Cache-Control": CDN_CACHE } });
  } catch (e) {
    console.error("[recent-purchases]", e instanceof Error ? e.message : e);
    return NextResponse.json({ purchases: [] }, { headers: { "Cache-Control": "public, max-age=0, s-maxage=120" } });
  }
}
