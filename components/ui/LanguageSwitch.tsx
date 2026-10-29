"use client";
import { usePathname } from "next/navigation";
import { LANG_COOKIE, bgToRoPath, roToBgPath } from "@/lib/ro/route-map";

// BG · RO switch. Real links (crawlable, work without JS); a click also stores the choice in the lr_lang cookie, which the geo
// redirect (middleware.ts) respects from then on: a visitor who switches by hand is never redirected again.
// Sits where it cannot push the logo off-centre on phones (the 2026-09 BG·EN·RO toggle did, commit c81ace9): the mobile
// menu, the footer and the announcement bar on desktop - never beside the cart.
export function LanguageSwitch({ current, className = "", size = "sm" }: { current: "bg" | "ro"; className?: string; size?: "sm" | "lg" }) {
  const pathname = usePathname() || "/";
  const targets = { bg: current === "bg" ? pathname : roToBgPath(pathname), ro: current === "ro" ? pathname : bgToRoPath(pathname) };
  const remember = (lang: "bg" | "ro") => { document.cookie = `${LANG_COOKIE}=${lang}; path=/; max-age=31536000; SameSite=Lax`; };
  // The href stays the plain path (crawlable, cacheable); a click carries the visit's query string over (utm_*, fbclid ...),
  // so switching language never loses the ad attribution (29.10.2026).
  const go = (e: React.MouseEvent<HTMLAnchorElement>, lang: "bg" | "ro") => {
    remember(lang);
    const qs = window.location.search;
    if (!qs || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    window.location.assign(targets[lang] + qs);
  };
  const lg = size === "lg";

  return (
    <div role="group" aria-label="Limba / Език" className={`flex items-center gap-1 ${lg ? "-mx-2" : ""} ${className}`}>
      {(["bg", "ro"] as const).map((l, i) => (
        <span key={l} className="flex items-center gap-1">
          {i > 0 && <span aria-hidden className="text-current opacity-25">·</span>}
          <a
            href={targets[l]}
            hrefLang={l === "ro" ? "ro" : "bg"}
            onClick={(e) => go(e, l)}
            aria-current={l === current ? "true" : undefined}
            className={`font-sans ${lg ? "text-xs px-2 py-2" : "text-[10px]"} tracking-[0.14em] transition-opacity ${l === current ? "opacity-100 font-medium" : "opacity-45 hover:opacity-80"}`}
          >
            {l.toUpperCase()}
          </a>
        </span>
      ))}
    </div>
  );
}
