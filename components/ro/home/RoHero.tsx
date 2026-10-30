"use client";
import Link from "next/link";
import { getImageProps } from "next/image";
import { useCallback, useEffect, useState } from "react";

// Romanian counterpart of components/home/Hero.tsx: identical cover/video logic and files, Romanian text, buttons to
// the watches and jewellery collections (the crocodile leather goods have their own home section further down).
// The static cover is the page's LCP (fetched at high priority) and the poster under the video. The looping video is
// mounted only after the page has loaded and the browser is idle, so it never competes with the LCP.
// Two encodes, both H.264 / yuv420p / no audio / moov atom first: a vertical 720p crop for phones and 1080p for larger
// screens. The video fades in only once it is really playing: if autoplay is refused (iOS Low Power Mode, data saver)
// or the file fails, the cover simply stays. Phone/desktop split = the cover's own 640px breakpoint.
const DESKTOP_MIN = "(min-width: 640px)";
const VIDEO = { mobile: "/hero-video-mobile.mp4", desktop: "/hero-video-desktop.mp4" } as const;
const POSTER = { mobile: "/covers/mobile%20cover.webp", desktop: "/covers/desktop%20cover.webp" } as const;

// `campaign`: set by the /ro home page while a campaign phase and a discount of at least 5% are live (same rule as the Bulgarian
// hero and its red banner, lib/sale-campaign.ts). Only the headline, subline and buttons change then; null = the original texts.
export function RoHero({ campaign = null }: { campaign?: { label: string; pct: number } | null }) {
  const [loaded, setLoaded] = useState(false);
  const [variant, setVariant] = useState<"mobile" | "desktop" | null>(null);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 100);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    // No video for people who asked for less motion or less data.
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || conn?.saveData) return;

    const mq = window.matchMedia(DESKTOP_MIN);
    let ready = false;
    const apply = () => {
      if (!ready) return;
      setPlaying(false);
      setVariant(mq.matches ? "desktop" : "mobile");
    };
    const start = () => { ready = true; apply(); };
    const idle = () => ("requestIdleCallback" in window ? window.requestIdleCallback(start, { timeout: 2500 }) : setTimeout(start, 1500));
    if (document.readyState === "complete") idle();
    else window.addEventListener("load", idle, { once: true });
    mq.addEventListener("change", apply);
    return () => {
      window.removeEventListener("load", idle);
      mq.removeEventListener("change", apply);
    };
  }, []);

  // React sets `muted` as a property, never as the attribute, and iOS Safari decides on autoplay from
  // the attribute: set both ourselves, then ask to play. A refusal is fine - the cover stays visible.
  const videoRef = useCallback((v: HTMLVideoElement | null) => {
    if (!v) return;
    v.muted = true;
    v.defaultMuted = true;
    v.setAttribute("muted", "");
    v.setAttribute("playsinline", "");
    v.play().catch(() => {});
  }, []);

  // Art direction through next/image's optimizer: one <picture>, two covers.
  // q70 is invisible under the 40% dark overlay and saves ~25 KB on the LCP image.
  const common = { alt: "", fill: true as const, sizes: "100vw", quality: 70, priority: true };
  const { props: mobile } = getImageProps({ ...common, src: "/covers/mobile cover.webp" });
  const { props: desktop } = getImageProps({ ...common, src: "/covers/desktop cover.webp" });

  return (
    <section className="relative w-full h-screen min-h-[600px] max-h-[1000px] overflow-hidden">
      {/* Static cover: shown at once, stays under the video, and stays if the video never starts */}
      <picture>
        <source media={DESKTOP_MIN} srcSet={desktop.srcSet} sizes={desktop.sizes} />
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <img {...mobile} fetchPriority="high" decoding="async" className="absolute inset-0 w-full h-full object-cover object-center" />
      </picture>

      {/* Hero video background: mounted after load, fades in once it is playing */}
      {variant && !failed && (
        <video
          key={variant}
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster={POSTER[variant]}
          onPlaying={() => setPlaying(true)}
          onError={() => setFailed(true)}
          className={`absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-700 ${playing ? "opacity-100" : "opacity-0"}`}
        >
          <source src={VIDEO[variant]} type="video/mp4" onError={() => setFailed(true)} />
        </video>
      )}

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
          Ceasuri de lux, bijuterii &amp; piele de crocodil
        </p>

        {campaign ? (
          <>
            <h1 className="font-serif text-display-xl text-white mb-4 animate-fade-up animate-delay-100 text-balance">
              <em className="not-italic text-white">{campaign.label}</em>
            </h1>

            <p className="font-sans text-sm sm:text-base font-light text-white/70 tracking-widest uppercase mb-10 animate-fade-up animate-delay-200">
              Până la −{campaign.pct}% la ceasuri, bijuterii și piele de crocodil
            </p>

            <div className="flex flex-col sm:flex-row gap-4 animate-fade-up animate-delay-300">
              <Link href="/ro/reduceri" className="btn-primary min-w-[200px]">
                Vedeți reducerile
              </Link>
              <Link href="/ro/ceasuri" className="btn-outline-light min-w-[200px]">
                Descoperiți ceasurile
              </Link>
            </div>
          </>
        ) : (
          <>
            <h1 className="font-serif text-display-xl text-white mb-4 animate-fade-up animate-delay-100 text-balance">
              Create să
              <br />
              <em className="not-italic text-white">impresioneze</em>
            </h1>

            <p className="font-sans text-sm sm:text-base font-light text-white/70 tracking-widest uppercase mb-10 animate-fade-up animate-delay-200">
              Precizie în fiecare detaliu
            </p>

            <div className="flex flex-col sm:flex-row gap-4 animate-fade-up animate-delay-300">
              <Link href="/ro/ceasuri" className="btn-primary min-w-[200px]">
                Descoperiți ceasurile
              </Link>
              <Link href="/ro/bijuterii" className="btn-outline-light min-w-[200px]">
                Descoperiți bijuteriile
              </Link>
            </div>
          </>
        )}

        {/* Rating pill: the reviews are those of the Bulgarian store, said so */}
        <div className="mt-10 flex items-center gap-3 bg-white/8 backdrop-blur-sm border border-white/15 px-5 py-2.5 rounded-full animate-fade-up animate-delay-400">
          <div className="flex gap-0.5 text-white text-xs">★★★★★</div>
          <span className="font-sans text-xs font-light text-white/70 tracking-wide">
            4,8 · 1000+ recenzii clienți (Bulgaria)
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
