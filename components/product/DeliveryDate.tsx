"use client";
import { useEffect, useState } from "react";
import { Truck } from "lucide-react";
import { deliveryEstimate, deliveryText, type DeliveryEstimate, type DeliveryMarket } from "@/lib/delivery-date";
import { RO_DELIVERY_DAYS } from "@/lib/ro/config";

// BG "Получавате до вт, 21 окт" / RO "Primiți între miercuri, 21 oct și vineri, 23 oct" on the product page and in the cart. The date depends on the visitor's clock (cut-off, weekend), so it is worked out in the
// browser after the page has loaded: the static page never shows yesterday's date. Space is reserved, so nothing jumps when it appears.
export function DeliveryDate({ market, tone = "light" }: { market: DeliveryMarket; tone?: "light" | "dark" }) {
  const [est, setEst] = useState<DeliveryEstimate | null>(null);
  useEffect(() => {
    const tick = () => setEst(deliveryEstimate(Date.now(), market));
    tick();
    const t = setInterval(tick, 60_000);        // the 14:00 cut-off passes while the page is open
    return () => clearInterval(t);
  }, [market]);

  const dark = tone === "dark";
  const sub = market === "bg" ? est?.cutoffText : `Termen estimat: ${RO_DELIVERY_DAYS} zile lucrătoare de la expediere`;
  return (
    <div data-testid="delivery-date" className={market === "ro" ? "min-h-[62px] sm:min-h-[46px]" : "min-h-[46px]"}>   {/* RO: the range text wraps to two lines on a phone */}
      {est && (
        <div className="flex items-start gap-3">
          <Truck className={`mt-0.5 h-5 w-5 flex-shrink-0 ${dark ? "text-[#D4AF37]" : "text-navy"}`} strokeWidth={1.5} aria-hidden />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span data-testid="delivery-date-text" className={`font-sans text-[14px] font-medium leading-snug ${dark ? "text-white" : "text-charcoal"}`}>{deliveryText(est)}</span>
            {sub && <span className={`font-sans text-[13px] font-normal leading-snug ${dark ? "text-[#C9C9C9]" : "text-ink-soft"}`}>{sub}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
