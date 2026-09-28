"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useCartStore } from "@/lib/store";

// Interaction- and timer-driven chrome, split out of the initial bundle and mounted
// once the page is idle (LCP painted → window load → requestIdleCallback), so its
// JS never competes with the LCP image. The cart drawer additionally mounts the
// moment the store needs it (open, items, or a recovered checkout), so a fast tap
// still opens it. Nothing here renders anything visible before it would have.
const CartDrawer        = dynamic(() => import("@/components/cart/CartDrawer").then((m) => m.CartDrawer), { ssr: false });
const SalesNotification = dynamic(() => import("@/components/ui/SalesNotification").then((m) => m.SalesNotification), { ssr: false });
const NewsletterPopup   = dynamic(() => import("@/components/ui/NewsletterPopup").then((m) => m.NewsletterPopup), { ssr: false });

// true once the page is idle after its LCP; capped so it always resolves.
function useIdle(capMs = 4000): boolean {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    let done = false;
    const mark = () => { if (!done) { done = true; setIdle(true); } };
    const ric = window.requestIdleCallback;
    const onLoad = () => (ric ? ric(mark, { timeout: 3000 }) : setTimeout(mark, 1500));
    const afterLoad = () => (document.readyState === "complete" ? onLoad() : window.addEventListener("load", onLoad, { once: true }));
    let po: PerformanceObserver | undefined;
    try {
      po = new PerformanceObserver(() => { po?.disconnect(); afterLoad(); });
      po.observe({ type: "largest-contentful-paint", buffered: true });
    } catch { afterLoad(); }
    const cap = setTimeout(mark, capMs);
    return () => { done = true; po?.disconnect(); clearTimeout(cap); window.removeEventListener("load", onLoad); };
  }, [capMs]);
  return idle;
}

export function LazyCartDrawer() {
  const idle = useIdle();
  const needed = useCartStore((s) => s.isOpen || s.items.length > 0 || s.pendingCheckout);
  return idle || needed ? <CartDrawer /> : null;
}

export function LazySalesNotification() {
  return useIdle() ? <SalesNotification /> : null;
}

export function LazyNewsletterPopup() {
  return useIdle() ? <NewsletterPopup /> : null;
}
