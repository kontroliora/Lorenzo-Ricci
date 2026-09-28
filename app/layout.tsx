import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";

// Self-hosted through next/font: no render-blocking Google Fonts stylesheet, the
// files are preloaded, and the CSS variables below feed tailwind's font-serif/sans.
const playfair = Playfair_Display({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
  display: "swap",
});
const inter = Inter({
  subsets: ["latin", "cyrillic"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-jost",
  display: "swap",
});
import { CountryProvider } from "@/lib/country";
import { resolveCountry } from "@/lib/geo";
import { Header } from "@/components/layout/Header";
import { AnnouncementBar } from "@/components/layout/AnnouncementBar";
import { Footer } from "@/components/layout/Footer";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { SalesNotification } from "@/components/ui/SalesNotification";
import { NewsletterPopup } from "@/components/ui/NewsletterPopup";
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
  // Detected country (Vercel edge header, or the x_geo test cookie) drives geo
  // display like AED pricing. Reading it opts the tree into per-request rendering.
  // Site is Bulgarian-only (EN/RO removed 2026-09-27) - the language switcher and
  // lib/i18n/* are dormant, kept only in case multi-language comes back.
  const country = await resolveCountry();
  return (
    <html lang="bg" className={`scroll-smooth ${playfair.variable} ${inter.variable}`} suppressHydrationWarning>
      <body className="bg-ivory text-charcoal antialiased">
        <MetaPixel />
        <CountryProvider country={country}>
        <ThemeProvider>
          <HideOnAdmin>
            <AnnouncementBar />
            <Header />
          </HideOnAdmin>
          <main>{children}</main>
          <HideOnAdmin>
            <Footer />
            <CartDrawer />
            <HideOnTrack>
              <HideOnCart>
                <SalesNotification />
                {/* 10% newsletter popup is a BG-market offer. Gated on the DETECTED
                    country, not the chosen language: a Bulgarian browsing in English
                    still sees it; a genuine foreign visitor never does, so they can't
                    hit a 10% code that clashes with the 5% waitlist gesture. Unknown
                    country (local dev / missing edge header) is treated as BG so the
                    existing experience never silently disappears at home. */}
                {(country === "BG" || !country) && <NewsletterPopup />}
              </HideOnCart>
            </HideOnTrack>
          </HideOnAdmin>
        </ThemeProvider>
        </CountryProvider>
      </body>
    </html>
  );
}
