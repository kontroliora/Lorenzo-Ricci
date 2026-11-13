import Image from "next/image";
import { eurText } from "@/lib/price";
import { getProductBySlug } from "@/lib/products";
import { giftDisplayName, type GiftLine } from "@/lib/gifts";

// The free cardholder under its clutch's line in the cart drawer (light cart step). Display only:
// no quantity controls, no remove - it follows the clutch and can't be bought on its own.
export function CartGiftRow({ gift }: { gift: GiftLine }) {
  const product = getProductBySlug(gift.giftSlug);
  if (!product) return null;
  return (
    // py-3, not -mt-2: pulled up, the row sat on its paid line's divider and the line ran through "ПОДАРЪК".
    <div data-gift-row className="flex items-center gap-3 pl-[86px] py-3 border-b border-border last:border-0">
      <div className="relative w-10 h-10 flex-shrink-0 bg-white border border-border overflow-hidden">
        <Image
          src={product.coverImage.src}
          alt={product.coverImage.alt}
          fill
          quality={70}
          sizes="36px"
          className="object-contain p-0.5"
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-sans text-[10px] font-medium tracking-[0.2em] uppercase text-[#2F6B3B]">Подарък</p>
        <p className="font-sans text-[13px] text-navy leading-tight">
          {giftDisplayName(gift.giftSlug)} × {gift.qty}
        </p>
      </div>
      <div className="text-right">
        <span className="font-sans text-[12px] text-ink-muted line-through block">
          {eurText(product.price * gift.qty, product.currency)}
        </span>
        <span className="font-sans text-[13px] font-semibold text-[#2F6B3B] block">Подарък</span>
      </div>
    </div>
  );
}
