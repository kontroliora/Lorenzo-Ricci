"use client";
import Link from "next/link";

export function PartnerHeader({ active }: { active: "orders" | "carts" | "pieces" }) {
  const logout = async () => { await fetch("/api/partner/logout", { method: "POST" }); window.location.href = "/partner/login"; };
  const tab = (on: boolean) => `flex-1 text-center py-3 text-[13px] font-semibold tracking-[0.12em] uppercase border-b-2 ${on ? "border-white text-white" : "border-transparent text-white/45"}`;
  return (
    <header className="bg-[#0a0e1f] text-white sticky top-0 z-20">
      <div className="max-w-2xl mx-auto px-4 pt-3 flex items-center justify-between">
        <p className="tracking-[0.2em] uppercase text-[15px]" style={{ fontFamily: "Georgia, serif" }}>Lorenzo Ricci</p>
        <button onClick={logout} className="text-[11px] tracking-widest uppercase text-white/45 py-2 pl-4">Изход</button>
      </div>
      <nav className="max-w-2xl mx-auto px-2 flex">
        <Link href="/partner" className={tab(active === "orders")}>Поръчки</Link>
        <Link href="/partner/kolichki" className={tab(active === "carts")}>Колички</Link>
        <Link href="/partner/bijuta" className={tab(active === "pieces")}>Бижута</Link>
      </nav>
    </header>
  );
}
