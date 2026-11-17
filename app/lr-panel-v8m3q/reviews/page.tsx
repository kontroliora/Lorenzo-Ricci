import Link from "next/link";
import { AdminNav } from "@/components/admin/AdminNav";
import { isOwner } from "@/lib/admin-auth";
import { adminDb } from "@/lib/supabase/admin-db";
import { getCatalogProductBySlug } from "@/lib/products";
import { reviewImageUrl } from "@/lib/user-reviews-server";
import { logout } from "../actions";
import { ReviewsBoard, type AdminReview } from "./ReviewsBoard";

export const dynamic = "force-dynamic";

// "Ревюта": the moderation queue (owner + employee). Pending / Approved / Rejected, every review with product, name, rating, text,
// photos, e-mail and date, and the buttons of ./actions.ts. The owner also sees the log of who did what.
const STATUSES = [
  { key: "pending", label: "Чакащи" },
  { key: "approved", label: "Одобрени" },
  { key: "rejected", label: "Отхвърлени" },
] as const;
type Key = (typeof STATUSES)[number]["key"];

const ACTION_LABEL: Record<string, string> = {
  approved: "Одобри", rejected: "Отхвърли", edited: "Редактира текста на", partnership_on: "Отбеляза като партньорско", partnership_off: "Махна „Партньорство“ от", deleted: "Изтри",
};
const ROLE_LABEL: Record<string, string> = { owner: "собственик", employee: "служител" };
const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("bg-BG", { timeZone: "Europe/Sofia", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");

type Row = {
  id: string; product_slug: string; name: string; rating: number; body: string; images: string[] | null; email: string | null; status: string;
  is_partnership: boolean; created_at: string; moderated_at: string | null; moderated_by: string | null;
};
type LogRow = { review_id: string; product_slug: string | null; review_name: string | null; action: string; actor_email: string | null; actor_role: string | null; created_at: string };

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const { s } = await searchParams;
  const tab: Key = STATUSES.some((x) => x.key === s) ? (s as Key) : "pending";
  const sb = await adminDb();
  const owner = await isOwner();

  const [list, c1, c2, c3] = await Promise.all([
    sb.from("reviews")
      .select("id, product_slug, name, rating, body, images, email, status, is_partnership, created_at, moderated_at, moderated_by")
      .eq("status", tab).order("created_at", { ascending: tab !== "pending" ? false : true }).limit(300),
    ...STATUSES.map((x) => sb.from("reviews").select("id", { count: "exact", head: true }).eq("status", x.key)),
  ]);
  const counts: Record<Key, number> = { pending: c1.count ?? 0, approved: c2.count ?? 0, rejected: c3.count ?? 0 };
  const rows = (list.data ?? []) as Row[];

  // Who moderated each shown review: the latest approve / reject line of the log (role: owner or employee).
  const ids = rows.map((r) => r.id);
  const roleOf = new Map<string, string>();
  if (ids.length) {
    const { data } = await sb.from("review_audit_log").select("review_id, action, actor_role, created_at").in("review_id", ids).in("action", ["approved", "rejected"]).order("created_at", { ascending: false });
    for (const l of (data ?? []) as { review_id: string; actor_role: string | null }[]) if (!roleOf.has(l.review_id) && l.actor_role) roleOf.set(l.review_id, l.actor_role);
  }

  const reviews: AdminReview[] = rows.map((r) => {
    const p = getCatalogProductBySlug(r.product_slug);
    return {
      id: r.id, productSlug: r.product_slug, productName: p?.name ?? r.product_slug, name: r.name, rating: r.rating, body: r.body,
      images: (r.images ?? []).map(reviewImageUrl), email: r.email, status: r.status as Key, isPartnership: r.is_partnership,
      createdAt: fmt(r.created_at),
      moderatedAt: r.moderated_at ? fmt(r.moderated_at) : null, moderatedBy: r.moderated_by,
      moderatedRole: roleOf.has(r.id) ? (ROLE_LABEL[roleOf.get(r.id)!] ?? null) : null,
    };
  });

  let log: LogRow[] = [];
  if (owner) {
    const { data } = await sb.from("review_audit_log").select("review_id, product_slug, review_name, action, actor_email, actor_role, created_at").order("created_at", { ascending: false }).limit(50);
    log = (data ?? []) as LogRow[];
  }

  return (
    <div className="min-h-screen bg-[#0a0e1f] text-white font-sans">
      <header className="border-b border-white/8 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <p className="tracking-widest uppercase" style={{ fontFamily: "Georgia, serif", fontSize: "16px" }}>Lorenzo Ricci</p>
            <p className="text-[10px] tracking-[0.25em] uppercase text-white/30 mt-0.5">Admin · Ревюта</p>
          </div>
          <form action={logout}><button type="submit" className="text-xs text-white/35 hover:text-white tracking-widest uppercase">Изход ↗</button></form>
        </div>
      </header>
      <AdminNav />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-8">
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((x) => (
            <Link key={x.key} href={`/lr-panel-v8m3q/reviews?s=${x.key}`} aria-current={tab === x.key ? "page" : undefined}
              className={`px-4 py-2.5 text-xs font-semibold tracking-[0.14em] uppercase border ${tab === x.key ? "bg-white text-[#0a0e1f] border-white" : "border-white/20 text-white/60 hover:text-white"}`}>
              {x.label} <span className={tab === x.key ? "text-[#0a0e1f]/60" : "text-white/40"}>({counts[x.key]})</span>
            </Link>
          ))}
        </div>

        {list.error && <p className="text-red-400 text-sm">Ревютата не се четат: пусни supabase/reviews.sql в Supabase ({list.error.message})</p>}

        <ReviewsBoard reviews={reviews} tab={tab} />

        {owner && (
          <section>
            <h2 className="text-xs tracking-[0.2em] uppercase text-white/40 mb-3">Журнал: кой какво е направил (последни 50)</h2>
            <div className="overflow-x-auto border border-white/10">
              <table className="w-full text-sm">
                <thead className="text-white/40 text-xs"><tr><th className="text-left p-2">Кога</th><th className="text-left p-2">Кой</th><th className="text-left p-2">Какво</th><th className="text-left p-2">Ревю</th></tr></thead>
                <tbody>
                  {log.map((l, i) => (
                    <tr key={i} className="border-t border-white/10">
                      <td className="p-2 whitespace-nowrap">{fmt(l.created_at)}</td>
                      <td className="p-2 whitespace-nowrap">{l.actor_email ?? "—"} <span className="text-white/40">({ROLE_LABEL[l.actor_role ?? ""] ?? "?"})</span></td>
                      <td className="p-2 whitespace-nowrap">{ACTION_LABEL[l.action] ?? l.action}</td>
                      <td className="p-2 text-white/60">{l.review_name ?? "—"} · {l.product_slug ?? ""}</td>
                    </tr>
                  ))}
                  {!log.length && <tr><td colSpan={4} className="p-3 text-white/40">Още няма действия.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
