import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin/AdminNav";
import { logout } from "../actions";
import { isOwner } from "@/lib/admin-auth";
import { computeRoas } from "@/lib/roas";
import { RoasBoard } from "./RoasBoard";

export const dynamic = "force-dynamic";

export default async function RoasPage() {
  // Owner-only. Redirect is UX; computeRoas() also returns null for non-owners
  // and the nav tab is hidden — defence in depth, same as the Оборот tab.
  if (!(await isOwner())) redirect("/lr-panel-v8m3q/orders");

  // Default window: last 30 days.
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 29);
  start.setHours(0, 0, 0, 0);
  const initial = await computeRoas(start.toISOString(), end.toISOString());

  return (
    <div className="min-h-screen bg-[#0a0e1f] text-white">
      <header className="border-b border-white/8 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-white tracking-widest uppercase" style={{ fontFamily: "Georgia, serif", fontSize: "16px" }}>Lorenzo Ricci</p>
            <p className="font-sans text-[10px] tracking-[0.25em] uppercase text-white/30 mt-0.5">Admin · ROAS</p>
          </div>
          <form action={logout}>
            <button type="submit" className="font-sans text-xs text-white/35 hover:text-white tracking-widest uppercase transition-colors">Изход ↗</button>
          </form>
        </div>
      </header>

      <AdminNav />
      {initial
        ? <RoasBoard initial={initial} />
        : <p className="text-white/40 text-sm text-center py-20">Няма достъп.</p>}
    </div>
  );
}
