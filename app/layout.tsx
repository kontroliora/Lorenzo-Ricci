import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { SalesNotification } from "@/components/ui/SalesNotification";
import { ThemeProvider } from "@/components/ui/ThemeProvider";
import { MetaPixel } from "@/components/analytics/MetaPixel";

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="bg" className="scroll-smooth" suppressHydrationWarning>
      <body className="bg-ivory text-charcoal antialiased">
        <MetaPixel />
        <ThemeProvider>
          <Header />
          <main>{children}</main>
          <Footer />
          <CartDrawer />
          <SalesNotification />
        </ThemeProvider>
      </body>
    </html>
  );
}
