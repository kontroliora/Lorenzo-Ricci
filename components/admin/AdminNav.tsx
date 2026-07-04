"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/lr-panel-v8m3q/inventory", label: "Инвентар" },
  { href: "/lr-panel-v8m3q/orders",    label: "Поръчки" },
];

/**
 * Primary admin navigation — big, tappable tabs shown on every panel page.
 * Distinct from the public storefront menu.
 */
export function AdminNav() {
  const pathname = usePathname() ?? "";

  return (
    <nav className="border-b border-white/10 bg-[#0a0e1f] sticky top-0 z-30">
      <div className="max-w-5xl mx-auto px-2 sm:px-6 flex items-stretch">
        {TABS.map((t) => {
          const active = pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={`flex-1 sm:flex-none text-center px-6 py-4 font-sans text-sm sm:text-[13px] font-medium tracking-[0.14em] uppercase transition-colors border-b-2 ${
                active
                  ? "text-white border-white bg-white/[0.04]"
                  : "text-white/40 border-transparent hover:text-white/80 hover:bg-white/[0.02]"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
        <Link
          href="/lr-panel-v8m3q/customers"
          aria-current={pathname.startsWith("/lr-panel-v8m3q/customers") ? "page" : undefined}
          className={`px-4 py-4 self-center font-sans text-[11px] tracking-[0.14em] uppercase transition-colors ml-auto ${
            pathname.startsWith("/lr-panel-v8m3q/customers")
              ? "text-white"
              : "text-white/30 hover:text-white/70"
          }`}
        >
          Клиенти
        </Link>
      </div>
    </nav>
  );
}
