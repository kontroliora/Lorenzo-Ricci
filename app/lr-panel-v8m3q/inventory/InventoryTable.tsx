"use client";
import Image from "next/image";
import { useState } from "react";
import type { ProductCategory } from "@/lib/types";
import { applyProductDiscount } from "./actions";

export type InventoryRow = {
  slug: string;
  name: string;
  sku: string;
  category: ProductCategory;
  coverSrc: string;
  coverAlt: string;
  stock: number;      // free-to-sell count (wallet_inventory.stock)
  reserved: number;   // units in open orders — information only, already out of `stock`
  available: number;  // = stock (unified decrement model)
  tracked: boolean;   // false → no wallet_inventory row → checkout sells it with no cap
  forSale: boolean;   // lib/products.ts inStock — false = owner's off switch
  price: number;
  originalPrice?: number;
};

const CATEGORY_LABELS: Record<ProductCategory, string> = {
  watches: "Часовници",
  jewellery: "Бижута",
  wallets: "Портфейли",
  cardholders: "Кардхолдъри",
  bags: "Чанти",
};

const CATEGORY_ORDER: ProductCategory[] = ["watches", "jewellery", "wallets", "cardholders", "bags"];

const VALID_DISCOUNTS = new Set([10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70]);

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
  const [tracked, setTracked] = useState<Record<string, boolean>>(
    Object.fromEntries(rows.map((r) => [r.slug, r.tracked]))
  );

  // Discount state
  const [discountPct, setDiscountPct] = useState<Record<string, string>>({});
  const [discounting, setDiscounting] = useState<Record<string, boolean>>({});
  const [discountMsg, setDiscountMsg] = useState<Record<string, string>>({});
  const [prices, setPrices] = useState<Record<string, { price: number; originalPrice?: number }>>(
    Object.fromEntries(rows.map((r) => [r.slug, { price: r.price, originalPrice: r.originalPrice }]))
  );

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
      setTracked((t) => ({ ...t, [slug]: true }));
      setTimeout(() => setSaved((s) => ({ ...s, [slug]: false })), 2500);
    } catch {
      setErrors((e) => ({ ...e, [slug]: "Грешка при запис" }));
    }
    setSaving((s) => ({ ...s, [slug]: false }));
  };

  const handleDiscount = async (slug: string) => {
    const pct = parseInt(discountPct[slug] ?? "");
    if (!VALID_DISCOUNTS.has(pct)) {
      setDiscountMsg((m) => ({ ...m, [slug]: "10–70, стъпка 5" }));
      return;
    }
    setDiscounting((d) => ({ ...d, [slug]: true }));
    setDiscountMsg((m) => ({ ...m, [slug]: "" }));
    const result = await applyProductDiscount(slug, pct);
    if (result.ok) {
      setPrices((p) => ({ ...p, [slug]: { price: result.newPrice, originalPrice: result.originalPrice } }));
      setDiscountMsg((m) => ({
        ...m,
        [slug]: `✓ €${result.originalPrice} → €${result.newPrice}`,
      }));
      setDiscountPct((d) => ({ ...d, [slug]: "" }));
    } else {
      setDiscountMsg((m) => ({ ...m, [slug]: result.error }));
    }
    setDiscounting((d) => ({ ...d, [slug]: false }));
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
              const reserved = row.reserved ?? 0;
              const available = qty;
              const rowPrice = prices[row.slug];
              const pct = parseInt(discountPct[row.slug] ?? "");
              const VALID = [10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70];
              const previewPrice = VALID.includes(pct) && rowPrice?.price
                ? (rowPrice.price * (1 - pct / 100)).toFixed(2)
                : null;
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

                  {/* Name + SKU + price */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate" style={{ fontFamily: "Georgia, serif" }}>
                      {row.name}
                    </p>
                    <p className="font-mono text-[10px] text-white/30 mt-0.5">{row.sku}</p>
                    <p className="font-sans text-[10px] text-white/40 mt-0.5">
                      €{rowPrice?.price}
                      {rowPrice?.originalPrice ? (
                        <span className="line-through text-white/20 ml-1">€{rowPrice.originalPrice}</span>
                      ) : null}
                    </p>
                    {!tracked[row.slug] && (
                      <p className="font-sans text-[10px] text-red-400 mt-0.5">
                        Без запис в базата — продава се без ограничение. Запазете число.
                      </p>
                    )}
                    {!row.forSale && (
                      <p className="font-sans text-[10px] text-amber-400/90 mt-0.5">
                        Спрян от продажба (lib/products.ts) — сайтът показва „Изчерпан"
                      </p>
                    )}
                  </div>

                  {/* Reserved + Available */}
                  <div className="flex flex-col items-end flex-shrink-0 leading-tight w-16">
                    <span className="font-sans text-[10px] text-white/30">Резерв. <span className="text-amber-300/80">{reserved}</span></span>
                    <span className="font-sans text-[10px] text-white/30">Нал. <span className={available === 0 ? "text-red-400" : available <= 5 ? "text-amber-400" : "text-emerald-400"}>{available}</span></span>
                  </div>

                  {/* Stock dot */}
                  <StockDot qty={available} />

                  {/* Stock input */}
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
                    title="Налични за продажба"
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

                  {errors[row.slug] && (
                    <p className="text-red-400 text-[10px] font-sans flex-shrink-0">
                      {errors[row.slug]}
                    </p>
                  )}

                  {/* Discount controls */}
                  <div className="flex items-center gap-1.5 border-l border-white/10 pl-3 flex-shrink-0">
                    <div className="flex flex-col items-center gap-0.5">
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="%"
                        value={discountPct[row.slug] ?? ""}
                        onChange={(e) =>
                          setDiscountPct((d) => ({ ...d, [row.slug]: e.target.value }))
                        }
                        className="w-12 bg-white/5 border border-white/15 px-2 py-2 text-white text-sm text-center focus:outline-none focus:border-white/40 transition-colors font-sans"
                      />
                      {previewPrice && (
                        <p className="text-[10px] text-white/55 font-sans mt-0.5">
                          €{rowPrice!.price} → €{previewPrice}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDiscount(row.slug)}
                      disabled={discounting[row.slug]}
                      className="flex-shrink-0 px-3 py-2 text-[10px] font-sans tracking-[0.15em] uppercase bg-white/8 text-white/60 hover:bg-white/15 hover:text-white border border-white/12 transition-colors disabled:opacity-40"
                    >
                      {discounting[row.slug] ? "..." : "−%"}
                    </button>
                  </div>

                  {discountMsg[row.slug] && (
                    <p className={`text-[10px] font-sans flex-shrink-0 ${discountMsg[row.slug].startsWith("✓") ? "text-emerald-400" : "text-red-400"}`}>
                      {discountMsg[row.slug]}
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
