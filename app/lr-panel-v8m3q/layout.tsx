import type { Metadata } from "next";
import { HealthBar } from "@/components/admin/HealthBar";

// The entire admin area must never be indexed by search engines.
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // Health bar on top of every panel page (owner only; hidden on the login screen).
  return <><HealthBar />{children}</>;
}
