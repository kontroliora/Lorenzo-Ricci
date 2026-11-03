import type { Metadata } from "next";
import { RoProviders } from "@/components/ro/RoProviders";
import { RoAnnouncementBar } from "@/components/ro/chrome/RoAnnouncementBar";
import { RoHeader } from "@/components/ro/chrome/RoHeader";
import { RoFooter } from "@/components/ro/chrome/RoFooter";
import { RoCartDrawer } from "@/components/ro/cart/RoCartDrawer";
import { bundleOfferLive } from "@/lib/bundles";
import { getProductBySlug } from "@/lib/products";

// Romania market test (/ro/...): watches + crocodile leather goods, prices in lei, card payment only (no cash on delivery).
// The Bulgarian chrome is hidden on these paths (components/layout/HideOnAdmin.tsx); this layout brings the Romanian one.
// noindex while it is a test: remove `robots` below when the market is opened to search engines.
export const metadata: Metadata = {
  openGraph: { type: "website", locale: "ro_RO", siteName: "Lorenzo Ricci" },
  robots: { index: false, follow: true },
  other: { "content-language": "ro" },
};

export default function RoLayout({ children }: { children: React.ReactNode }) {
  // "Seturi" in the menu and footer only while a set can be bought with its −10% (none while its pieces are on sale).
  const showSets = bundleOfferLive(getProductBySlug);
  return (
    <div>
      <RoProviders>
        <RoAnnouncementBar />
        <RoHeader showSets={showSets} />
        <div>{children}</div>
        <RoFooter showSets={showSets} />
        <RoCartDrawer />
      </RoProviders>
    </div>
  );
}
