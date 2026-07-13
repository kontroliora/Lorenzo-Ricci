"use client";
import { useState } from "react";
import Image from "next/image";
import { getProductBySlug } from "@/lib/products";
import type { OrderItem } from "@/lib/orders";

const THUMB = 64; // px — left of the name, compact for fast fulfillment scanning

function Placeholder() {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.22)", fontSize: 18 }}>
      ◈
    </div>
  );
}

// One thumbnail. Falls back to a clean placeholder both when there's no matched
// product (manual/legacy items) AND when the image fails to load — never the
// browser's broken-image glyph.
function Thumb({ src, alt }: { src?: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div
      style={{
        position: "relative", width: THUMB, height: THUMB, flexShrink: 0,
        borderRadius: 7, overflow: "hidden",
        background: "rgba(255,255,255,0.05)", border: "0.5px solid rgba(255,255,255,0.1)",
      }}
    >
      {src && !failed ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes="64px"
          quality={60}          // must be one of next.config images.qualities
          loading="lazy"
          style={{ objectFit: "cover" }}
          onError={() => setFailed(true)}
        />
      ) : (
        <Placeholder />
      )}
    </div>
  );
}

// Order line items with a product thumbnail (the product's main catalog image —
// same one shown on the product page). Thumbs are lazy + Next-optimized so the
// panel stays fast even with many orders.
export function OrderItemsList({ items }: { items: OrderItem[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, margin: "3px 0" }}>
      {items.map((it, i) => {
        const product = it.slug ? getProductBySlug(it.slug) : undefined;
        const qty = it.quantity ?? it.qty ?? 1;
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <Thumb src={product?.coverImage.src} alt={it.name ?? ""} />
            <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 13.5, lineHeight: 1.4 }}>
              {it.name ?? "—"} <span style={{ color: "rgba(255,255,255,0.4)" }}>× {qty}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
