"use client";
import { useState, useEffect } from "react";
import { fmtRON, RO_DELIVERY_DAYS, RO_FREE_SHIPPING_RON, RO_INSPECT_BEFORE_PAY } from "@/lib/ro/config";

// Romanian counterpart of components/layout/AnnouncementBar.tsx: same fixed bar, same rotation.
// Every figure comes from lib/ro/config.ts; the "check the parcel before paying" line only appears when the
// courier has confirmed it (RO_INSPECT_BEFORE_PAY).
const FREE = fmtRON(RO_FREE_SHIPPING_RON);

const DESKTOP = [
  `Livrare gratuită pentru comenzi de peste ${FREE}`,
  "5 ani garanție comercială la ceasuri",
  `Livrare în ${RO_DELIVERY_DAYS} zile lucrătoare · Plata la livrare (ramburs)${RO_INSPECT_BEFORE_PAY ? " · Verifici coletul înainte de plată" : ""}`,
];
const MOBILE = [
  `Livrare gratuită peste ${FREE}`,
  "Garanție 5 ani la ceasuri",
  `Livrare în ${RO_DELIVERY_DAYS} zile lucrătoare`,
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
    </div>
  );
}
