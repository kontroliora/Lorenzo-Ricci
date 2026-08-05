"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useCartStore } from "@/lib/store";
import { useT } from "@/lib/i18n/LocaleProvider";
import { LanguageToggle } from "@/components/ui/LanguageToggle";

export function Header() {
  const [scrolled, setScrolled]       = useState(false);
  const [menuOpen, setMenuOpen]       = useState(false);
  const [jewelleryOpen, setJewelleryOpen] = useState(false);
  const { totalItems, openCart } = useCartStore();
  const count = totalItems();
  const t = useT();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  const closeMobile = () => {
    setMenuOpen(false);
    setJewelleryOpen(false);
  };

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
            <div className="hidden lg:flex items-center gap-10">
              <NavLink href="/watches">{t("nav.watches")}</NavLink>

              {/* Бижута dropdown */}
              <div className="relative group">
                <button className="flex items-center gap-1 font-sans text-xs font-light tracking-[0.18em] uppercase text-ink-muted hover:text-navy transition-colors duration-300 relative">
                  {t("nav.jewellery")}
                  <svg
                    width="10" height="10" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor" strokeWidth="2"
                    strokeLinecap="round" strokeLinejoin="round"
                    className="mt-px transition-transform duration-300 group-hover:rotate-180"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                  {/* Underline on hover */}
                  <span className="absolute -bottom-1 left-0 w-0 h-px bg-navy transition-all duration-300 group-hover:w-full" />
                </button>

                {/* Dropdown panel - pt-3 bridges the visual gap so hover isn't lost */}
                <div className="absolute top-full left-1/2 -translate-x-1/2 w-48 pt-3 opacity-0 pointer-events-none translate-y-1 group-hover:opacity-100 group-hover:pointer-events-auto group-hover:translate-y-0 transition-all duration-200 z-50">
                  <div className="relative bg-white border border-border shadow-[0_8px_40px_-8px_rgba(15,40,80,0.12)]">
                    {/* Small caret */}
                    <div className="absolute -top-[5px] left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-white border-l border-t border-border rotate-45" />

                    <div className="py-2">
                      <DropdownLink href="/jewellery">Всички бижута</DropdownLink>
                      <div className="mx-4 h-px bg-border my-1" />
                      <DropdownLink href="/bundles">Комплекти  -10%</DropdownLink>
                    </div>
                  </div>
                </div>
              </div>

              <NavLink href="/leather-goods">{t("nav.leather")}</NavLink>
            </div>
          </div>

          {/* Logo - always centred */}
          <Link href="/" className="flex-shrink-0 flex items-center" aria-label="Lorenzo Ricci - начало">
            <Image
              src="/logo.webp"
              alt="Lorenzo Ricci"
              width={160}
              height={40}
              quality={90}
              priority
              className={`object-contain transition-all duration-300 logo-invert ${scrolled ? "h-8" : "h-10"} w-auto`}
            />
          </Link>

          {/* Right nav */}
          <div className="flex-1 flex items-center justify-end gap-5">
            <div className="hidden lg:flex items-center gap-10">
              <NavLink href="/story">{t("nav.story")}</NavLink>
              <NavLink href="/faq">{t("nav.faq")}</NavLink>
            </div>

            <LanguageToggle className="text-ink-muted" />

            <button
              onClick={openCart}
              aria-label={`${t("cart.title")} (${count})`}
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
              aria-label={t("nav.menu")}
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
          <div className="flex flex-col h-full px-8 py-10" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-16">
              <Image src="/logo.webp" alt="Lorenzo Ricci" width={140} height={36} className="h-9 w-auto" />
              <button onClick={closeMobile} className="text-white/60 hover:text-white text-3xl leading-none transition-colors">
                ×
              </button>
            </div>

            <nav className="flex flex-col gap-8">
              {/* Static links */}
              {([
                { href: "/",        key: "nav.home" },
                { href: "/watches", key: "nav.watches" },
              ] as const).map(({ href, key }) => (
                <Link key={href} href={href} onClick={closeMobile}
                  className="font-serif text-4xl text-white/80 hover:text-white transition-colors duration-300">
                  {t(key)}
                </Link>
              ))}

              {/* Бижута accordion */}
              <div>
                <button
                  onClick={() => setJewelleryOpen((v) => !v)}
                  className="flex items-center gap-3 font-serif text-4xl text-white/80 hover:text-white transition-colors duration-300 w-full text-left"
                >
                  {t("nav.jewellery")}
                  <svg
                    width="18" height="18" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor" strokeWidth="1.5"
                    strokeLinecap="round" strokeLinejoin="round"
                    className={`mt-1 transition-transform duration-300 ${jewelleryOpen ? "rotate-180" : ""}`}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {jewelleryOpen && (
                  <div className="mt-4 ml-4 flex flex-col gap-4 border-l border-white/10 pl-5">
                    <Link href="/jewellery" onClick={closeMobile}
                      className="font-sans text-sm font-light tracking-[0.2em] uppercase text-white/60 hover:text-white transition-colors duration-300">
                      Всички бижута
                    </Link>
                    <Link href="/bundles" onClick={closeMobile}
                      className="font-sans text-sm font-light tracking-[0.2em] uppercase text-white/60 hover:text-white transition-colors duration-300">
                      Комплекти  -10%
                    </Link>
                  </div>
                )}
              </div>

              {/* Rest */}
              {([
                { href: "/leather-goods", key: "nav.leather" },
                { href: "/story",         key: "nav.story" },
                { href: "/faq",           key: "nav.faq" },
              ] as const).map(({ href, key }) => (
                <Link key={href} href={href} onClick={closeMobile}
                  className="font-serif text-4xl text-white/80 hover:text-white transition-colors duration-300">
                  {t(key)}
                </Link>
              ))}
            </nav>

            <div className="mt-auto">
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
      className="font-sans text-xs font-light tracking-[0.18em] uppercase text-ink-muted hover:text-navy transition-colors duration-300 relative group">
      {children}
      <span className="absolute -bottom-1 left-0 w-0 h-px bg-navy transition-all duration-300 group-hover:w-full" />
    </Link>
  );
}

function DropdownLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href}
      className="block px-4 py-2.5 font-sans text-[11px] font-light tracking-[0.18em] uppercase text-ink-muted hover:text-navy hover:bg-ivory-warm transition-colors duration-200">
      {children}
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
