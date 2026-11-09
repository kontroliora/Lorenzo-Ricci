"use client";
import { useEffect, useState } from "react";

// Partner sign-in: e-mail + password (default) or a sign-in link by e-mail. Both give the same 30-day session.
export default function PartnerLogin() {
  const [mode, setMode] = useState<"password" | "link">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");
  const [linkError, setLinkError] = useState(false);
  useEffect(() => { setLinkError(new URLSearchParams(window.location.search).get("e") === "link"); }, []);

  const submitLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("sending");
    await fetch("/api/partner/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) }).catch(() => {});
    setState("sent");
  };

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("sending"); setError("");
    try {
      const r = await fetch("/api/partner/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      if (r.ok) { window.location.href = "/partner"; return; }
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      setError(j.error ?? "Грешен имейл или парола");
    } catch { setError("Няма връзка. Опитайте пак."); }
    setState("idle");
  };

  const input = "w-full bg-white/5 border border-white/15 px-4 py-3.5 text-white text-[16px] placeholder:text-white/30 focus:outline-none focus:border-white/40";
  const button = "bg-white text-[#0a0e1f] text-xs font-semibold tracking-[0.18em] uppercase py-3.5 disabled:opacity-40";

  return (
    <div className="min-h-screen bg-[#0a0e1f] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <p className="text-white tracking-widest uppercase text-[22px]" style={{ fontFamily: "Georgia, serif" }}>Lorenzo Ricci</p>
          <p className="text-[10px] tracking-[0.35em] uppercase text-white/40 mt-2">Партньорски панел</p>
        </div>
        <div className="flex mb-6 border-b border-white/15">
          {(["password", "link"] as const).map((m) => (
            <button key={m} type="button" onClick={() => { setMode(m); setError(""); setState("idle"); }}
              className={`flex-1 pb-3 text-[11px] tracking-[0.18em] uppercase border-b-2 -mb-px ${mode === m ? "text-white border-white" : "text-white/40 border-transparent"}`}>
              {m === "password" ? "С парола" : "С линк по имейл"}
            </button>
          ))}
        </div>
        {mode === "password" ? (
          <form onSubmit={submitPassword} className="flex flex-col gap-4">
            <input type="email" required placeholder="Имейл" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" inputMode="email" className={input} />
            <input type="password" required placeholder="Парола" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" className={input} />
            {error && <p className="text-amber-300 text-[13px]">{error}</p>}
            <button type="submit" disabled={state === "sending" || !email || !password} className={button}>{state === "sending" ? "Вход…" : "Вход"}</button>
          </form>
        ) : state === "sent" ? (
          <p className="text-white/80 text-[15px] text-center leading-relaxed">Ако адресът е на партньор, линк за вход е изпратен. Проверете пощата си (и папка Спам). Линкът важи 15 минути.</p>
        ) : (
          <form onSubmit={submitLink} className="flex flex-col gap-4">
            {linkError && <p className="text-amber-300 text-[13px]">Линкът е изтекъл или вече е използван. Поискайте нов.</p>}
            <input type="email" required placeholder="Имейл" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" className={input} />
            <button type="submit" disabled={state === "sending" || !email} className={button}>{state === "sending" ? "Изпращане…" : "Изпрати линк за вход"}</button>
          </form>
        )}
      </div>
    </div>
  );
}
