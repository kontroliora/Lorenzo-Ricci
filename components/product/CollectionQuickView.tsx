"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import type { FreeItem, FreePickerText } from "@/components/product/CollectionFreePicker";

// Quick view of a piece in the free-item picker (lib: CollectionFreePicker). Desktop (sm+): a centred modal, photos left, text
// right. Phones: a bottom sheet of ~85% of the screen that slides up; it closes with ✕, a tap on the dim backdrop, Escape, or a
// swipe down (from the handle, or anywhere while the content is scrolled to the top). Photos swipe sideways (scroll-snap). The
// page behind does not scroll while it is open. The button at the bottom stays in place and picks the piece; nothing is added
// to the cart here.

const CLOSE_AT = 110; // px of downward drag that closes the sheet

export function CollectionQuickView({ item, text, onClose, onChoose }: {
  item: FreeItem;
  text: FreePickerText;
  onClose: () => void;
  onChoose: () => void;
}) {
  const [shown, setShown] = useState(false);   // slide-in after mount
  const [drag, setDrag] = useState(0);         // current downward drag (px)
  const [photo, setPhoto] = useState(0);
  const body = useRef<HTMLDivElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const touch = useRef<{ x: number; y: number; fromHandle: boolean; mode: "none" | "drag" | "other" } | null>(null);

  const close = () => { setShown(false); window.setTimeout(onClose, 200); };

  // Lock the page behind (html + body: iOS Safari needs both), Escape closes, focus the close button.
  useEffect(() => {
    const html = document.documentElement, b = document.body;
    const prev = [html.style.overflow, b.style.overflow, b.style.overscrollBehavior];
    html.style.overflow = "hidden"; b.style.overflow = "hidden"; b.style.overscrollBehavior = "none";
    const raf = requestAnimationFrame(() => setShown(true));
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    closeBtn.current?.focus({ preventScroll: true });
    return () => {
      [html.style.overflow, b.style.overflow, b.style.overscrollBehavior] = prev;
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onTouchStart = (e: React.TouchEvent, fromHandle = false) => {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY, fromHandle, mode: "none" };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const s = touch.current;
    if (!s) return;
    const t = e.touches[0];
    const dx = t.clientX - s.x, dy = t.clientY - s.y;
    if (s.mode === "none" && Math.abs(dx) + Math.abs(dy) > 8) {
      const atTop = (body.current?.scrollTop ?? 0) <= 0;
      s.mode = dy > 0 && Math.abs(dy) > Math.abs(dx) && (s.fromHandle || atTop) ? "drag" : "other";
    }
    if (s.mode === "drag") setDrag(Math.max(0, dy));
  };
  const onTouchEnd = () => {
    if (touch.current?.mode === "drag" && drag > CLOSE_AT) close();
    else setDrag(0);
    touch.current = null;
  };

  const onStripScroll = () => {
    const el = strip.current;
    if (el) setPhoto(Math.round(el.scrollLeft / el.clientWidth));
  };
  const goTo = (i: number) => {
    const el = strip.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };

  const photos = item.images.length > 0 ? item.images : [item.image];
  const dragging = drag > 0;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={item.name}
      data-testid="opo-quick-view"
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center"
    >
      <div
        aria-hidden
        onClick={close}
        className={`absolute inset-0 bg-black/45 transition-opacity duration-200 ${shown ? "opacity-100" : "opacity-0"}`}
      />
      <div
        onTouchStart={(e) => onTouchStart(e)}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={dragging ? { transform: `translateY(${drag}px)`, transition: "none" } : undefined}
        className={`relative w-full h-[85dvh] sm:h-auto sm:max-h-[85vh] sm:w-[min(820px,calc(100vw-48px))] bg-ivory sm:bg-white flex flex-col rounded-t-2xl sm:rounded-none shadow-2xl transition-all duration-200 ease-out ${
          shown ? "translate-y-0 sm:opacity-100 sm:scale-100" : "translate-y-full sm:translate-y-0 sm:opacity-0 sm:scale-[0.98]"
        }`}
      >
        {/* Handle (phones) + close */}
        <div
          className="relative flex-shrink-0 h-11 sm:h-12 flex items-center justify-center"
          onTouchStart={(e) => { e.stopPropagation(); onTouchStart(e, true); }}
        >
          <span aria-hidden className="sm:hidden block w-10 h-1 rounded-full bg-ink-faint/60" />
          <button
            ref={closeBtn}
            type="button"
            onClick={close}
            aria-label={text.close}
            className="absolute right-1.5 top-0 w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center text-ink-soft hover:text-navy text-xl leading-none"
          >
            ✕
          </button>
        </div>

        <div ref={body} className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 sm:px-8 pb-4 sm:grid sm:grid-cols-2 sm:gap-8">
          {/* Photos */}
          <div className="relative">
            <div
              ref={strip}
              onScroll={onStripScroll}
              className="flex overflow-x-auto snap-x snap-mandatory bg-white [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {photos.map((p, i) => (
                <div key={p.src} className="relative flex-shrink-0 w-full aspect-square snap-center">
                  <Image src={p.src} alt={p.alt} fill sizes="(max-width: 640px) 90vw, 400px" quality={80} priority={i === 0} className="object-contain" />
                </div>
              ))}
            </div>
            {photos.length > 1 && (
              <>
                <div className="flex justify-center gap-1.5 mt-2.5">
                  {photos.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      aria-label={`${i + 1} / ${photos.length}`}
                      onClick={() => goTo(i)}
                      className="p-1.5 -m-0.5"
                    >
                      <span className={`block w-1.5 h-1.5 rounded-full ${i === photo ? "bg-navy" : "bg-ink-faint/50"}`} />
                    </button>
                  ))}
                </div>
                <button type="button" aria-label="‹" onClick={() => goTo(Math.max(0, photo - 1))} disabled={photo === 0}
                  className="hidden sm:flex absolute left-2 top-[calc(50%-18px)] -translate-y-1/2 w-9 h-9 items-center justify-center bg-white/90 border border-border text-navy disabled:opacity-0">‹</button>
                <button type="button" aria-label="›" onClick={() => goTo(Math.min(photos.length - 1, photo + 1))} disabled={photo === photos.length - 1}
                  className="hidden sm:flex absolute right-2 top-[calc(50%-18px)] -translate-y-1/2 w-9 h-9 items-center justify-center bg-white/90 border border-border text-navy disabled:opacity-0">›</button>
              </>
            )}
          </div>

          {/* Text */}
          <div className="mt-5 sm:mt-0">
            <h2 className="font-serif text-2xl text-charcoal leading-tight">{item.name}</h2>
            <p className="mt-3 font-sans">
              <span className="text-ink-muted line-through mr-3 text-base">{item.priceText}</span>
              <span className="text-[#2F6B3B] font-medium text-sm">{text.free}</span>
            </p>
            {item.description && <p className="mt-4 font-sans text-sm text-ink-soft leading-relaxed">{item.description}</p>}
            <Link href={item.href} className="inline-block mt-4 font-sans text-xs text-navy underline underline-offset-2 py-2">
              {text.details}
            </Link>
          </div>
        </div>

        {/* Fixed bottom button */}
        <div className="flex-shrink-0 px-5 sm:px-8 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] border-t border-border bg-ivory sm:bg-white">
          <button type="button" data-testid="opo-quick-choose" onClick={onChoose} className="btn-primary w-full">
            {text.chooseSecond}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
