"use client";
import { CARD_PAYMENTS_ENABLED } from "@/lib/payments";
import { useState, useEffect } from "react";
import { LanguageSwitch } from "@/components/ui/LanguageSwitch";
import { cardholderOpo, opoPriceBg } from "@/lib/one-plus-one";

// The cardholders' 1+1 (lib/one-plus-one.ts) leads the rotation while it runs, right before free delivery, in full white.
const OPO = cardholderOpo();
const OPO_BAR = OPO ? OPO.text.bg.bar({ one: opoPriceBg(OPO) }) : null;

const BASE_DESKTOP = ["Безплатна доставка за поръчки над €60", "5 години търговска гаранция на часовниците · Доживотна на бижутата", CARD_PAYMENTS_ENABLED ? "Доставка за 1–2 работни дни с Еконт · Карта (−5%) или наложен платеж" : "Доставка за 1–2 работни дни с Еконт · Преглед и тест преди плащане"];
const BASE_MOBILE  = ["Безплатна доставка над €60", "Гаранция 5 год. · Доживотна за бижута", "Доставка за 1–2 работни дни с Еконт"];
const DESKTOP = OPO_BAR ? [OPO_BAR.desktop, ...BASE_DESKTOP] : BASE_DESKTOP;
const MOBILE  = OPO_BAR ? [OPO_BAR.mobile, ...BASE_MOBILE] : BASE_MOBILE;

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
        className={`font-sans text-[10px] tracking-[0.2em] uppercase transition-opacity duration-300 whitespace-nowrap ${OPO_BAR && index === 0 ? "text-white font-medium" : "text-white/55"}`}
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
