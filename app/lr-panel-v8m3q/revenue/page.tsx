import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin/AdminNav";
import { logout } from "../actions";
import { isOwner } from "@/lib/admin-auth";
import { getRevenue } from "@/lib/revenue";
import { RevenueBoard } from "./RevenueBoard";

export const dynamic = "force-dynamic";

export default async function RevenuePage() {
  // Owner-only. Non-owners are redirected (UX), the RPC returns NULL for them
  // (the real boundary), and the tab is hidden in the nav — defence in depth.
  if (!(await isOwner())) redirect("/lr-panel-v8m3q/orders");

  const data = await getRevenue();

  return (
    <div className="min-h-screen bg-[#0a0e1f] text-white">
      <header className="border-b border-white/8 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-white tracking-widest uppercase" style={{ fontFamily: "Georgia, serif", fontSize: "16px" }}>Lorenzo Ricci</p>
            <p className="font-sans text-[10px] tracking-[0.25em] uppercase text-white/30 mt-0.5">Admin · Оборот</p>
          </div>
          <form action={logout}>
            <button type="submit" className="font-sans text-xs text-white/35 hover:text-white tracking-widest uppercase transition-colors">Изход ↗</button>
          </form>
        </div>
      </header>

      <AdminNav />
      {data
        ? <RevenueBoard data={data} />
        : <p className="text-white/40 text-sm text-center py-20">Няма достъп или все още няма завършени поръчки.</p>}
    </div>
  );
}
