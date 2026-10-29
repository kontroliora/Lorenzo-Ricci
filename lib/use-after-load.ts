"use client";
import { useEffect, useState } from "react";

// True once the page has loaded and the browser is idle (false during SSR and hydration). Below-the-fold photos that Chrome's
// lazy-load margin would otherwise fetch at once (review photos) wait for it, so on 4G they do not share bandwidth with the
// product photo and the fonts. Render them inside a box of fixed size so nothing moves when they appear.
export function useAfterLoad(): boolean {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const go = () => { if (!cancelled) setLoaded(true); };
    const idle = () => { if ("requestIdleCallback" in window) window.requestIdleCallback(go, { timeout: 2500 }); else setTimeout(go, 800); };
    if (document.readyState === "complete") idle(); else window.addEventListener("load", idle, { once: true });
    return () => { cancelled = true; window.removeEventListener("load", idle); };
  }, []);
  return loaded;
}
