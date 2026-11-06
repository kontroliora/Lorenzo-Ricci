"use client";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getHealth, type HealthState } from "@/app/lr-panel-v8m3q/marketing-actions";

// Top of every panel page (owner only): green "Системата работи" or red "N проблема"; a click opens the list.
// Reads health_status (written every 15 min by /api/cron/health); refreshes every minute and on each tab change.
const ago = (iso: string | null) => {
  if (!iso) return "—";
  const m = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  return m < 1 ? "току-що" : m < 60 ? `преди ${m} мин` : m < 48 * 60 ? `преди ${Math.round(m / 60)} ч` : `преди ${Math.round(m / 1440)} д`;
};
const plural = (n: number) => (n === 1 ? "проблем" : "проблема");

export function HealthBar() {
  const pathname = usePathname() ?? "";
  const [h, setH] = useState<HealthState | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (pathname.endsWith("/login")) return;
    let alive = true;
    const load = () => getHealth().then((r) => alive && setH(r)).catch(() => {});
    load();
    const t = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(t); };
  }, [pathname]);

  if (!h || pathname.endsWith("/login")) return null;
  const n = h.problems.length;
  const waiting = !h.ready || !h.lastRun;
  const tone = waiting ? "bg-white/[0.04] text-white/50 border-white/10" : n ? "bg-rose-600/90 text-white border-rose-400/40" : "bg-emerald-600/15 text-emerald-300 border-emerald-500/25";

  return (
    <div className={`border-b ${tone}`} data-health-bar>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-2 flex items-center gap-2.5 text-left font-sans text-[13px]">
        <span className={`inline-block w-2 h-2 rounded-full ${waiting ? "bg-white/30" : n ? "bg-white animate-pulse" : "bg-emerald-400"}`} />
        <b className="font-medium tracking-wide">
          {waiting ? "Проверките още не са стартирали" : n ? `${n} ${plural(n)}` : "Системата работи"}
        </b>
        {!waiting && n > 0 && <span className="truncate opacity-90">· {h.problems[0].title}{n > 1 ? " …" : ""}</span>}
        <span className="ml-auto text-[11px] opacity-60 whitespace-nowrap">проверка {ago(h.lastRun)} {open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-3 space-y-1.5 text-[13px]">
          {h.problems.map((p) => (
            <div key={p.key} className="rounded-lg bg-black/20 px-3 py-2">
              <p className="font-medium">{p.title}</p>
              <p className="text-[12px] opacity-75">{p.detail ?? ""}{p.since ? ` · от ${ago(p.since)}` : ""}</p>
            </div>
          ))}
          {n === 0 && !waiting && (
            <p className="text-[12px] opacity-80">Сайт, поръчки, Stripe webhook, Еконт, грешки при поръчка и рекламите са наред. Проблемите идват и в Telegram (най-много веднъж на час).</p>
          )}
          {waiting && <p className="text-[12px]">Таблицата health_status е празна: проверките тръгват на всеки 15 мин от GitHub Actions „health“.</p>}
          {h.unknown.length > 0 && (
            <p className="text-[11px] opacity-60">Не е проверено: {h.unknown.map((u) => `${u.title} (${(u.detail ?? "").replace(/^не е проверено:\s*/, "")})`).join(" · ")}</p>
          )}
        </div>
      )}
    </div>
  );
}
