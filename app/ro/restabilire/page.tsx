import { Suspense } from "react";
import type { Metadata } from "next";
import { RoRecoverClient } from "./RoRecoverClient";

export const metadata: Metadata = {
  title: "Restabilirea coșului - Lorenzo Ricci",
  robots: { index: false, follow: false },
};

function Splash() {
  return (
    <main className="min-h-[70vh] bg-charcoal-deep flex flex-col items-center justify-center px-6 text-center">
      <div className="w-9 h-9 border-2 border-white/15 border-t-white/70 rounded-full animate-spin mb-6" />
      <p className="font-serif text-xl text-white/90">Restabilim coșul dumneavoastră…</p>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<Splash />}>
      <RoRecoverClient />
    </Suspense>
  );
}
