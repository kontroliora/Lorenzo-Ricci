"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { RESULTS_PATHS } from "./ResultsNav";

const TABS: { href: string; label: string; match?: string[] }[] = [
  { href: "/lr-panel-v8m3q/inventory", label: "Инвентар" },
  { href: "/lr-panel-v8m3q/orders",    label: "Поръчки" },
  { href: "/lr-panel-v8m3q/reviews",   label: "Ревюта" },
];

// Owner-only tabs. Hidden from the employee — each page also re-checks
// server-side, so hiding the tab is UX, not the security boundary.
// Оборот · Трафик · ROAS are ONE tab (owner, 21.11.2026): the tab opens Оборот and the
// three switch between each other inside the page (components/admin/ResultsNav.tsx), so the
// nav stays short. `match` keeps the tab highlighted on all three routes.
const OWNER_TABS: { href: string; label: string; match?: string[] }[] = [
  { href: "/lr-panel-v8m3q/revenue", label: "Оборот · Трафик · ROAS", match: RESULTS_PATHS },
  { href: "/lr-panel-v8m3q/waitlist", label: "Международни" },
  { href: "/lr-panel-v8m3q/partner", label: "Партньор" },
  { href: "/lr-panel-v8m3q/orders/confirm-emails", label: "Имейл потвърждения" },
];

/**
 * Primary admin navigation — big, tappable tabs shown on every panel page.
 * Distinct from the public storefront menu.
 */
export function AdminNav() {
  const pathname = usePathname() ?? "";
  const [owner, setOwner] = useState(false);

  const [role, setRole] = useState<string>("employee");

  useEffect(() => {
    // admin_users self-read RLS returns only the caller's own role row.
    createClient()
      .from("admin_users")
      .select("role")
      .maybeSingle()
      .then(({ data }) => {
        const r = (data as { role?: string } | null)?.role ?? "employee";
        setRole(r);
        setOwner(r === "owner");
      });
  }, []);

  // fulfillment sees only Поръчки
  const tabs = role === "fulfillment" ? TABS.filter((t) => t.href.includes("/orders")) : owner ? [...TABS, ...OWNER_TABS] : TABS;

  // Narrow screens: the row scrolls (scrollbar hidden); a fade on the right while more tabs are out of view.
  const row = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);
  useEffect(() => {
    const el = row.current;
    if (!el) return;
    const update = () => setMore(el.scrollWidth - el.scrollLeft - el.clientWidth > 4);
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => { el.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
  }, [tabs.length]);

  return (
    <nav className="border-b border-white/10 bg-[#0a0e1f] sticky top-0 z-30">
      <div className="relative max-w-5xl mx-auto">
      <div ref={row} className="px-2 sm:px-6 flex items-stretch overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map((t) => {
          const active = (t.match ?? [t.href]).some((h) => pathname.startsWith(h));
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={`flex-1 sm:flex-none text-center whitespace-nowrap px-6 xl:px-4 py-4 font-sans text-sm sm:text-[13px] font-medium tracking-[0.14em] xl:tracking-[0.1em] uppercase transition-colors border-b-2 ${
                active
                  ? "text-white border-white bg-white/[0.04]"
                  : "text-white/40 border-transparent hover:text-white/80 hover:bg-white/[0.02]"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
      <div aria-hidden className={`pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[#0a0e1f] to-transparent transition-opacity ${more ? "opacity-100" : "opacity-0"}`} />
      </div>
    </nav>
  );
}
