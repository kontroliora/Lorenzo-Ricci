"use client";
import { CARD_PAYMENTS_ENABLED } from "@/lib/payments";
import { useState, useEffect } from "react";
import { LanguageSwitch } from "@/components/ui/LanguageSwitch";
import { opoBarGroups, opoPriceBg } from "@/lib/one-plus-one";
import { watchGiftActive, WATCH_GIFT_TEXT } from "@/lib/watch-gift";

// Every running 1+1 group (lib/one-plus-one.ts: the new jewellery, then the cardholders) leads the rotation, in full white.
// The watch + free cardholder offer (lib/watch-gift.ts) leads while it runs (until 24.12), then drops out on its own.
const OPO_BARS = [
  ...(watchGiftActive() ? [WATCH_GIFT_TEXT.bar] : []),
  ...opoBarGroups().map((g) => g.text.bg.bar({ one: opoPriceBg(g) })),
];

const BASE_DESKTOP = ["Безплатна доставка за поръчки над €60", "5 години търговска гаранция на часовниците · Доживотна на бижутата", CARD_PAYMENTS_ENABLED ? "Доставка за 1–2 работни дни с Еконт · Карта (−5%) или наложен платеж" : "Доставка за 1–2 работни дни с Еконт · Преглед и тест преди плащане"];
const BASE_MOBILE  = ["Безплатна доставка над €60", "Гаранция 5 год. · Доживотна за бижута", "Доставка за 1–2 работни дни с Еконт"];
const DESKTOP = [...OPO_BARS.map((b) => b.desktop), ...BASE_DESKTOP];
const MOBILE  = [...OPO_BARS.map((b) => b.mobile), ...BASE_MOBILE];

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
        data-testid="announcement"
        className={`font-sans text-[10px] tracking-[0.2em] uppercase transition-opacity duration-300 whitespace-nowrap ${index < OPO_BARS.length ? "text-white font-medium" : "text-white/55"}`}
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
