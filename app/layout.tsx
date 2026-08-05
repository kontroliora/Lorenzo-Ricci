import type { Metadata, Viewport } from "next";
import "./globals.css";
import { CountryProvider } from "@/lib/country";
import { resolveCountry } from "@/lib/geo";
import { resolveLocale, HTML_LANG } from "@/lib/i18n/locale";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";
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
    "Lorenzo Ricci - Прецизност във всеки детайл. Луксозни хронографи и бижута с 18K позлата. Безплатна доставка. 2г гаранция на часовниците. Доживотна гаранция на бижутата.",
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
  // Country drives geo display (AED/RON pricing, newsletter popup); locale drives
  // language. Deliberately independent — a Bulgarian reading in English is still a
  // BG customer.
  const country = await resolveCountry();
  const locale = await resolveLocale();
  return (
    <html lang={HTML_LANG[locale]} className="scroll-smooth" suppressHydrationWarning>
      <body className="bg-ivory text-charcoal antialiased">
        <MetaPixel />
        <CountryProvider country={country}>
        <LocaleProvider locale={locale}>
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
        </LocaleProvider>
        </CountryProvider>
      </body>
    </html>
  );
}
