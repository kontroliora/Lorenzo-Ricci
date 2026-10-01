"use client";
import Image from "next/image";
import { getProductBySlug } from "@/lib/products";
import { giftOfferText } from "@/lib/gifts";
import { useGiftFor } from "@/lib/use-gifts";

// Offer block on a clutch's page: the free cardholder that comes with the bag.
// Renders nothing for any other product, or when no cardholder is left to give.
export function GiftOffer({ clutchSlug }: { clutchSlug: string }) {
  const giftSlug = useGiftFor(clutchSlug, 1);
  const gift = giftSlug ? getProductBySlug(giftSlug) : undefined;
  if (!giftSlug || !gift) return null;

  return (
    <div data-gift-offer className="flex items-center gap-4 border border-navy/20 bg-navy-pale/50 px-4 py-3">
      <div className="relative w-14 h-14 flex-shrink-0 bg-white overflow-hidden border border-border">
        <Image
          src={gift.coverImage.src}
          alt={gift.coverImage.alt}
          fill
          quality={70}
          sizes="56px"
          className="object-cover object-center"
        />
      </div>
      <div className="min-w-0">
        <p className="font-sans text-[10px] font-medium tracking-[0.22em] uppercase text-navy">Подарък</p>
        <p className="font-sans text-[13px] font-light text-ink-soft leading-snug tracking-wide">
          {giftOfferText(clutchSlug, giftSlug)}
        </p>
        <p className="font-sans text-xs mt-1">
          <span className="text-ink-faint line-through">{gift.currency}{gift.price.toFixed(2)}</span>
          <span className="ml-2 text-navy font-medium">Подарък</span>
        </p>
      </div>
    </div>
  );
}
