import type { Metadata } from "next";
import { Suspense } from "react";
import { JewelleryPageClient } from "./JewelleryPageClient";

export const metadata: Metadata = {
  title: "Бижута",
  description:
    "Lorenzo Ricci бижута - гривни и колиета с 4-слойно 18K PVD позлата. Хипоалергенни, устойчиви на вода. Доживотна гаранция.",
};

export default function JewelleryPage() {
  return (
    <Suspense>
      <JewelleryPageClient />
    </Suspense>
  );
}
