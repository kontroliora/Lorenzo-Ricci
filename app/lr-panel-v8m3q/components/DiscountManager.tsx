"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const VALID_DISCOUNTS = [10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70];

type Product = {
  id: string;
  name: string;
  price: number;
  compare_at_price: number | null;
};

export default function DiscountManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [discounts, setDiscounts] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    async function fetchProducts() {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, price, compare_at_price")
        .order("name");

      if (error) {
        console.error(error);
      } else {
        setProducts(data || []);
      }
      setLoading(false);
    }
    fetchProducts();
  }, []);

  async function applyDiscount(product: Product) {
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

    const { error } = await supabase
      .from("products")
      .update({
        compare_at_price: product.price,
        price: newPrice,
      })
      .eq("id", product.id);

    if (error) {
      setStatus((s) => ({ ...s, [product.id]: `Error: ${error.message}` }));
    } else {
      setStatus((s) => ({
        ...s,
        [product.id]: `✓ ${product.price} → ${newPrice} (${pct}% off)`,
      }));
      setProducts((prev) =>
        prev.map((p) =>
          p.id === product.id
            ? { ...p, compare_at_price: product.price, price: newPrice }
            : p
        )
      );
    }
  }

  if (loading) return <p className="p-4 text-sm text-gray-500">Loading products...</p>;

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
                {product.compare_at_price
                  ? `| Original: ${product.compare_at_price}`
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
