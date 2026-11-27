"use client";
// Live board (owner, 27.11.2026) + the bulk Econt label buttons.
//  LiveRefresh: every 5 s (only while the tab is visible) asks boardVersion(); when anything changed (an order, its history, a
//  partner mark) the server page is re-rendered with router.refresh(): no manual reload, every role, each in its own scope.
//  (Supabase Realtime cannot be used: since rls_lockdown.sql a browser login may not read `orders` at all, and postgres_changes
//  obeys RLS. The server, with its own scope checks, stays the only reader.)
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { boardVersion, createLabelsForConfirmed, todaysLabelsPdf } from "./label-actions";

const POLL_MS = 5_000;

export function LiveRefresh() {
  const router = useRouter();
  const last = useRef<string | null>(null);
  const [ago, setAgo] = useState(0);
  const lastCheck = useRef(Date.now());
  useEffect(() => {
    let stop = false;
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const v = await boardVersion();
        lastCheck.current = Date.now();
        if (!v) return;
        if (last.current !== null && v !== last.current) router.refresh();
        last.current = v;
      } catch { /* offline / redeploy: try again next tick */ }
    };
    tick();
    const t = setInterval(() => { if (!stop) tick(); }, POLL_MS);
    const c = setInterval(() => setAgo(Math.round((Date.now() - lastCheck.current) / 1000)), 1000);
    const onVis = () => { if (document.visibilityState === "visible") tick(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { stop = true; clearInterval(t); clearInterval(c); document.removeEventListener("visibilitychange", onVis); };
  }, [router]);
  return (
    <span title="Таблото се обновява само, на всеки 5 секунди" style={{ color: ago > 20 ? "#FAC775" : "rgba(255,255,255,0.35)", fontSize: 11 }}>
      ● на живо{ago > 20 ? ` · последна проверка преди ${ago} с` : ""}
    </span>
  );
}

const btn: React.CSSProperties = {
  border: "0.5px solid rgba(151,196,89,0.6)", color: "#97C459", background: "rgba(151,196,89,0.08)", fontSize: 12, padding: "8px 14px", borderRadius: 8, cursor: "pointer",
};

export function LabelToolbar({ mode }: { mode: "demo" | "live" }) {
  const [pending, start] = useTransition();
  const [report, setReport] = useState<{ message: string; errors: { ref: string; error: string }[]; links: { ref: string; url: string }[] } | null>(null);
  const router = useRouter();

  const createAll = () => start(async () => {
    setReport(null);
    const r = await createLabelsForConfirmed().catch((e) => ({ ok: false, message: String(e), errors: [] }));
    setReport({ message: r.message, errors: r.errors, links: [] });
    router.refresh();
  });

  const printToday = () => {
    const win = window.open("about:blank", "_blank");   // opened in the click (pop-up blockers)
    start(async () => {
      setReport(null);
      const r = await todaysLabelsPdf().catch((e) => ({ ok: false, message: String(e), links: [] as { ref: string; url: string }[], pdfBase64: undefined }));
      if (r.pdfBase64) {
        const bytes = Uint8Array.from(atob(r.pdfBase64), (ch) => ch.charCodeAt(0));
        const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
        if (win) win.location.href = url; else window.open(url, "_blank");
      } else win?.close();
      setReport({ message: r.message, errors: [], links: r.links });
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, margin: "4px 0 12px" }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button disabled={pending} onClick={createAll} style={btn}>Създай товарителници за всички потвърдени</button>
        <button disabled={pending} onClick={printToday} style={btn}>🖨 Печат на всички днешни</button>
        {mode === "demo" && <span style={{ color: "#FAC775", fontSize: 11 }}>DEMO режим: demo.econt.com, не са истински пратки</span>}
        {pending && <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}>работя… (една по една)</span>}
      </div>
      {report && (
        <div style={{ border: "0.5px solid rgba(255,255,255,0.15)", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "rgba(255,255,255,0.8)" }}>
          <div>{report.message}</div>
          {report.errors.map((e) => <div key={e.ref} style={{ color: "#F09595" }}>{e.ref}: {e.error}</div>)}
          {report.links.map((l) => <div key={l.ref}><a href={l.url} target="_blank" rel="noreferrer" style={{ color: "#85B7EB" }}>{l.ref}: PDF</a></div>)}
        </div>
      )}
    </div>
  );
}
