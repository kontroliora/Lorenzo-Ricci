import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { RoProviders } from "@/components/ro/RoProviders";
import { RoAnnouncementBar } from "@/components/ro/chrome/RoAnnouncementBar";
import { RoHeader } from "@/components/ro/chrome/RoHeader";
import { RoFooter } from "@/components/ro/chrome/RoFooter";
import { RoCartDrawer } from "@/components/ro/cart/RoCartDrawer";

// The root layout loads Inter / Playfair with the latin + cyrillic subsets only, so Romanian ă ș ț would fall back to a
// system font. These two instances add latin-ext for the /ro subtree only (the Bulgarian pages are not touched) and
// take over the same CSS variables inside the wrapper below. Not preloaded: they swap in.
const playfairRo = Playfair_Display({ subsets: ["latin", "latin-ext"], weight: ["400", "500", "600", "700"], style: ["normal"], variable: "--font-cormorant", display: "swap", preload: false });
const interRo = Inter({ subsets: ["latin", "latin-ext"], weight: ["300", "400", "500", "600"], variable: "--font-jost", display: "swap", preload: false });

// Romania market test (/ro/...): watches + crocodile leather goods, prices in lei, cash on delivery.
// The Bulgarian chrome is hidden on these paths (components/layout/HideOnAdmin.tsx); this layout brings the Romanian one.
// noindex while it is a test: remove `robots` below when the market is opened to search engines.
export const metadata: Metadata = {
  openGraph: { type: "website", locale: "ro_RO", siteName: "Lorenzo Ricci" },
  robots: { index: false, follow: true },
  other: { "content-language": "ro" },
};

export default function RoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${playfairRo.variable} ${interRo.variable}`}>
      <RoProviders>
        <RoAnnouncementBar />
        <RoHeader />
        <div>{children}</div>
        <RoFooter />
        <RoCartDrawer />
      </RoProviders>
    </div>
  );
}
