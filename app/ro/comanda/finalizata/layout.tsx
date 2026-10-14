import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Plata comenzii",
  robots: { index: false, follow: false },
};

export default function FinalizataLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
