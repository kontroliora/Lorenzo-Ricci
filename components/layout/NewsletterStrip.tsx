"use client";
import { useState } from "react";

export function NewsletterStrip() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) throw new Error("Failed");
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="bg-charcoal-deep border-b border-white/[0.06]">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-14 sm:py-16">
        <div className="max-w-lg mx-auto text-center">
          <p className="font-sans text-[9px] font-medium tracking-[0.34em] uppercase text-white/35 mb-4">
            Lorenzo Ricci · Ексклузивни оферти
          </p>
          <h2 className="font-sans text-2xl sm:text-3xl font-semibold tracking-tight text-white leading-tight mb-3">
            Стани <span className="font-black">VIP</span> член<br />
            на <span className="font-black">Lorenzo Ricci</span>
          </h2>
          <p className="font-sans text-sm font-light text-white/45 leading-relaxed tracking-wide mb-8">
            Получавайте ранни отстъпки, флаш разпродажби и най-новите модели преди всички.
          </p>

          {status === "done" ? (
            <div className="flex items-center gap-3">
              <span className="text-emerald-400 text-lg leading-none">✓</span>
              <p className="font-sans text-sm font-light text-white/70 tracking-wide">
                Добавен сте към VIP листата. Очаквайте скоро.
              </p>
            </div>
          ) : status === "error" ? (
            <p className="font-sans text-sm text-red-400/80 tracking-wide">
              Нещо се обърка. Опитайте отново.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Имейл адрес"
                className="flex-1 bg-transparent border border-white/20 px-4 py-3 font-sans text-sm font-light text-white placeholder:text-white/30 tracking-wide focus:outline-none focus:border-white/50 transition-colors duration-200"
              />
              <button
                type="submit"
                disabled={status === "loading"}
                className="bg-white text-charcoal font-sans text-[11px] font-medium tracking-[0.22em] uppercase px-7 py-3 hover:bg-white/90 transition-colors duration-200 disabled:opacity-60 whitespace-nowrap"
              >
                {status === "loading" ? "…" : "Абонирайте се"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
