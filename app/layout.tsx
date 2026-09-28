import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";

// Self-hosted through next/font: no render-blocking Google Fonts stylesheet, the
// files are preloaded, and the CSS variables below feed tailwind's font-serif/sans.
// Headings only: no italic (unused anywhere) and not preloaded, so its ~90 KB
// never competes with the LCP image on 4G; text paints in the fallback and swaps.
const playfair = Playfair_Display({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  style: ["normal"],
  variable: "--font-cormorant",
  display: "swap",
  preload: false,
});
const inter = Inter({
  subsets: ["latin", "cyrillic"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-jost",
  display: "swap",
});
import { Header } from "@/components/layout/Header";
import { AnnouncementBar } from "@/components/layout/AnnouncementBar";
import { Footer } from "@/components/layout/Footer";
import { LazyCartDrawer, LazySalesNotification, LazyNewsletterPopup } from "@/components/layout/DeferredChrome";
import { ThemeProvider } from "@/components/ui/ThemeProvider";
import { MetaPixel } from "@/components/analytics/MetaPixel";
import { HideOnAdmin } from "@/components/layout/HideOnAdmin";
import { HideOnTrack } from "@/components/layout/HideOnTrack";
import { HideOnCart } from "@/components/layout/HideOnCart";

export const metadata: Metadata = {
  metadataBase: new URL("https://lorenzo-ricci.com"),
  title: {
    default: "Lorenzo Ricci - Луксозни Часовници и Бижута",
    template: "%s | Lorenzo Ricci",
  },
  description:
    "Lorenzo Ricci - Прецизност във всеки детайл. Луксозни хронографи и бижута с 18K позлата. Безплатна доставка. 5 г. търговска гаранция на часовниците. Доживотна гаранция на бижутата.",
  keywords: [
    "Lorenzo Ricci",
    "луксозни часовници",
    "хронограф",
    "бижута позлата",
    "18K PVD",
    "сапфирено стъкло",
    "Chrono Black",
    "Golden Eclipse",
    "Polar Frost",
  ],
  authors: [{ name: "Lorenzo Ricci" }],
  creator: "Lorenzo Ricci",
  openGraph: {
    type: "website",
    locale: "bg_BG",
    url: "https://lorenzo-ricci.com",
    siteName: "Lorenzo Ricci",
    title: "Lorenzo Ricci - Луксозни Часовници и Бижута",
    description:
      "Прецизност във всеки детайл. Луксозни хронографи и бижута с 18K позлата.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#FAFAF8",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Bulgaria-only store: no geo header or locale is read here any more (Dubai/AED
  // and EN/RO are gone), so nothing opts the tree into per-request rendering and
  // the storefront pages are built once and served from the edge. lib/i18n/* and
  // lib/geo.ts stay dormant in case a market test comes back.
  return (
    <html lang="bg" className={`scroll-smooth ${playfair.variable} ${inter.variable}`} suppressHydrationWarning>
      <body className="bg-ivory text-charcoal antialiased">
        <MetaPixel />
        <ThemeProvider>
          <HideOnAdmin>
            <AnnouncementBar />
            <Header />
          </HideOnAdmin>
          <main>{children}</main>
          <HideOnAdmin>
            <Footer />
            <LazyCartDrawer />
            <HideOnTrack>
              <HideOnCart>
                <LazySalesNotification />
                {/* 10% newsletter popup: shown to everyone (Bulgaria-only store). */}
                <LazyNewsletterPopup />
              </HideOnCart>
            </HideOnTrack>
          </HideOnAdmin>
        </ThemeProvider>
      </body>
    </html>
  );
}
