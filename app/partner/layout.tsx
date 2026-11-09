import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Партньор - Lorenzo Ricci",
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0a0e1f" };

export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#f5f0e8] text-[#0a0e1f] font-sans">{children}</div>;
}
