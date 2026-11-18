"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

// "Мария от Пловдив закупи …" - REAL orders only (/api/recent-purchases: last 7 days, not cancelled / refused / fake, product in
// stock now). Owner, 18.11.2026:
//   - each order is shown at most ONCE per visitor (ids kept in localStorage), no loop; when the list runs out, nothing more shows;
//   - at most one every 35-40 s (the gap also holds across page loads), never on the checkout / cart (HideOnCart in the layout +
//     the paths below), never on /ro (Bulgarian copy);
//   - the time is the order's real time ("преди 2 часа", "вчера");
//   - desktop (lg+): bottom-left above the sticky bar, ~340 px, fades in 8 px up, stays 6 s;
//   - mobile: at the top under the header, one line, 40 px photo, up to 92% of the width; goes on scroll down or after 5 s;
//   - ✕ stops them until the end of the session (sessionStorage).

type Purchase = { id: string; at: string; firstName: string | null; city: string; product: string; slug: string; image: string };

const GAP_MS = 35_000;          // + 0-5 s jitter -> one every 35-40 s
const FIRST_DELAY_MS = 8_000;
const DESKTOP_MS = 6_000;
const MOBILE_MS = 5_000;
const OUT_MS = 400;
const SEEN_KEY = "lr_sp_seen";  // { [id]: shownAt }
const LAST_KEY = "lr_sp_last";
const OFF_KEY = "lr_sp_off";
const BLOCKED_PATHS = ["/poruchka", "/vazstanovi", "/track", "/ro", "/lr-panel", "/partner"];

const store = {
  get(s: "local" | "session", k: string): string | null { try { return (s === "local" ? localStorage : sessionStorage).getItem(k); } catch { return null; } },
  set(s: "local" | "session", k: string, v: string) { try { (s === "local" ? localStorage : sessionStorage).setItem(k, v); } catch { /* private mode */ } },
};
const readSeen = (): Record<string, number> => { try { return JSON.parse(store.get("local", SEEN_KEY) ?? "{}") ?? {}; } catch { return {}; } };

const sofiaDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Sofia" }).format(d);

/** The order's real time: "преди 5 минути", "преди 2 часа", "вчера", "преди 3 дни" (short: "преди 5 мин.", "преди 2 ч."). */
export function timeAgo(iso: string, now = new Date(), short = false): string {
  const at = new Date(iso);
  const min = Math.max(0, Math.floor((now.getTime() - at.getTime()) / 60_000));
  if (min < 2) return "току-що";
  if (min < 60) return short ? `преди ${min} мин.` : `преди ${min} минути`;
  const h = Math.floor(min / 60);
  const today = sofiaDay(now) === sofiaDay(at);
  if (today || h < 6) return short ? `преди ${h} ч.` : h === 1 ? "преди 1 час" : `преди ${h} часа`;
  const days = Math.round((Date.parse(sofiaDay(now)) - Date.parse(sofiaDay(at))) / 86400_000);
  if (days <= 1) return "вчера";
  return `преди ${days} дни`;
}

export function SalesNotification() {
  const pathname = usePathname() ?? "/";
  const blocked = BLOCKED_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const [queue, setQueue] = useState<Purchase[] | null>(null);
  const [current, setCurrent] = useState<{ p: Purchase; visible: boolean } | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [top, setTop] = useState(96);
  const blockedRef = useRef(blocked);
  blockedRef.current = blocked;

  // Real purchases, minus the ones this visitor has already seen.
  useEffect(() => {
    if (store.get("session", OFF_KEY)) return;
    let alive = true;
    fetch("/api/recent-purchases")
      .then((r) => (r.ok ? r.json() : { purchases: [] }))
      .then((d: { purchases?: Purchase[] }) => {
        if (!alive) return;
        const seen = readSeen();
        setQueue((d.purchases ?? []).filter((p) => !seen[p.id]));
      })
      .catch(() => alive && setQueue([]));
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const on = () => setIsMobile(!mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const hide = useCallback(() => {
    setCurrent((c) => (c ? { ...c, visible: false } : null));
    setTimeout(() => setCurrent(null), OUT_MS);
  }, []);

  // Scheduler: the next one no sooner than 35-40 s after the last one shown (on any page of the site).
  useEffect(() => {
    if (!queue || queue.length === 0 || current) return;
    const last = Number(store.get("local", LAST_KEY) ?? 0);
    const wait = Math.max(FIRST_DELAY_MS, last + GAP_MS + Math.random() * 5000 - Date.now());
    const t = setTimeout(() => {
      if (store.get("session", OFF_KEY)) { setQueue([]); return; }
      if (blockedRef.current || document.hidden) { setQueue((q) => (q ? [...q] : q)); return; } // try again later
      const [next, ...rest] = queue;
      const seen = readSeen();
      const weekAgo = Date.now() - 8 * 86400_000;
      for (const k of Object.keys(seen)) if (seen[k] < weekAgo) delete seen[k];
      seen[next.id] = Date.now();
      store.set("local", SEEN_KEY, JSON.stringify(seen));
      store.set("local", LAST_KEY, String(Date.now()));
      const header = document.querySelector("header");
      setTop(Math.max(8, (header?.getBoundingClientRect().bottom ?? 88) + 8));
      setQueue(rest);
      setCurrent({ p: next, visible: true });
    }, Math.min(wait, GAP_MS + 5000));
    return () => clearTimeout(t);
  }, [queue, current]);

  // Auto-hide: 6 s on desktop, 5 s on mobile (or the first scroll down there).
  useEffect(() => {
    if (!current?.visible) return;
    const t = setTimeout(hide, isMobile ? MOBILE_MS : DESKTOP_MS);
    let onScroll: (() => void) | undefined;
    if (isMobile) {
      const y0 = window.scrollY;
      onScroll = () => { if (window.scrollY - y0 > 16) hide(); };
      window.addEventListener("scroll", onScroll, { passive: true });
    }
    return () => { clearTimeout(t); if (onScroll) window.removeEventListener("scroll", onScroll); };
  }, [current?.visible, current?.p.id, isMobile, hide]);

  if (!current || blocked) return null;
  const { p, visible } = current;
  const who = p.firstName ? `${p.firstName} от ${p.city}` : `Клиент от ${p.city}`;
  const when = timeAgo(p.at);

  const close = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    store.set("session", OFF_KEY, "1");
    setQueue([]);
    hide();
  };

  const thumb = (size: string) => (
    <div className={`relative ${size} flex-shrink-0 overflow-hidden border border-[#B89B5E]/40 bg-white/5`}>
      <Image src={p.image} alt={p.product} fill quality={70} sizes="48px" className="object-contain object-center p-0.5" />
    </div>
  );
  const anim = visible ? "animate-notification-in" : "animate-notification-out";

  if (isMobile) {
    return (
      <div className="fixed inset-x-0 z-[45] flex justify-center pointer-events-none" style={{ top }}>
        <Link
          href={`/products/${p.slug}`}
          key={p.id}
          className={`pointer-events-auto w-[92vw] max-w-[420px] bg-charcoal-deep border border-[#B89B5E]/40 shadow-xl flex items-center gap-2 pl-1.5 pr-0 py-1.5 ${anim}`}
          role="status"
        >
          {thumb("w-10 h-10")}
          {/* One line. 375 px holds no more than the city, the product (without the colour) and the time - the first name is
              desktop-only. When even that is too long, the time shortens first, then a very long city name. */}
          <p className="flex-1 min-w-0 flex items-baseline whitespace-nowrap font-sans text-[11px] font-light text-white/85">
            <span className="shrink-0 max-w-[48%] truncate">Купено в <span className="font-medium text-white">{p.city}</span>:&nbsp;</span>
            <span className="shrink-0 max-w-[48%] truncate text-navy-pale">{p.product.replace(/\s+[–-]\s+(Злато|Сребро)$/, "")}</span>
            <span className="min-w-0 truncate text-white/45">&nbsp;· {timeAgo(p.at, new Date(), true)}</span>
          </p>
          <button onClick={close} aria-label="Затвори" className="w-6 h-8 flex items-center justify-center text-white/40 hover:text-white text-base leading-none flex-shrink-0">×</button>
        </Link>
      </div>
    );
  }

  return (
    <div className="fixed left-6 z-[60] transition-[bottom] duration-300 ease-out" style={{ bottom: "calc(1.5rem + var(--sticky-bar-h, 0px))" }}>
      <Link
        href={`/products/${p.slug}`}
        key={p.id}
        className={`bg-charcoal-deep border border-[#B89B5E]/40 shadow-xl flex items-center gap-3 pl-3 pr-3 py-3 w-[340px] ${anim}`}
        role="status"
      >
        {thumb("w-12 h-12")}
        <div className="flex-1 min-w-0">
          <p className="font-sans text-[12px] font-light text-white/85 leading-snug">
            <span className="font-medium text-white">{who}</span> закупи{" "}
            <span className="text-navy-pale">{p.product}</span>
          </p>
          <p className="font-sans text-[10px] text-white/45 mt-0.5 tracking-wide">{when}</p>
        </div>
        <button onClick={close} aria-label="Затвори" className="self-start text-white/30 hover:text-white transition-colors text-lg leading-none flex-shrink-0 ml-1">×</button>
      </Link>
    </div>
  );
}
