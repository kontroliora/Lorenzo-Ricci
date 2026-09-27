// @ts-check
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    formats: ["image/webp", "image/avif"],
    deviceSizes: [390, 768, 1024, 1280, 1920],
    imageSizes: [64, 128, 256, 384, 512],
    qualities: [60, 70, 75, 80, 85, 90],
    minimumCacheTTL: 86400,
    dangerouslyAllowSVG: false,
  },
  experimental: {
    optimizePackageImports: ["zustand"],
    // Client router cache: a dynamic page (every page here — the layout reads geo
    // headers) is reused for 30s when navigating back to it, so switching a colour
    // back and forth is instant. Stock counts are fetched client-side anyway.
    staleTimes: { dynamic: 30, static: 300 },
  },
};

export default nextConfig;
