"use client";
import { useState, useEffect } from "react";
import { useT } from "@/lib/i18n/LocaleProvider";
import type { DictKey } from "@/lib/i18n/dict";

const DESKTOP: DictKey[] = ["ann.shipping", "ann.warranty", "ann.delivery"];
const MOBILE:  DictKey[] = ["ann.shipping.short", "ann.warranty.short", "ann.delivery.short"];

export function AnnouncementBar() {
  const [index, setIndex] = useState(0);
  const [fading, setFading] = useState(false);
  const t = useT();

  useEffect(() => {
    const id = setInterval(() => {
      setFading(true);
      const t = setTimeout(() => {
        setIndex((i) => (i + 1) % DESKTOP.length);
        setFading(false);
      }, 300);
      return () => clearTimeout(t);
    }, 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="fixed top-0 left-0 right-0 z-[51] h-9 bg-charcoal flex items-center justify-center px-8 overflow-hidden">
      <p
        className="font-sans text-[10px] tracking-[0.2em] uppercase text-white/55 transition-opacity duration-300 whitespace-nowrap"
        style={{ opacity: fading ? 0 : 1 }}
      >
        <span className="hidden sm:inline">{t(DESKTOP[index])}</span>
        <span className="sm:hidden">{t(MOBILE[index])}</span>
      </p>
    </div>
  );
}
