"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import Image from "next/image";

const LEFT_IMG  = "/Products/jewellery/description/comparison-left.webp";
const RIGHT_IMG = "/Products/jewellery/description/comparison-right.webp";

export function ComparisonSlider() {
  const [pos, setPos] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const updatePos = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const { left, width } = el.getBoundingClientRect();
    setPos(Math.min(100, Math.max(0, ((clientX - left) / width) * 100)));
  }, []);

  const onMouseDown = useCallback(() => { dragging.current = true; }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => { if (dragging.current) updatePos(e.clientX); };
    const onMouseUp   = () => { dragging.current = false; };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup",   onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup",   onMouseUp);
    };
  }, [updatePos]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      updatePos(e.touches[0].clientX);
    };
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => el.removeEventListener("touchmove", onTouchMove);
  }, [updatePos]);

  return (
    <div
      ref={containerRef}
      className="relative select-none overflow-hidden cursor-col-resize"
      onMouseDown={onMouseDown}
      onTouchStart={(e) => updatePos(e.touches[0].clientX)}
    >
      {/* Right image — base layer */}
      <Image
        src={RIGHT_IMG}
        alt="Стандартно позлатяване"
        width={1200}
        height={800}
        quality={85}
        sizes="(min-width: 768px) 50vw, 100vw"
        className="w-full h-auto block pointer-events-none"
      />

      {/* Left image — clipped overlay */}
      <div
        className="absolute inset-0"
        style={{ clipPath: `polygon(0 0, ${pos}% 0, ${pos}% 100%, 0 100%)` }}
      >
        <Image
          src={LEFT_IMG}
          alt="Lorenzo Ricci 4-слойно 18K PVD покритие"
          width={1200}
          height={800}
          quality={85}
          sizes="(min-width: 768px) 50vw, 100vw"
          className="w-full h-auto block pointer-events-none"
        />
      </div>

      {/* Divider line */}
      <div
        className="absolute top-0 bottom-0 w-[1.5px] bg-white/70 pointer-events-none"
        style={{ left: `${pos}%` }}
      />

      {/* Drag handle */}
      <div
        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-11 h-11 rounded-full bg-white shadow-[0_2px_16px_rgba(0,0,0,0.22)] flex items-center justify-center pointer-events-none"
        style={{ left: `${pos}%` }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a2b4a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
          <line x1="9" y1="12" x2="15" y2="12" stroke="none" />
          <polyline points="9 6 15 12 9 18" transform="translate(6,0)" />
        </svg>
      </div>

      {/* Labels */}
      <div className="absolute top-4 left-4 pointer-events-none"
        style={{ opacity: pos > 15 ? 1 : 0, transition: "opacity 0.2s" }}>
        <span className="font-sans text-[9px] font-medium tracking-[0.22em] uppercase text-white bg-black/40 px-2.5 py-1.5">
          Lorenzo Ricci
        </span>
      </div>
      <div className="absolute top-4 right-4 pointer-events-none"
        style={{ opacity: pos < 85 ? 1 : 0, transition: "opacity 0.2s" }}>
        <span className="font-sans text-[9px] font-medium tracking-[0.22em] uppercase text-white bg-black/40 px-2.5 py-1.5">
          Други Марки
        </span>
      </div>
    </div>
  );
}
