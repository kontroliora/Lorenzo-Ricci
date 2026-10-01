import Image from "next/image";
import { getProductBySlug } from "@/lib/products";
import { giftDisplayName, type GiftLine } from "@/lib/gifts";

// The free cardholder under its clutch's line in the cart drawer (dark theme). Display only:
// no quantity controls, no remove - it follows the clutch and can't be bought on its own.
export function CartGiftRow({ gift }: { gift: GiftLine }) {
  const product = getProductBySlug(gift.giftSlug);
  if (!product) return null;
  return (
    <div data-gift-row className="flex items-center gap-3 pl-24 -mt-1 pb-4 border-b border-white/8 last:border-0">
      <div className="relative w-9 h-11 flex-shrink-0 bg-white/5 overflow-hidden">
        <Image
          src={product.coverImage.src}
          alt={product.coverImage.alt}
          fill
          quality={70}
          sizes="36px"
          className="object-cover object-center"
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-sans text-[10px] font-medium tracking-[0.2em] uppercase text-emerald-400">Подарък</p>
        <p className="font-serif text-sm text-white/85 leading-tight">
          {giftDisplayName(gift.giftSlug)} × {gift.qty}
        </p>
      </div>
      <div className="text-right">
        <span className="font-sans text-[11px] text-white/30 line-through block">
          {product.currency}{(product.price * gift.qty).toFixed(2)}
        </span>
        <span className="font-sans text-xs text-emerald-400 block">Подарък</span>
      </div>
    </div>
  );
}
