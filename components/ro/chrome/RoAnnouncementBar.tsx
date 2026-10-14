"use client";
import { useState, useEffect } from "react";
import { fmtRON, RO_DELIVERY_DAYS, RO_FREE_SHIPPING_RON, RO_INSPECT_BEFORE_PAY } from "@/lib/ro/config";
import { LanguageSwitch } from "@/components/ui/LanguageSwitch";

// Romanian counterpart of components/layout/AnnouncementBar.tsx: same fixed bar, same rotation.
// Every figure comes from lib/ro/config.ts; the "check the parcel before paying" line only appears when the
// courier has confirmed it (RO_INSPECT_BEFORE_PAY), as its own message. The warranty lines are the Bulgarian bar's: 5 years on watches,
// lifetime on jewellery.
// The BG · RO switch sits at the right end of the bar (from 370px up); it is also in the menu panel and the footer. Never beside
// the cart icon: there it pushed the logo off-centre on phones (the 2026-09 toggle did).
const FREE = fmtRON(RO_FREE_SHIPPING_RON);

const DESKTOP = [
  `Livrare gratuită pentru comenzi de peste ${FREE}`,
  "5 ani garanție comercială la ceasuri",
  "Garanție pe viață la bijuterii",
  `Livrare în ${RO_DELIVERY_DAYS} zile lucrătoare · Plata la livrare (ramburs)`,
  ...(RO_INSPECT_BEFORE_PAY ? ["Puteți verifica coletul înainte de plată"] : []),
];
const MOBILE = [
  `Livrare gratuită peste ${FREE}`,
  "Garanție 5 ani la ceasuri",
  "Garanție pe viață la bijuterii",
  `Livrare în ${RO_DELIVERY_DAYS} zile lucrătoare`,
  ...(RO_INSPECT_BEFORE_PAY ? ["Verificare înainte de plată"] : []),
];

export function RoAnnouncementBar() {
  const [index, setIndex] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    let swap: ReturnType<typeof setTimeout> | undefined;
    const id = setInterval(() => {
      setFading(true);
      swap = setTimeout(() => {
        setIndex((i) => (i + 1) % DESKTOP.length);
        setFading(false);
      }, 300);
    }, 5000);
    return () => {
      clearInterval(id);
      if (swap) clearTimeout(swap);
    };
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

      {/* Language switch: right end of the bar. The phone messages are at most ~245px wide and centred, so from 370px up the switch
          fits beside them; narrower phones use the menu panel and the footer. */}
      <div className="hidden min-[370px]:flex absolute right-3 sm:right-8 top-0 h-full items-center text-white">
        <LanguageSwitch current="ro" />
      </div>
    </div>
  );
}
