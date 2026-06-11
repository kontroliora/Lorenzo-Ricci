"use client";
import { useState } from "react";

const messages = [
  "БЕЗПЛАТНА ДОСТАВКА ЗА ПОРЪЧКИ НАД €80",
  "2 ГОДИНИ ГАРАНЦИЯ НА ЧАСОВНИЦИТЕ · ДОЖИВОТНА НА БИЖУТАТА",
  "ДОСТАВКА С ЕКОНТ И СПИДИ ДО 2 РАБОТНИ ДНИ · ПРЕГЛЕД ПРЕДИ ПЛАЩАНЕ",
];

export function AnnouncementBar() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="bg-ivory-warm border-b border-border text-center py-2.5 px-4 relative">
      <p className="font-sans text-[10px] sm:text-xs font-medium tracking-[0.22em] uppercase text-charcoal">
        {messages[0]}
      </p>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Затвори"
        className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-faint hover:text-charcoal transition-colors text-lg leading-none"
      >
        ×
      </button>
    </div>
  );
}
