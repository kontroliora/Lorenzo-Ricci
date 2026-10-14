"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRoCart } from "@/lib/ro/store";

// Romanian counterpart of components/layout/Header.tsx: same fixed bar and mobile overlay, own nav (no jewellery,
// no language switcher, no link to the Bulgarian site) and the separate Romanian cart (lib/ro/store.ts).
const LEFT_NAV = [
  { href: "/ro/ceasuri", label: "Ceasuri" },
  { href: "/ro/piele-de-crocodil", label: "Articole din piele de crocodil" },
] as const;

const RIGHT_NAV = [
  { href: "/ro/despre-noi", label: "Despre noi" },
  { href: "/ro/intrebari-frecvente", label: "Întrebări frecvente" },
] as const;

const MOBILE_NAV = [{ href: "/ro", label: "Acasă" }, ...LEFT_NAV, ...RIGHT_NAV] as const;

export function RoHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const count = useRoCart((s) => s.items.reduce((n, i) => n + i.quantity, 0));
  const openCart = useRoCart((s) => s.open);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const closeMobile = () => setMenuOpen(false);

  return (
    <>
      <header
        className={`fixed top-9 left-0 right-0 z-50 bg-white border-b transition-all duration-500 ${
          scrolled ? "py-3 border-border shadow-[0_1px_8px_rgba(0,0,0,0.06)]" : "py-5 border-border/70"
        }`}
      >
        <nav className="max-w-7xl mx-auto px-5 sm:px-8 flex items-center">

          {/* Left nav - flex-1 keeps logo centred */}
          <div className="flex-1 flex items-center gap-10">
            <div className="hidden lg:flex items-center gap-8 xl:gap-10">
              {LEFT_NAV.map(({ href, label }) => (
                <NavLink key={href} href={href}>{label}</NavLink>
              ))}
            </div>
          </div>

          {/* Logo - always centred */}
          <Link href="/ro" className="flex-shrink-0 flex items-center" aria-label="Lorenzo Ricci - pagina principală">
            <Image
              src="/logo.webp"
              alt="Lorenzo Ricci"
              width={160}
              height={40}
              quality={90}
              loading="eager" // above the fold, but not `priority`: only the page's LCP image gets the preload + high fetch priority
              className={`object-contain transition-all duration-300 logo-invert ${scrolled ? "h-8" : "h-10"} w-auto`}
            />
          </Link>

          {/* Right nav */}
          <div className="flex-1 flex items-center justify-end gap-5">
            <div className="hidden lg:flex items-center gap-8 xl:gap-10">
              {RIGHT_NAV.map(({ href, label }) => (
                <NavLink key={href} href={href}>{label}</NavLink>
              ))}
            </div>

            <button
              onClick={openCart}
              aria-label={`Coș (${count})`}
              className="relative text-ink-soft hover:text-navy transition-colors duration-300"
            >
              <CartIcon />
              {count > 0 && (
                <span className="absolute -top-2 -right-2 bg-navy text-white text-[9px] font-medium font-sans w-4 h-4 rounded-full flex items-center justify-center leading-none">
                  {count}
                </span>
              )}
            </button>

            <button
              onClick={() => setMenuOpen(true)}
              aria-label="Meniu"
              className="lg:hidden text-ink-soft hover:text-navy transition-colors duration-300"
            >
              <HamburgerIcon />
            </button>
          </div>
        </nav>
      </header>

      {/* Mobile overlay */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-[100] bg-[#0A0A0A] flex flex-col"
          onClick={closeMobile}
        >
          <div className="flex flex-col h-full overflow-y-auto px-8 py-10" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-16">
              <Image src="/logo.webp" alt="Lorenzo Ricci" width={140} height={36} className="h-9 w-auto" />
              <button
                onClick={closeMobile}
                aria-label="Închide meniul"
                className="text-white/60 hover:text-white text-3xl leading-none transition-colors"
              >
                ×
              </button>
            </div>

            <nav className="flex flex-col gap-8">
              {MOBILE_NAV.map(({ href, label }) => (
                <Link key={href} href={href} onClick={closeMobile}
                  className="font-serif text-4xl leading-tight text-white/80 hover:text-white transition-colors duration-300">
                  {label}
                </Link>
              ))}
            </nav>

            <div className="mt-auto pt-10">
              <div className="h-px bg-white/10 mb-8" />
              <p className="font-sans text-xs text-white/40 tracking-widest uppercase">info@lorenzo-ricci.com</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href}
      className="font-sans text-xs font-light tracking-[0.18em] uppercase text-ink-muted hover:text-navy transition-colors duration-300 relative group whitespace-nowrap">
      {children}
      <span className="absolute -bottom-1 left-0 w-0 h-px bg-navy transition-all duration-300 group-hover:w-full" />
    </Link>
  );
}

function CartIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 01-8 0" />
    </svg>
  );
}

function HamburgerIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}
