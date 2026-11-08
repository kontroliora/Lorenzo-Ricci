"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";

// Women's collection 1+1 (owner, 08.11.2026), BG + RO cart drawers: the cart holds an ODD number of collection pieces, so one more
// piece is free. Before the checkout step opens, this blocks with "Имате право на още едно бижу безплатно" and 4 suggestions (the
// partner of a piece in the cart first: lib/new-collection.ts collectionFreeRanking), each with a one-tap "Добави безплатно" (adds it
// and goes on to the checkout), and a small "Не, благодаря, продължи" (checkout without it). ✕ / backdrop / Escape = back to the cart.
// Phones: a bottom sheet; desktop: a centred dialog. The drawer owns the cart and the suggestions; this is the view only.

export type OddSuggestion = { slug: string; name: string; image: { src: string; alt: string }; priceText: string };
export type OddModalText = { title: string; sub: string; add: string; free: string; decline: string; close: string };

export const ODD_MODAL_BG: OddModalText = {
  title: "Имате право на още едно бижу безплатно",
  sub: "С 1+1 второто бижу е безплатно. Изберете го с едно докосване:",
  add: "Добави безплатно", free: "Безплатно", decline: "Не, благодаря, продължи", close: "Затвори",
};
export const ODD_MODAL_RO: OddModalText = {
  title: "Aveți dreptul la încă o bijuterie gratuită",
  sub: "Cu 1+1, a doua bijuterie este gratuită. Alegeți-o cu o singură atingere:",
  add: "Adăugați gratuit", free: "Gratuit", decline: "Nu, mulțumesc, continuați", close: "Închideți",
};

export function CollectionOddModal({ suggestions, text, onAdd, onContinue, onClose }: {
  suggestions: OddSuggestion[];
  text: OddModalText;
  onAdd: (slug: string) => void;
  onContinue: () => void;
  onClose: () => void;
}) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("keydown", onKey); };
  }, [onClose]);

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={text.title} data-testid="odd-modal" className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center">
      <div aria-hidden onClick={onClose} className={`absolute inset-0 bg-black/55 transition-opacity duration-200 ${shown ? "opacity-100" : "opacity-0"}`} />
      <div className={`relative w-full sm:w-[460px] max-h-[90dvh] overflow-y-auto bg-ivory rounded-t-2xl sm:rounded-none shadow-2xl px-5 sm:px-7 pt-5 pb-[max(16px,env(safe-area-inset-bottom))] transition-all duration-200 ease-out ${
        shown ? "translate-y-0 sm:opacity-100" : "translate-y-full sm:translate-y-0 sm:opacity-0"
      }`}>
        <button type="button" onClick={onClose} aria-label={text.close} className="absolute right-1.5 top-1.5 w-11 h-11 flex items-center justify-center text-ink-soft hover:text-navy text-xl leading-none">✕</button>
        <p className="font-sans text-[10px] tracking-[0.2em] uppercase text-gold-dark font-medium">1+1</p>
        <h2 className="mt-1 pr-8 font-serif text-[22px] sm:text-2xl leading-tight text-charcoal">{text.title}</h2>
        <p className="mt-2 font-sans text-[13px] text-ink-soft leading-snug">{text.sub}</p>

        <div className="mt-4 flex flex-col divide-y divide-border border-y border-border">
          {suggestions.map((s, i) => (
            <div key={s.slug} className="flex items-center gap-3 py-2.5">
              <span className="relative flex-shrink-0 w-16 h-16 bg-white border border-border">
                <Image src={s.image.src} alt={s.image.alt} fill quality={60} sizes="64px" className="object-contain p-1" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-sans text-[13px] text-charcoal leading-snug">{s.name}</p>
                <p className="mt-0.5 font-sans text-xs flex flex-wrap gap-x-2">
                  <span className="text-ink-muted line-through">{s.priceText}</span>
                  <span className="text-[#2F6B3B] font-medium">{text.free}</span>
                </p>
              </div>
              <button
                type="button"
                data-testid={`odd-add-${s.slug}`}
                onClick={() => onAdd(s.slug)}
                className={`flex-shrink-0 w-[104px] sm:w-auto min-h-[44px] px-2 sm:px-3 py-1.5 font-sans text-[10px] sm:text-[11px] leading-tight tracking-[0.1em] uppercase transition-colors ${
                  i === 0 ? "bg-navy text-white hover:bg-navy-light" : "border border-navy text-navy hover:bg-navy hover:text-white"
                }`}
              >
                {text.add}
              </button>
            </div>
          ))}
        </div>

        <button type="button" data-testid="odd-decline" onClick={onContinue} className="mt-3 w-full py-3 font-sans text-xs text-ink-muted underline underline-offset-2 hover:text-charcoal">
          {text.decline}
        </button>
      </div>
    </div>,
    document.body,
  );
}
