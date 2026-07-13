"use client";
import Image from "next/image";
import { getProductBySlug } from "@/lib/products";
import type { OrderItem } from "@/lib/orders";

// Order line items with a small product thumbnail (the product's main catalog
// image — same one shown on the product page). Thumbs are lazy-loaded and
// Next-optimized so the panel stays fast. Manual orders / items without a
// matched product fall back to a neutral placeholder.
export function OrderItemsList({ items }: { items: OrderItem[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, margin: "2px 0" }}>
      {items.map((it, i) => {
        const product = it.slug ? getProductBySlug(it.slug) : undefined;
        const src = product?.coverImage.src;
        const qty = it.quantity ?? it.qty ?? 1;
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                position: "relative", width: 46, height: 46, flexShrink: 0,
                borderRadius: 6, overflow: "hidden",
                background: "rgba(255,255,255,0.05)", border: "0.5px solid rgba(255,255,255,0.1)",
              }}
            >
              {src ? (
                <Image
                  src={src}
                  alt={it.name ?? ""}
                  fill
                  sizes="46px"
                  quality={45}
                  loading="lazy"
                  style={{ objectFit: "cover" }}
                />
              ) : (
                <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.25)", fontSize: 16 }}>
                  ◈
                </div>
              )}
            </div>
            <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, lineHeight: 1.4 }}>
              {it.name ?? "—"} <span style={{ color: "rgba(255,255,255,0.4)" }}>× {qty}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
