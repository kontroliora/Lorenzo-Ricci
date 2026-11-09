import type { PartnerPiece } from "@/lib/partner/server";

/** Read-only: photo, price, current stock. */
export function PiecesList({ pieces }: { pieces: PartnerPiece[] }) {
  return (
    <main className="max-w-2xl mx-auto px-3 py-4 pb-16">
      <p className="text-[12px] text-[#6b6456] mb-3">Дамска колекция · наличност в момента</p>
      <div className="grid grid-cols-2 gap-3">
        {pieces.map((p) => (
          <div key={p.slug} className="bg-white rounded-xl overflow-hidden shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.image} alt={p.model} loading="lazy" className="w-full aspect-square object-cover bg-[#efe7d6]" />
            <div className="p-3">
              <p className="text-[14px] font-semibold leading-tight">{p.model}</p>
              <p className="text-[12px] text-[#6b6456] mt-0.5">{[p.color, p.stone].filter(Boolean).join(" · ")}</p>
              <div className="mt-2 flex items-end justify-between">
                <span className="text-[15px] font-bold">€{p.price.toFixed(2)}</span>
                <span className={`text-[12px] font-semibold px-2 py-0.5 rounded ${p.stock === null ? "bg-gray-100 text-gray-600" : p.stock <= 0 ? "bg-red-100 text-red-800" : p.stock <= 3 ? "bg-amber-100 text-amber-900" : "bg-green-100 text-green-900"}`}>
                  {p.stock === null ? "няма данни" : p.stock <= 0 ? "изчерпано" : `${p.stock} бр.`}
                </span>
              </div>
              {!p.onSale && <p className="mt-1 text-[11px] text-[#6b6456]">Не е в магазина</p>}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
