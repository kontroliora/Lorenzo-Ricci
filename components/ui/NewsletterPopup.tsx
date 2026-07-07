"use client";
import { useState, useEffect } from "react";

const STORAGE_KEY = "lr_newsletter_shown";

export function NewsletterPopup() {
  const [visible, setVisible]     = useState(false);
  const [email, setEmail]         = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [expiresAt, setExpiresAt]           = useState("");
  const [alreadySubscribed, setAlreadySubscribed] = useState(false);
  const [codeUsed, setCodeUsed]             = useState(false);
  const [copied, setCopied]       = useState(false);
  const [error, setError]         = useState("");

  useEffect(() => {
    if (typeof localStorage === "undefined") return;
    if (localStorage.getItem(STORAGE_KEY)) return;

    const timer = setTimeout(() => setVisible(true), 4000);

    const onMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 5) {
        clearTimeout(timer);
        if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
        document.removeEventListener("mouseleave", onMouseLeave);
      }
    };
    document.addEventListener("mouseleave", onMouseLeave);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("mouseleave", onMouseLeave);
    };
  }, []);

  const close = () => {
    setVisible(false);
    localStorage.setItem(STORAGE_KEY, "1");
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
      localStorage.setItem(STORAGE_KEY, "1");
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

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-charcoal/75 backdrop-blur-sm" onClick={promoCode ? undefined : close} aria-hidden="true" />

      <div className="relative bg-[#08091A] border border-white/10 w-full max-w-[420px] overflow-hidden shadow-2xl">
        <div className="h-px w-full bg-gradient-to-r from-transparent via-white/20 to-transparent" />

        <button
          onClick={close}
          aria-label="Затвори"
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-white/30 hover:text-white transition-colors z-10"
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

            {/* Code box — click to copy */}
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

            {/* Validity / status — directly under the code */}
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
                className="w-full bg-white/5 border border-white/12 text-white font-sans text-sm px-4 py-3.5 focus:outline-none focus:border-white/30 placeholder:text-white/25 transition-colors"
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
