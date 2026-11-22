import type { Metadata, Viewport } from "next";
import { homeOgImage } from "@/lib/og";
import localFont from "next/font/local";
import "./globals.css";

// Self-hosted through next/font/local (app/fonts, see app/fonts/README.txt): nothing is fetched from Google at build or run time,
// the files are preloaded, and the CSS variables below feed tailwind's font-serif/sans. One file per family covers Latin (incl.
// Romanian ă ș ț) and Cyrillic.
// Headings only: no italic (unused anywhere) and not preloaded, so its ~90 KB never competes with the LCP image on 4G;
// text paints in the fallback and swaps.
const playfair = localFont({
  src: "./fonts/PlayfairDisplay-latin-cyrillic.woff2",
  weight: "400 700",
  style: "normal",
  variable: "--font-cormorant",
  display: "swap",
  preload: false,
  adjustFontFallback: "Times New Roman",
});
const inter = localFont({
  src: "./fonts/Inter-latin-cyrillic.woff2",
  weight: "300 600",
  style: "normal",
  variable: "--font-jost",
  display: "swap",
  adjustFontFallback: "Arial",
});
import { Header } from "@/components/layout/Header";
import { AnnouncementBar } from "@/components/layout/AnnouncementBar";
import { BlackFridayBar } from "@/components/layout/BlackFridayBar";
import { blackFridayCountdownActive, BLACK_FRIDAY_END_MS } from "@/lib/black-friday-countdown";
import { BgFooter } from "@/components/layout/BgFooter";
import { LazyCartDrawer, LazySalesNotification } from "@/components/layout/DeferredChrome";
import { CartPersistence } from "@/components/cart/CartPersistence";
import { ThemeProvider } from "@/components/ui/ThemeProvider";
import { MetaPixel } from "@/components/analytics/MetaPixel";
import { PageViewTracker } from "@/components/analytics/PageViewTracker";
import { ClientErrorReporter } from "@/components/analytics/ClientErrorReporter";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { HideOnAdmin } from "@/components/layout/HideOnAdmin";
import { HideOnTrack } from "@/components/layout/HideOnTrack";
import { HideOnCart } from "@/components/layout/HideOnCart";

export const metadata: Metadata = {
  metadataBase: new URL("https://lorenzo-ricci.com"),
  // Only the women's collection is on the shelf (lib/storefront.ts): site-wide copy speaks of it alone.
  title: {
    default: "Lorenzo Ricci - Дамска колекция бижута",
    template: "%s | Lorenzo Ricci",
  },
  description:
    "Lorenzo Ricci - дамска колекция гривни и колиета с 18K позлата, в луксозна велурена кутия. Италиански дизайн. Безплатна доставка над €60. Доживотна гаранция на бижутата.",
  keywords: [
    "Lorenzo Ricci",
    "дамска колекция",
    "дамски бижута",
    "гривни",
    "колиета",
    "бижута позлата",
    "18K PVD",
    "Verdis",
    "Noctis",
    "Lumen",
    "Linea",
    "Solaris",
    "Spira",
  ],
  authors: [{ name: "Lorenzo Ricci" }],
  creator: "Lorenzo Ricci",
  openGraph: {
    type: "website",
    locale: "bg_BG",
    url: "https://lorenzo-ricci.com",
    siteName: "Lorenzo Ricci",
    title: "Lorenzo Ricci - Дамска колекция бижута",
    description:
      "Дамска колекция гривни и колиета с 18K позлата. Италиански дизайн, луксозна велурена кутия.",
    images: [homeOgImage("Lorenzo Ricci - дамска колекция: колие и гривни с 18K позлата")],
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
        <CartPersistence />
        <MetaPixel />
        <ThemeProvider>
          <HideOnAdmin>
            <AnnouncementBar />
            {/* Black Friday countdown: only rendered while the fixed end date (lib/black-friday-countdown.ts) is ahead. The inline
                check hides it before first paint when a page built earlier is opened after the end. */}
            {blackFridayCountdownActive() && (
              <>
                <script dangerouslySetInnerHTML={{ __html: `if(Date.now()>${BLACK_FRIDAY_END_MS})document.documentElement.classList.add("bf-off")` }} />
                <BlackFridayBar />
              </>
            )}
            <Header />
          </HideOnAdmin>
          <main>{children}</main>
          <HideOnAdmin>
            <BgFooter />
            <LazyCartDrawer />
            <HideOnTrack>
              <HideOnCart>
                <LazySalesNotification />
              </HideOnCart>
            </HideOnTrack>
          </HideOnAdmin>
        </ThemeProvider>
        {/* Vercel Web Analytics: page views for the whole site, Bulgarian and /ro (one root layout). */}
        <Analytics />
        <PageViewTracker />
        {/* Browser JS errors -> /api/client-error -> health alerts (rate-limited, no personal data). */}
        <ClientErrorReporter />
        <SpeedInsights />
      </body>
    </html>
  );
}
