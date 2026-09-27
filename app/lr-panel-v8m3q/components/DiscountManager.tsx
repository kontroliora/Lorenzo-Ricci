"use client";

import { useState } from "react";
import { products as staticProducts } from "@/lib/products";

const VALID_DISCOUNTS = [10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70];

type ProductRow = {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
};

export default function DiscountManager() {
  const [products, setProducts] = useState<ProductRow[]>(
    staticProducts.map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      originalPrice: p.originalPrice,
    }))
  );
  const [discounts, setDiscounts] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Record<string, string>>({});

  function applyDiscount(product: ProductRow) {
    const pct = parseInt(discounts[product.id] || "");

    if (!VALID_DISCOUNTS.includes(pct)) {
      setStatus((s) => ({
        ...s,
        [product.id]: `Invalid — use: ${VALID_DISCOUNTS.join(", ")}`,
      }));
      return;
    }

    const newPrice = parseFloat(
      (product.price * (1 - pct / 100)).toFixed(2)
    );

    setStatus((s) => ({
      ...s,
      [product.id]: `✓ ${product.price} → ${newPrice} (${pct}% off) — update lib/products.ts to persist`,
    }));
    setProducts((prev) =>
      prev.map((p) =>
        p.id === product.id
          ? { ...p, originalPrice: product.price, price: newPrice }
          : p
      )
    );
  }

  return (
    <div className="p-6 space-y-2">
      <h2 className="text-lg font-semibold mb-4">Discount Manager</h2>
      <div className="text-xs text-gray-400 mb-4">
        Valid: {VALID_DISCOUNTS.join("%, ")}%
      </div>

      <div className="space-y-3">
        {products.map((product) => (
          <div
            key={product.id}
            className="flex items-center gap-4 p-3 border border-gray-200 rounded-lg"
          >
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{product.name}</p>
              <p className="text-xs text-gray-500">
                Current: {product.price}{" "}
                {product.originalPrice
                  ? `| Original: ${product.originalPrice}`
                  : ""}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="number"
                placeholder="%"
                value={discounts[product.id] || ""}
                onChange={(e) =>
                  setDiscounts((d) => ({ ...d, [product.id]: e.target.value }))
                }
                className="w-16 border border-gray-300 rounded px-2 py-1 text-sm text-center"
                min={10}
                max={70}
                step={5}
              />
              <button
                onClick={() => applyDiscount(product)}
                className="bg-black text-white text-xs px-3 py-1.5 rounded hover:bg-gray-800 transition-colors"
              >
                Apply
              </button>
            </div>

            {status[product.id] && (
              <p className="text-xs text-gray-600 w-48 truncate">
                {status[product.id]}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
