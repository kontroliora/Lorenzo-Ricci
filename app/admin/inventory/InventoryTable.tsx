"use client";
import Image from "next/image";
import { useState } from "react";
import type { ProductCategory } from "@/lib/types";

export type InventoryRow = {
  slug: string;
  name: string;
  sku: string;
  category: ProductCategory;
  coverSrc: string;
  coverAlt: string;
  stock: number;
};

const CATEGORY_LABELS: Record<ProductCategory, string> = {
  watches: "Часовници",
  jewellery: "Бижута",
  wallets: "Портфейли",
  cardholders: "Кардхолдъри",
};

const CATEGORY_ORDER: ProductCategory[] = ["watches", "jewellery", "wallets", "cardholders"];

function StockDot({ qty }: { qty: number }) {
  const color =
    qty === 0 ? "bg-red-500" : qty <= 5 ? "bg-amber-400" : "bg-emerald-400";
  return <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${color}`} />;
}

export function InventoryTable({ rows }: { rows: InventoryRow[] }) {
  const [stocks, setStocks] = useState<Record<string, number>>(
    Object.fromEntries(rows.map((r) => [r.slug, r.stock]))
  );
  const [saving, setSaving]   = useState<Record<string, boolean>>({});
  const [saved,  setSaved]    = useState<Record<string, boolean>>({});
  const [errors, setErrors]   = useState<Record<string, string>>({});

  const handleSave = async (slug: string) => {
    setSaving((s) => ({ ...s, [slug]: true }));
    setErrors((e) => ({ ...e, [slug]: "" }));
    try {
      const res = await fetch("/api/admin/inventory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, quantity: stocks[slug] ?? 0 }),
      });
      if (!res.ok) throw new Error("Failed");
      setSaved((s) => ({ ...s, [slug]: true }));
      setTimeout(() => setSaved((s) => ({ ...s, [slug]: false })), 2500);
    } catch {
      setErrors((e) => ({ ...e, [slug]: "Грешка при запис" }));
    }
    setSaving((s) => ({ ...s, [slug]: false }));
  };

  const groupedRows = CATEGORY_ORDER.map((cat) => ({
    cat,
    label: CATEGORY_LABELS[cat],
    items: rows.filter((r) => r.category === cat),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="flex flex-col gap-10">
      {groupedRows.map(({ cat, label, items }) => (
        <div key={cat}>
          {/* Category header */}
          <div className="flex items-center gap-4 mb-3">
            <p className="font-sans text-[10px] tracking-[0.28em] uppercase text-white/35 flex-shrink-0">
              {label}
            </p>
            <div className="flex-1 h-px bg-white/8" />
            <p className="font-sans text-[10px] text-white/20 flex-shrink-0">
              {items.length} продукта
            </p>
          </div>

          {/* Rows */}
          <div className="flex flex-col gap-1">
            {items.map((row) => {
              const qty = stocks[row.slug] ?? 0;
              return (
                <div
                  key={row.slug}
                  className="flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-3 bg-white/3 border border-white/6 hover:bg-white/5 transition-colors"
                >
                  {/* Thumbnail */}
                  <div className="relative w-10 h-10 flex-shrink-0 bg-white overflow-hidden">
                    <Image
                      src={row.coverSrc}
                      alt={row.coverAlt}
                      fill
                      sizes="40px"
                      className="object-contain p-0.5"
                    />
                  </div>

                  {/* Name + SKU */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate" style={{ fontFamily: "Georgia, serif" }}>
                      {row.name}
                    </p>
                    <p className="font-mono text-[10px] text-white/30 mt-0.5">{row.sku}</p>
                  </div>

                  {/* Stock dot */}
                  <StockDot qty={qty} />

                  {/* Quantity input */}
                  <input
                    type="number"
                    min={0}
                    max={9999}
                    value={qty}
                    onChange={(e) =>
                      setStocks((s) => ({
                        ...s,
                        [row.slug]: Math.max(0, parseInt(e.target.value) || 0),
                      }))
                    }
                    className="w-16 sm:w-20 bg-white/5 border border-white/15 px-2 py-2 text-white text-sm text-center focus:outline-none focus:border-white/40 transition-colors font-sans"
                  />

                  {/* Save button */}
                  <button
                    onClick={() => handleSave(row.slug)}
                    disabled={saving[row.slug]}
                    className={`flex-shrink-0 px-3 sm:px-4 py-2 text-[10px] font-sans tracking-[0.15em] uppercase transition-colors ${
                      saved[row.slug]
                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25"
                        : "bg-white text-[#0a0e1f] hover:bg-white/85"
                    } disabled:opacity-40`}
                  >
                    {saving[row.slug] ? "..." : saved[row.slug] ? "✓ Запазено" : "Запази"}
                  </button>

                  {/* Inline error */}
                  {errors[row.slug] && (
                    <p className="text-red-400 text-[10px] font-sans flex-shrink-0">
                      {errors[row.slug]}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
