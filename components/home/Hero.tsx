"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

export function Hero() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <section className="relative w-full h-screen min-h-[600px] max-h-[1000px] overflow-hidden">
      {/* Hero video background */}
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        className="absolute inset-0 w-full h-full object-cover object-center"
        poster="/covers/desktop cover.webp"
      >
        <source src="/hero-video.mp4" type="video/mp4" />
      </video>

      {/* Base dark overlay - ensures text always readable over video */}
      <div className="absolute inset-0 bg-black/40" />
      {/* Gradient overlay - adds depth top & bottom */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60" />

      {/* Content */}
      <div
        className={`relative z-10 h-full flex flex-col items-center justify-center text-center px-5 transition-all duration-1000 drop-shadow-lg ${
          loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
        }`}
      >
        <p className="font-sans text-[10px] font-light tracking-[0.32em] uppercase text-white/55 mb-6 animate-fade-up">
          Луксозни Часовници &amp; Бижута
        </p>

        <h1 className="font-serif text-display-xl text-white mb-4 animate-fade-up animate-delay-100 text-balance">
          Създадени да
          <br />
          <em className="not-italic text-white">впечатляват</em>
        </h1>

        <p className="font-sans text-sm sm:text-base font-light text-white/70 tracking-widest uppercase mb-10 animate-fade-up animate-delay-200">
          Прецизност във всеки детайл
        </p>

        <div className="flex flex-col sm:flex-row gap-4 animate-fade-up animate-delay-300">
          <Link href="/watches" className="btn-primary min-w-[200px]">
            Разгледай Часовници
          </Link>
          <Link href="/jewellery" className="btn-outline-light min-w-[200px]">
            Разгледай Бижута
          </Link>
        </div>

        {/* Rating pill */}
        <div className="mt-10 flex items-center gap-3 bg-white/8 backdrop-blur-sm border border-white/15 px-5 py-2.5 rounded-full animate-fade-up animate-delay-400">
          <div className="flex gap-0.5 text-white text-xs">★★★★★</div>
          <span className="font-sans text-xs font-light text-white/70 tracking-wide">
            4.8 · 1000+ ревюта
          </span>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 animate-bounce">
        <div className="w-px h-12 bg-gradient-to-b from-white/40 to-transparent mx-auto" />
      </div>
    </section>
  );
}
