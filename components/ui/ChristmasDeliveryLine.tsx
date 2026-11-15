"use client";
import { useEffect, useState } from "react";
import { CHRISTMAS_DELIVERY, christmasDeliveryActive } from "@/lib/christmas-delivery";

/** The small "Поръчай до 21.12 – доставка преди Коледа" line (lib/christmas-delivery.ts). Decided in the browser after mount, so a
 *  static page never shows it too early or too late; re-checked every minute. `className` sets the look per place. */
export function ChristmasDeliveryLine({ className = "" }: { className?: string }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const check = () => setOn(christmasDeliveryActive());
    check();
    const t = setInterval(check, 60_000);
    return () => clearInterval(t);
  }, []);
  if (!on) return null;
  return <p data-testid="christmas-delivery-line" className={className}>{CHRISTMAS_DELIVERY.text}</p>;
}
