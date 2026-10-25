import type { Metadata } from "next";
import { RoProviders } from "@/components/ro/RoProviders";
import { RoAnnouncementBar } from "@/components/ro/chrome/RoAnnouncementBar";
import { RoHeader } from "@/components/ro/chrome/RoHeader";
import { RoFooter } from "@/components/ro/chrome/RoFooter";
import { RoCartDrawer } from "@/components/ro/cart/RoCartDrawer";

// Romania market test (/ro/...): watches + crocodile leather goods, prices in lei, card payment only (no cash on delivery).
// The Bulgarian chrome is hidden on these paths (components/layout/HideOnAdmin.tsx); this layout brings the Romanian one.
// noindex while it is a test: remove `robots` below when the market is opened to search engines.
export const metadata: Metadata = {
  openGraph: { type: "website", locale: "ro_RO", siteName: "Lorenzo Ricci" },
  robots: { index: false, follow: true },
  other: { "content-language": "ro" },
};

export default function RoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
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
