import type { MetadataRoute } from "next";
import { absUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api/", "/track/", "/vazstanovi"],
    },
    sitemap: absUrl("/sitemap.xml"),
    host: "https://www.lorenzo-ricci.com",
  };
}
