import { notFound } from "next/navigation";
import { PartnerHeader } from "../PartnerHeader";
import { PartnerOrders } from "../PartnerOrders";
import { PiecesList } from "../bijuta/PiecesList";
import { partnerView, matchesFilter, pieceInfo, type PartnerFilter } from "@/lib/partner/orders";
import { buildPartnerOrderEmail } from "@/lib/partner/email";
import { COLLECTION_PIECES } from "@/lib/new-collection";
import { NEW_COLLECTION_PRODUCTS } from "@/lib/new-collection-products";

// DEV ONLY (404 in production): the partner's screens with sample data, for screenshots before a deploy.
export default async function PartnerPreview({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const q = await searchParams;
  const l = (slug: string, price: number, quantity = 1) => ({ slug, price, quantity, name: slug, sku: "" });
  const base = { city: "София", post_code: "1000", courier: "econt", created_at: new Date().toISOString(), email: "customer@example.com", total: 999 };
  const rows = [
    { ...base, order_ref: "LR-TSTCOD1", name: "Мария Иванова", phone: "0888 111 111", address: "Еконт офис София Център", items: [l("necklace-verdis-gold", 109), l("bracelet-lumen-silver", 109)], subtotal: 109, status: "new", payment_method: "cod" },
    { ...base, order_ref: "LR-TSTCARD1", name: "Елена Петрова", phone: "0888 222 222", address: "Еконт офис Пловдив Тракия", items: [l("bracelet-spira-gold", 115)], subtotal: 115, status: "confirmed", payment_method: "card", payment_status: "paid" },
    { ...base, order_ref: "LR-TSTMIX1", name: "Ива Георгиева", phone: "0888 333 333", courier: "home", address: "ул. Тестова 1, ет. 2", items: [l("necklace-verdis-gold", 109), l("chrono-black", 119)], subtotal: 228, status: "new", payment_method: "cod" },
  ];
  const views = rows.map((r, i) => partnerView(r, i === 1 ? { status: "confirmed", note: "Ще вземе в петък", updated_at: null } : null));
  const email = q.email ? views[{ cod: 0, card: 1, mix: 2 }[q.email as "cod" | "card" | "mix"] ?? 0] : null;
  if (email) return <div dangerouslySetInnerHTML={{ __html: buildPartnerOrderEmail(email).replace(/^[\s\S]*<body[^>]*>/, "").replace(/<\/body>[\s\S]*$/, "") }} />;
  if (q.page === "bijuta") {
    const pieces = COLLECTION_PIECES.map((p, i) => {
      const pr = NEW_COLLECTION_PRODUCTS.find((x) => x.slug === p.slug)!; const info = pieceInfo(p.slug)!;
      return { slug: p.slug, model: info.model, color: info.color, stone: info.stone, sku: info.sku, image: pr.images[0].src, price: pr.price, stock: [12, 3, 0, 7][i % 4], onSale: !pr.hidden };
    });
    return (<><PartnerHeader active="pieces" /><PiecesList pieces={pieces} /></>);
  }
  const counts = { new: 0, called: 0, confirmed: 0, all: views.length } as Record<PartnerFilter, number>;
  for (const v of views) for (const f of ["new", "called", "confirmed"] as const) if (matchesFilter(v.state.status, f)) counts[f]++;
  return (<><PartnerHeader active="orders" /><PartnerOrders preview={{ orders: views, counts }} /></>);
}
