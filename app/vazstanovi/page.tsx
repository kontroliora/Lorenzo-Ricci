import { Suspense } from "react";
import type { Metadata } from "next";
import { RecoverClient } from "./RecoverClient";

export const metadata: Metadata = {
  title: "Възстановяване на количка — Lorenzo Ricci",
  robots: { index: false, follow: false },
};

function Splash() {
  return (
    <main className="min-h-screen bg-charcoal-deep flex flex-col items-center justify-center px-6 text-center">
      <div className="w-9 h-9 border-2 border-white/15 border-t-white/70 rounded-full animate-spin mb-6" />
      <p className="font-serif text-xl text-white/90">Възстановяваме количката ви…</p>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<Splash />}>
      <RecoverClient />
    </Suspense>
  );
}
