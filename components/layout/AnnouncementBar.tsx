"use client";
import { useState, useEffect } from "react";

const DESKTOP = [
  "Безплатна доставка за поръчки над €60",
  "2 години гаранция на часовниците · Доживотна на бижутата",
  "Доставка до 2 работни дни · Преглед и тест преди плащане",
];

const MOBILE = [
  "Безплатна доставка над €60",
  "Гаранция 2 год. · Доживотна за бижута",
  "Доставка до 2 работни дни",
];

export function AnnouncementBar() {
  const [index, setIndex] = useState(0);
  const [fading, setFading] = useState(false);

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
        <span className="hidden sm:inline">{DESKTOP[index]}</span>
        <span className="sm:hidden">{MOBILE[index]}</span>
      </p>
    </div>
  );
}
