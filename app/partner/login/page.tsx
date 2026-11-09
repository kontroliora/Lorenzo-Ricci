"use client";
import { useEffect, useState } from "react";

export default function PartnerLogin() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [linkError, setLinkError] = useState(false);
  useEffect(() => { setLinkError(new URLSearchParams(window.location.search).get("e") === "link"); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("sending");
    await fetch("/api/partner/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) }).catch(() => {});
    setState("sent");
  };

  return (
    <div className="min-h-screen bg-[#0a0e1f] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <p className="text-white tracking-widest uppercase text-[22px]" style={{ fontFamily: "Georgia, serif" }}>Lorenzo Ricci</p>
          <p className="text-[10px] tracking-[0.35em] uppercase text-white/40 mt-2">Партньорски панел</p>
        </div>
        {state === "sent" ? (
          <p className="text-white/80 text-[15px] text-center leading-relaxed">Ако адресът е на партньор, линк за вход е изпратен. Проверете пощата си (и папка Спам). Линкът важи 15 минути.</p>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4">
            {linkError && <p className="text-amber-300 text-[13px]">Линкът е изтекъл или вече е използван. Поискайте нов.</p>}
            <input type="email" required placeholder="Имейл" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email"
              className="w-full bg-white/5 border border-white/15 px-4 py-3.5 text-white text-[16px] placeholder:text-white/30 focus:outline-none focus:border-white/40" />
            <button type="submit" disabled={state === "sending" || !email}
              className="bg-white text-[#0a0e1f] text-xs font-semibold tracking-[0.18em] uppercase py-3.5 disabled:opacity-40">
              {state === "sending" ? "Изпращане…" : "Изпрати линк за вход"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
