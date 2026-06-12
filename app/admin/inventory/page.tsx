import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { products } from "@/lib/products";
import { readInventory } from "@/lib/inventory";
import { InventoryTable, type InventoryRow } from "./InventoryTable";

export const dynamic = "force-dynamic";

async function logout() {
  "use server";
  (await cookies()).delete("lr-admin-session");
  redirect("/admin/login");
}

export default async function AdminInventoryPage() {
  const inventory = await readInventory();

  const rows: InventoryRow[] = products.map((p) => ({
    slug:      p.slug,
    name:      p.name,
    sku:       p.sku,
    category:  p.category,
    coverSrc:  p.coverImage.src,
    coverAlt:  p.coverImage.alt,
    stock:     inventory[p.slug] ?? 0,
  }));

  const totalProducts = rows.length;
  const outOfStock    = rows.filter((r) => r.stock === 0).length;
  const lowStock      = rows.filter((r) => r.stock > 0 && r.stock <= 5).length;

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
