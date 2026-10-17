"use client";
import { CARD_PAYMENTS_ENABLED } from "@/lib/payments";
import { useState, useEffect } from "react";
import { LanguageSwitch } from "@/components/ui/LanguageSwitch";

const DESKTOP = ["Безплатна доставка за поръчки над €60", "5 години търговска гаранция на часовниците · Доживотна на бижутата", CARD_PAYMENTS_ENABLED ? "Доставка на следващия работен ден · Карта (−5%) или наложен платеж" : "Доставка на следващия работен ден · Преглед и тест преди плащане"];
const MOBILE  = ["Безплатна доставка над €60", "Гаранция 5 год. · Доживотна за бижута", "Доставка на следващия работен ден"];

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
      {/* Desktop only: on phones the switch lives in the menu and the footer (a switch beside the cart pushed the logo off-centre) */}
      <LanguageSwitch current="bg" className="hidden sm:flex absolute right-8 top-1/2 -translate-y-1/2 text-white" />
    </div>
  );
}
