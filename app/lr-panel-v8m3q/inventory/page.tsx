import Link from "next/link";
import { products } from "@/lib/products";
import { readInventory } from "@/lib/inventory";
import { getReservedMap } from "@/lib/orders";
import { InventoryTable, type InventoryRow } from "./InventoryTable";
import { logout } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminInventoryPage() {
  const [inventory, reserved] = await Promise.all([readInventory(), getReservedMap()]);

  const rows: InventoryRow[] = products.map((p) => {
    const stock = inventory[p.slug] ?? 0;
    const res   = reserved[p.slug] ?? 0;
    return {
      slug:      p.slug,
      name:      p.name,
      sku:       p.sku,
      category:  p.category,
      coverSrc:  p.coverImage.src,
      coverAlt:  p.coverImage.alt,
      stock,
      reserved:  res,
      available: Math.max(0, stock - res),
    };
  });

  const totalProducts = rows.length;
  const outOfStock    = rows.filter((r) => r.available === 0).length;
  const lowStock      = rows.filter((r) => r.available > 0 && r.available <= 5).length;

  return (
    <div className="min-h-screen bg-[#0a0e1f] text-white">
      {/* Header */}
      <header className="border-b border-white/8 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <p
              className="text-white tracking-widest uppercase"
              style={{ fontFamily: "Georgia, serif", fontSize: "16px" }}
            >
              Lorenzo Ricci
            </p>
            <p className="font-sans text-[10px] tracking-[0.25em] uppercase text-white/30 mt-0.5">
              Admin · Управление на Инвентара
            </p>
          </div>
          <form action={logout}>
            <button
              type="submit"
              className="font-sans text-xs text-white/35 hover:text-white tracking-widest uppercase transition-colors"
            >
              Изход ↗
            </button>
          </form>
        </div>
      </header>

      {/* Nav tabs */}
      <div className="border-b border-white/6">
        <div className="max-w-5xl mx-auto px-6 flex gap-6">
          <span className="font-sans text-[11px] tracking-widest uppercase py-3 text-white border-b-2 border-white -mb-px">
            Инвентар
          </span>
          <Link
            href="/lr-panel-v8m3q/orders"
            className="font-sans text-[11px] tracking-widest uppercase py-3 text-white/35 hover:text-white transition-colors"
          >
            Поръчки
          </Link>
          <Link
            href="/lr-panel-v8m3q/customers"
            className="font-sans text-[11px] tracking-widest uppercase py-3 text-white/35 hover:text-white transition-colors"
          >
            Клиенти
          </Link>
        </div>
      </div>

      {/* Stats strip */}
      <div className="border-b border-white/6 bg-white/2">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-8">
          <div>
            <p className="font-sans text-[10px] text-white/30 tracking-wide uppercase">Продукти</p>
            <p className="font-sans text-lg text-white mt-0.5">{totalProducts}</p>
          </div>
          <div className="w-px h-8 bg-white/8" />
          <div>
            <p className="font-sans text-[10px] text-white/30 tracking-wide uppercase">Изчерпани</p>
            <p className={`font-sans text-lg mt-0.5 ${outOfStock > 0 ? "text-red-400" : "text-white/30"}`}>
              {outOfStock}
            </p>
          </div>
          <div className="w-px h-8 bg-white/8" />
          <div>
            <p className="font-sans text-[10px] text-white/30 tracking-wide uppercase">Малко наличност</p>
            <p className={`font-sans text-lg mt-0.5 ${lowStock > 0 ? "text-amber-400" : "text-white/30"}`}>
              {lowStock}
            </p>
          </div>
        </div>
      </div>

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-6 py-10">
        <InventoryTable rows={rows} />
      </main>
    </div>
  );
}
