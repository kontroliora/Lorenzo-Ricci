"use client";
import { useState, useEffect } from "react";

const STORAGE_KEY = "lr_newsletter_shown";

export function NewsletterPopup() {
  const [visible, setVisible] = useState(false);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Грешка");
      setSubmitted(true);
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      setError("Нещо се обърка. Моля, опитайте отново.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-charcoal/75 backdrop-blur-sm" onClick={close} aria-hidden="true" />

      <div className="relative bg-[#08091A] border border-white/10 w-full max-w-[420px] overflow-hidden shadow-2xl">
        <div className="h-px w-full bg-gradient-to-r from-transparent via-white/20 to-transparent" />

        <button onClick={close} aria-label="Затвори" className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-white/30 hover:text-white transition-colors z-10">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {submitted ? (
          /* ── Success: code sent to email ─────────────────────────── */
          <div className="px-10 py-12 text-center flex flex-col items-center gap-5">
            <div className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>

            <div>
              <p className="font-sans text-[10px] text-white/35 tracking-[0.25em] uppercase mb-2">Добре дошли</p>
              <h3 className="font-serif text-2xl text-white mb-3">Проверете имейла си</h3>
              <p className="font-sans text-sm font-light text-white/50 leading-relaxed">
                Изпратихме Ви уникален промо код за{" "}
                <span className="text-white/75">10% отстъпка</span>{" "}
                на <span className="text-white/70">{email}</span>.
              </p>
            </div>

            <p className="font-sans text-xs text-white/30 leading-relaxed">
              Въведете кода при поръчка. Валиден за следващата поръчка.
            </p>

            <button onClick={close} className="btn-primary w-full text-center justify-center">
              Пазарувай сега
            </button>
          </div>
        ) : (
          /* ── Subscribe form ──────────────────────────────────────── */
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
                Абонирайте се за нашия бюлетин и получете ексклузивен промо код за{" "}
                <span className="text-white/75">10% отстъпка</span> от следващата поръчка.
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
              {error && <p className="font-sans text-[11px] text-red-400/70 tracking-wide -mt-1">{error}</p>}
              <button type="submit" disabled={submitting} className="btn-primary w-full text-center justify-center disabled:opacity-50">
                {submitting ? "..." : "Получи ексклузивен код"}
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
