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
  },
};

export default nextConfig;
