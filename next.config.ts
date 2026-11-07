// @ts-check
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // No Vercel image optimiser (its quota ran out on 05.10.2026: /_next/image answered 402 and photos stayed blank). Instead
    // every photo has pre-made resized copies (scripts/make-image-variants.mjs, run before each build) and this loader points
    // each srcset entry at the right one. The widths below are exactly the copy widths of lib/image-widths.json; 2048 = original.
    loader: "custom",
    loaderFile: "./lib/image-loader.ts",
    formats: ["image/webp", "image/avif"],
    deviceSizes: [400, 600, 800, 1200, 2048],
    imageSizes: [192],
    qualities: [60, 70, 75, 80, 85, 90],
    minimumCacheTTL: 86400,
    dangerouslyAllowSVG: false,
  },
  // The hero videos never change under the same name (versioned filenames: bump the name when replacing).
  // Product and review photos: Vercel's default (max-age=0, must-revalidate) made Cloudflare revalidate every request with the
  // origin (cf-cache-status REVALIDATED, first byte 0.1-1.9 s on the product page's main photo). s-maxage lets Cloudflare and
  // Vercel's edge keep them for a day (a deploy clears Vercel's cache; purge Cloudflare after replacing a photo under the same
  // name); browsers keep the 4 h they get today. Image files only: the /products/<slug> pages must never match.
  async headers() {
    const photo = [{ key: "Cache-Control", value: "public, max-age=14400, s-maxage=86400, stale-while-revalidate=604800" }];
    return [
      { source: "/hero-video-:v.mp4", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
      { source: "/Products/:path(.+\\.(?:webp|jpe?g|png|avif))", headers: photo },
      { source: "/reviews/:path(.+\\.(?:webp|jpe?g|png|avif))", headers: photo },
    ];
  },
  experimental: {
    optimizePackageImports: ["zustand"],
    // Client router cache: a dynamic page (every page here — the layout reads geo
    // headers) is reused for 30s when navigating back to it, so switching a colour
    // back and forth is instant. Stock counts are fetched client-side anyway.
    staleTimes: { dynamic: 30, static: 300 },
    // Inline the (14 KB) CSS into the HTML: removes two render-blocking requests
    // from the critical path on mobile.
    inlineCss: true,
  },
};

export default nextConfig;
