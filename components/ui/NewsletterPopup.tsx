"use client";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { rememberMatchKeys } from "@/lib/fbq";

// The -10% newsletter offer. It must never get in the way of a first-time visitor (ad traffic):
//  - never on the first page view of a visit (a second page is the earliest);
//  - never again for 14 days after it was closed or used (localStorage, wrapped in try/catch);
//  - phones/tablets: a slim bar at the bottom (not a modal), after 25 s on the page or 60% scroll, whichever comes first;
//  - desktop: the modal, only on exit intent or after 30 s;
//  - never on the cart / checkout (HideOnCart in the layout hides it while the drawer is open; the paths below are the
//    pages that carry a checkout of their own).
const STORAGE_KEY = "lr_newsletter_shown"; // ms timestamp of the last close / signup (the old value "1" counts as "just now")
const PV_KEY = "lr_pv";                    // page views in this visit (sessionStorage)
const PV_LAST_KEY = "lr_pv_last";
const QUIET_MS = 14 * 24 * 60 * 60 * 1000;
const MOBILE_AFTER_MS = 25_000;
const DESKTOP_AFTER_MS = 30_000;
const MOBILE_SCROLL = 0.6;
const NO_OFFER_PATHS = ["/poruchka", "/vazstanovi", "/track"];

// In-memory fallbacks for browsers where storage throws (private mode, blocked site data)
let memStamp: number | null = null;
let memViews = 0;
let memLastPath = "";
let pageFor = "";
let pageSince = 0;

function readStamp(): number | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v) {
      if (v === "1") { const now = Date.now(); localStorage.setItem(STORAGE_KEY, String(now)); return now; }
      const n = Number(v);
      return Number.isFinite(n) && n > 0 ? n : Date.now();
    }
  } catch { /* fall through to memory */ }
  return memStamp;
}
const isQuiet = (): boolean => { const t = readStamp(); return t !== null && Date.now() - t < QUIET_MS; };
function markShown(): void {
  const now = Date.now();
  memStamp = now;
  try { localStorage.setItem(STORAGE_KEY, String(now)); } catch { /* ignore */ }
}
// Counts a page the first time its path is seen in this visit
function countPageView(path: string): number {
  if (pageFor !== path) { pageFor = path; pageSince = Date.now(); }
  try {
    let n = Number(sessionStorage.getItem(PV_KEY) || 0);
    if (sessionStorage.getItem(PV_LAST_KEY) !== path) {
      n += 1;
      sessionStorage.setItem(PV_KEY, String(n));
      sessionStorage.setItem(PV_LAST_KEY, path);
    }
    return Math.max(n, 1);
  } catch {
    if (memLastPath !== path) { memLastPath = path; memViews += 1; }
    return Math.max(memViews, 1);
  }
}

export function NewsletterPopup() {
  const pathname = usePathname();
  const [visible, setVisible]     = useState(false);
  const [compact, setCompact]     = useState(false); // true = the slim bottom bar (phones and tablets)
  const [email, setEmail]         = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [expiresAt, setExpiresAt]           = useState("");
  const [alreadySubscribed, setAlreadySubscribed] = useState(false);
  const [codeUsed, setCodeUsed]             = useState(false);
  const [copied, setCopied]       = useState(false);
  const [error, setError]         = useState("");

  useEffect(() => {
    if (visible) return;
    const views = countPageView(pathname);
    if (NO_OFFER_PATHS.some((p) => pathname.startsWith(p))) return;
    if (views < 2 || isQuiet()) return; // never on the first page view of a visit

    let phone = false;
    try { phone = window.matchMedia("(max-width: 1023px), (pointer: coarse)").matches; } catch { /* desktop */ }

    let fired = false;
    const show = () => {
      if (fired || isQuiet()) return;
      fired = true;
      setCompact(phone);
      setVisible(true);
    };

    const wait = Math.max(0, (phone ? MOBILE_AFTER_MS : DESKTOP_AFTER_MS) - (Date.now() - pageSince));
    const onVisible = () => { if (document.visibilityState === "visible") show(); };
    const timer = setTimeout(() => {
      if (document.visibilityState === "visible") show();
      else document.addEventListener("visibilitychange", onVisible); // count only time the page can be seen
    }, wait);

    const onScroll = () => {
      const room = document.documentElement.scrollHeight - window.innerHeight;
      if (room > 400 && window.scrollY / room >= MOBILE_SCROLL) show();
    };
    const onMouseLeave = (e: MouseEvent) => { if (e.clientY <= 5) show(); };
    if (phone) { window.addEventListener("scroll", onScroll, { passive: true }); onScroll(); }
    else document.addEventListener("mouseleave", onMouseLeave);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("mouseleave", onMouseLeave);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [pathname, visible]);

  const close = () => {
    setVisible(false);
    markShown();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!clean || !clean.includes("@")) {
      setError("Въведете валиден имейл адрес");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: clean }),
      });
      const data = await res.json() as {
        success?: boolean; code?: string; error?: string;
        expiresAt?: string; alreadySubscribed?: boolean; used?: boolean;
      };
      if (!res.ok || !data.success) {
        setError("Нещо се обърка. Моля, опитайте отново.");
        return;
      }
      setPromoCode(data.code ?? "");
      setExpiresAt(data.expiresAt ?? "");
      setAlreadySubscribed(Boolean(data.alreadySubscribed));
      setCodeUsed(Boolean(data.used));
      markShown();
      void rememberMatchKeys({ email: clean }, "bg");
    } catch {
      setError("Нещо се обърка. Моля, опитайте отново.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(promoCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback for older browsers
      const el = document.createElement("textarea");
      el.value = promoCode;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const fmtExpiry = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString("bg-BG", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Sofia" });
    } catch { return ""; }
  };
  const isExpired = expiresAt ? Date.now() > new Date(expiresAt).getTime() : false;

  if (!visible) return null;

  // Phones and tablets: a slim bar at the bottom, never a modal. It sits above the sticky add-to-cart bar of the product page
  // (--sticky-bar-h is set by StickyCartBar) and clears the home indicator.
  if (compact) {
    const status = codeUsed
      ? "Този код вече е използван"
      : !expiresAt ? "Валиден"
      : isExpired ? `Кодът е изтекъл на ${fmtExpiry(expiresAt)}`
      : `Валиден до ${fmtExpiry(expiresAt)}`;
    const statusTone = codeUsed ? "text-amber-400/80" : isExpired ? "text-red-400/80" : "text-emerald-400/90";
    return (
      <div
        role="region"
        aria-label="Абонамент: 10% отстъпка"
        className="fixed inset-x-0 z-40 bg-[#08091A] border-t border-white/15 shadow-[0_-10px_30px_rgba(0,0,0,0.35)]"
        style={{ bottom: "var(--sticky-bar-h, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="relative px-4 pt-3 pb-3 pr-14">
          <button
            onClick={close}
            aria-label="Затвори"
            className="absolute top-0 right-1 w-11 h-11 flex items-center justify-center text-white/60 hover:text-white transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          {promoCode ? (
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-sans text-[11px] text-white/60 leading-tight">
                  {alreadySubscribed ? "Вече сте абонирани. Вашият код за 10%:" : "Благодарим! Вашият код за 10%:"}
                </p>
                <p className="font-serif text-[1.35rem] text-white tracking-[0.14em] leading-tight mt-0.5 break-all">{promoCode}</p>
                <p className={`font-sans text-[11px] mt-0.5 ${statusTone}`}>{status}</p>
              </div>
              <button
                onClick={handleCopy}
                className="flex-shrink-0 min-h-[44px] px-4 border border-white/25 text-white/80 hover:text-white font-sans text-[10px] tracking-[0.2em] uppercase"
              >
                {copied ? "Копирано" : "Копирай"}
              </button>
            </div>
          ) : (
            <>
              <p className="font-sans text-[13px] text-white/85 leading-tight">
                VIP достъп: <span className="text-white font-medium">−10%</span> с имейл
              </p>
              <form onSubmit={handleSubmit} noValidate className="flex gap-2 mt-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(""); }}
                  placeholder="Вашият имейл"
                  inputMode="email"
                  autoComplete="email"
                  aria-label="Имейл адрес"
                  className="flex-1 min-w-0 min-h-[44px] bg-white/5 border border-white/20 text-white font-sans text-base px-3 focus:outline-none focus:border-white/50 placeholder:text-white/35"
                />
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-shrink-0 min-h-[44px] px-4 bg-white text-charcoal font-sans text-[10px] font-medium tracking-[0.18em] uppercase disabled:opacity-50"
                >
                  {submitting ? "…" : "Вземи код"}
                </button>
              </form>
              {error && <p className="font-sans text-[11px] text-red-400/90 mt-1.5">{error}</p>}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Абонамент: 10% отстъпка" className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-charcoal/75 backdrop-blur-sm" onClick={promoCode ? undefined : close} aria-hidden="true" />

      <div className="relative bg-[#08091A] border border-white/10 w-full max-w-[420px] overflow-hidden shadow-2xl">
        <div className="h-px w-full bg-gradient-to-r from-transparent via-white/20 to-transparent" />

        <button
          onClick={close}
          aria-label="Затвори"
          className="absolute top-2 right-2 w-11 h-11 flex items-center justify-center text-white/30 hover:text-white transition-colors z-10"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {promoCode ? (
          /* ── SUCCESS: code shown on screen ───────────────────────────── */
          <div className="px-10 py-11 text-center flex flex-col items-center gap-5">
            {/* Checkmark */}
            <div className="w-11 h-11 rounded-full border border-white/15 flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.65)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>

            {/* Heading */}
            <div>
              <p className="font-sans text-[10px] text-white/35 tracking-[0.28em] uppercase mb-2">{alreadySubscribed ? "Вече абониран" : "Добре дошли"}</p>
              <h3 className="font-serif text-[1.55rem] text-white leading-snug mb-2">{alreadySubscribed ? "Вече сте абонирани" : "Благодарим Ви!"}</h3>
              <p className="font-sans text-sm font-light text-white/45 leading-relaxed">
                {alreadySubscribed
                  ? "Този имейл вече е абониран. Ето вашия код за 10% отстъпка:"
                  : "Успешно се абонирахте. Вашият личен код за 10% отстъпка е:"}
              </p>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 w-full">
              <div className="flex-1 h-px bg-white/8" />
              <span className="text-white/15 text-xs">◈</span>
              <div className="flex-1 h-px bg-white/8" />
            </div>

            {/* Code box - click to copy */}
            <button
              onClick={handleCopy}
              className="w-full group"
              title="Копирай кода"
            >
              <div className="border border-white/20 group-hover:border-white/40 transition-colors duration-200 px-6 py-5">
                <p className="font-sans text-[9px] text-white/30 tracking-[0.3em] uppercase mb-3">
                  Вашият код е:
                </p>
                <p className="font-serif text-[2rem] text-white tracking-[0.18em] leading-none">
                  {promoCode}
                </p>
              </div>
            </button>

            {/* Validity / status - directly under the code */}
            <p className={`font-sans text-[11px] tracking-wide -mt-1 ${
              codeUsed ? "text-amber-400/70" : isExpired ? "text-red-400/70" : "text-emerald-400/80"
            }`}>
              {codeUsed
                ? "Този код вече е използван"
                : !expiresAt
                ? "Валиден"
                : isExpired
                ? `Кодът е изтекъл на ${fmtExpiry(expiresAt)}`
                : `Валиден до ${fmtExpiry(expiresAt)}`}
            </p>

            {/* Copy button */}
            <button
              onClick={handleCopy}
              className={`w-full flex items-center justify-center gap-2.5 border transition-all duration-200 py-3 font-sans text-[10px] tracking-[0.22em] uppercase ${
                copied
                  ? "border-white/30 text-white/70 bg-white/5"
                  : "border-white/15 text-white/40 hover:border-white/30 hover:text-white/70"
              }`}
            >
              {copied ? (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Копирано!
                </>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  Копирай кода
                </>
              )}
            </button>

            <p className="font-sans text-[10px] text-white/25 leading-relaxed">
              {expiresAt
                ? "Въведете кода в количката при поръчка · Еднократна употреба · Валиден 14 дни"
                : "Въведете кода в количката при поръчка · Еднократна употреба"}
            </p>

            <button onClick={close} className="btn-primary w-full text-center justify-center">
              Пазарувай сега
            </button>
          </div>
        ) : (
          /* ── SUBSCRIBE FORM ──────────────────────────────────────────── */
          <div className="px-10 py-12">
            <div className="text-center mb-8">
              <p className="text-white/60 tracking-[0.3em] uppercase text-[11px]" style={{ fontFamily: "Georgia, serif" }}>
                Lorenzo Ricci
              </p>
              <div className="flex items-center gap-3 justify-center mt-3">
                <div className="h-px w-8 bg-white/15" />
                <span className="text-white/20 text-xs">◈</span>
                <div className="h-px w-8 bg-white/15" />
              </div>
            </div>

            <div className="text-center mb-7">
              <h2 className="font-serif text-[1.65rem] text-white leading-snug mb-3">VIP Достъп · -10%</h2>
              <p className="font-sans text-sm font-light text-white/50 leading-relaxed">
                Абонирайте се и получете ексклузивен промо код за{" "}
                <span className="text-white/75">10% отстъпка</span> веднага на екрана.
              </p>
            </div>

            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); }}
                placeholder="Вашият имейл адрес"
                inputMode="email"
                autoComplete="email"
                className="w-full bg-white/5 border border-white/12 text-white font-sans text-base px-4 py-3.5 focus:outline-none focus:border-white/30 placeholder:text-white/25 transition-colors"
              />
              {error && (
                <p className="font-sans text-[11px] text-red-400/70 tracking-wide -mt-1">{error}</p>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="btn-primary w-full text-center justify-center disabled:opacity-50"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Обработване...
                  </span>
                ) : (
                  "Получи ексклузивен код"
                )}
              </button>
            </form>

            <p className="font-sans text-[10px] text-white/25 tracking-wide text-center mt-5 leading-relaxed">
              Без спам · Само ексклузивни оферти · Отпишете се по всяко време
            </p>
          </div>
        )}

        <div className="h-px w-full bg-gradient-to-r from-transparent via-white/8 to-transparent" />
      </div>
    </div>
  );
}
