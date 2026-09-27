"use client";
import { LOCALES, type Locale } from "@/lib/i18n/config";
import { useLocale, setLocaleCookie } from "@/lib/i18n/LocaleProvider";

const LABEL: Record<Locale, string> = { bg: "BG", en: "EN", ro: "RO" };

// Compact BG · EN · RO switcher. The choice is stored in a cookie and wins over
// geo detection from then on. size "lg" is the mobile-menu version: bigger text and
// tap targets; the negative margin keeps the labels aligned with the text around it.
export function LanguageToggle({ className = "", size = "sm" }: { className?: string; size?: "sm" | "lg" }) {
  const active = useLocale();
  const lg = size === "lg";

  return (
    <div className={`flex items-center gap-1 ${lg ? "-mx-2" : ""} ${className}`}>
      {LOCALES.map((l, i) => (
        <span key={l} className="flex items-center gap-1">
          {i > 0 && <span aria-hidden className="text-current opacity-25">·</span>}
          <button
            type="button"
            onClick={() => l !== active && setLocaleCookie(l)}
            aria-current={l === active ? "true" : undefined}
            aria-label={LABEL[l]}
            className={`font-sans ${lg ? "text-xs px-2 py-2" : "text-[10px]"} tracking-[0.14em] transition-opacity ${
              l === active ? "opacity-100 font-medium" : "opacity-45 hover:opacity-80"
            }`}
          >
            {LABEL[l]}
          </button>
        </span>
      ))}
    </div>
  );
}
