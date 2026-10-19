"use client";
import Link from "next/link";
import { useState } from "react";

// Romanian newsletter signup (the footer of every /ro page). Same endpoint as the Bulgarian strip, but it sends lang = "ro": the
// subscriber is stored as Romanian, so Bulgarian campaigns never reach them and Romanian ones (and the Romanian unsubscribe page)
// do. No discount code is offered or shown: the Romanian checkout has no promo codes. Explicit consent (unticked checkbox).
export function RoNewsletterStrip() {
  const [email, setEmail] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !agreed) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), lang: "ro" }),
      });
      if (!res.ok) throw new Error("Failed");
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="bg-charcoal-deep border-b border-white/[0.06]" id="abonare">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-14 sm:py-16">
        <div className="max-w-lg mx-auto text-center">
          <p className="font-sans text-[9px] font-medium tracking-[0.34em] uppercase text-white/35 mb-4">Lorenzo Ricci · Noutăți</p>
          <h2 className="font-serif text-2xl sm:text-3xl text-white leading-tight mb-3">Rămâneți la curent</h2>
          <p className="font-sans text-sm font-light text-white/45 leading-relaxed tracking-wide mb-8">
            Abonați-vă pentru a primi pe e-mail noutăți, colecții noi și oferte Lorenzo Ricci.
          </p>

          {status === "done" ? (
            <p className="font-sans text-sm font-light text-white/70 tracking-wide" role="status">
              <span className="text-emerald-400 mr-2" aria-hidden>✓</span>
              Vă mulțumim! V-ați abonat cu succes.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-left">
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Adresa dumneavoastră de e-mail"
                  aria-label="Adresa de e-mail"
                  className="flex-1 bg-transparent border border-white/20 px-4 py-3 font-sans text-base font-light text-white placeholder:text-white/30 tracking-wide focus:outline-none focus:border-white/50"
                />
                <button
                  type="submit"
                  disabled={status === "loading" || !agreed}
                  className="btn-outline-light disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {status === "loading" ? "Se trimite..." : "Abonare"}
                </button>
              </div>
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-0.5 flex-shrink-0 w-3.5 h-3.5 accent-white cursor-pointer"
                />
                <span className="font-sans text-[11px] text-white/45 leading-relaxed tracking-wide">
                  Sunt de acord să primesc e-mailuri cu noutăți și oferte de la Lorenzo Ricci. Mă pot dezabona oricând. Detalii în{" "}
                  <Link href="/ro/politici/confidentialitate" className="text-white/70 underline underline-offset-2 hover:text-white">
                    Politica de confidențialitate
                  </Link>
                  .
                </span>
              </label>
              {status === "error" && (
                <p role="alert" className="font-sans text-xs text-red-400/80 tracking-wide">
                  Nu am putut înregistra abonarea. Vă rugăm să încercați din nou.
                </p>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
