"use client";
import { useState, useEffect } from "react";

const messages = [
  "БЕЗПЛАТНА ДОСТАВКА ЗА ПОРЪЧКИ НАД €80",
  "2 ГОДИНИ ГАРАНЦИЯ НА ЧАСОВНИЦИТЕ · ДОЖИВОТНА НА БИЖУТАТА",
  "ДОСТАВКА С ЕКОНТ И СПИДИ ДО 2 РАБОТНИ ДНИ · ПРЕГЛЕД ПРЕДИ ПЛАЩАНЕ",
];

const ROTATE_INTERVAL_MS = 4000;

export function AnnouncementBar() {
  const [dismissed, setDismissed] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (dismissed) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % messages.length);
    }, ROTATE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [dismissed]);

  if (dismissed) return null;

  return (
    <div className="bg-ivory-warm border-b border-border text-center py-2.5 px-4 relative overflow-hidden">
      <p className="font-sans text-[10px] sm:text-xs font-medium tracking-[0.22em] uppercase text-charcoal transition-opacity duration-500">
        {messages[index]}
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
