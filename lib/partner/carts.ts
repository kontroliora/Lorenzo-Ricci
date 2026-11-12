import { getAbandonedCarts } from "../abandoned-carts-server";
import { cartSection, type CartCallState } from "../abandoned-carts";
import { NEW_COLLECTION_SLUGS } from "../new-collection";

// The partner's "Колички" (owner, 12.11.2026): the same abandoned carts the panel lists (lib/abandoned-carts.ts: Bulgarian, phone
// typed, over EUR 80, 1 h - 14 days, not opted out of e-mails, not "не иска", not 2x "не вдига", no order since), but ONLY those with
// a women's-collection piece (by product id, like his orders). Never the customer's e-mail. His call buttons and notes write the
// same record as the panel (lib/cart-calls.ts), so the owner sees them and nobody phones twice.

export type PartnerCartItem = { name: string; qty: number; price: number; image: string | null; collection: boolean };
export type PartnerCartView = {
  id: string;
  name: string;
  phone: string;
  items: PartnerCartItem[];
  subtotal: number;
  leftAt: string;                 // when the customer left the checkout
  section: "recent" | "missed";   // 1-24 h / older
  call: { state: CartCallState | null; attempts: number; at: string | null; byPartner: boolean };
  note: { text: string; at: string | null; byPartner: boolean };
};
export const PARTNER_CART_KEYS = ["id", "name", "phone", "items", "subtotal", "leftAt", "section", "call", "note"];
export const PARTNER_BY = "партньор";

export async function partnerCarts(nowMs = Date.now()): Promise<PartnerCartView[]> {
  const carts = await getAbandonedCarts(nowMs);
  return carts
    .filter((c) => c.items.some((i) => NEW_COLLECTION_SLUGS.has(i.slug)) && cartSection(c.updatedAt, nowMs) !== "wait")
    .map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      items: c.items.map((i) => ({ name: i.name, qty: i.quantity, price: i.price, image: i.image, collection: NEW_COLLECTION_SLUGS.has(i.slug) })),
      subtotal: c.subtotal,
      leftAt: c.updatedAt,
      section: cartSection(c.updatedAt, nowMs) === "recent" ? "recent" : "missed",
      call: { state: c.callState, attempts: c.callAttempts, at: c.lastCallAt, byPartner: c.callBy === PARTNER_BY },
      note: { text: c.note, at: c.noteAt, byPartner: c.noteBy === PARTNER_BY },
    }));
}
