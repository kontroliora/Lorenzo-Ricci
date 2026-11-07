"use client";
// Horizontal swipe on the product gallery without the page jumping (owner, 08.11.2026). The box keeps touch-action: pan-y, so a
// vertical drag still scrolls the page natively; a NON-passive touchmove listener decides the direction on the first few pixels
// and, once the gesture is horizontal, cancels every move of that gesture so the page cannot drift vertically while the photo
// changes. (React's touch handlers are passive and cannot do this.)
import { useEffect, type RefObject } from "react";

const DECIDE_PX = 6;   // movement before the direction is decided
const SWIPE_PX = 40;   // horizontal distance that changes the photo

export function useGallerySwipe(ref: RefObject<HTMLElement | null>, onSwipe: (dir: "next" | "prev") => void): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let start: { x: number; y: number } | null = null;
    let mode: "none" | "h" | "v" = "none";
    const down = (e: TouchEvent) => {
      if (e.touches.length !== 1) { start = null; return; }
      start = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      mode = "none";
    };
    const move = (e: TouchEvent) => {
      if (!start) return;
      const dx = e.touches[0].clientX - start.x, dy = e.touches[0].clientY - start.y;
      if (mode === "none" && Math.max(Math.abs(dx), Math.abs(dy)) >= DECIDE_PX) mode = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
      if (mode === "h" && e.cancelable) e.preventDefault();
    };
    const up = (e: TouchEvent) => {
      if (!start) return;
      const dx = e.changedTouches[0].clientX - start.x;
      const wasH = mode === "h";
      start = null; mode = "none";
      if (wasH && Math.abs(dx) >= SWIPE_PX) onSwipe(dx < 0 ? "next" : "prev");
    };
    el.addEventListener("touchstart", down, { passive: true });
    el.addEventListener("touchmove", move, { passive: false });
    el.addEventListener("touchend", up, { passive: true });
    el.addEventListener("touchcancel", up, { passive: true });
    return () => {
      el.removeEventListener("touchstart", down);
      el.removeEventListener("touchmove", move);
      el.removeEventListener("touchend", up);
      el.removeEventListener("touchcancel", up);
    };
  }, [ref, onSwipe]);
}
