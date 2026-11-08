"use client";
import type { ReactNode } from "react";
import Image from "next/image";

// The cart step of the drawer (BG components/cart/CartDrawer.tsx + RO components/ro/cart/RoCartDrawer.tsx), light and minimal
// (owner, 08.11.2026): white, navy text and buttons. Presentational only - each drawer keeps its own cart logic and money.

/** "Количка · 2 продукта" + ✕. */
export function DrawerTop({ title, onClose, closeLabel }: { title: string; onClose: () => void; closeLabel: string }) {
  return (
    <div className="flex items-center justify-between px-5 sm:px-6 pt-4 pb-3">
      <h2 data-testid="drawer-title" className="font-serif text-[20px] text-navy leading-tight">{title}</h2>
      <button onClick={onClose} aria-label={closeLabel} className="w-11 h-11 -mr-3 flex items-center justify-center text-navy/60 hover:text-navy transition-colors text-2xl leading-none">×</button>
    </div>
  );
}

/** One thin line under the title: "Резервирано за 14:32". */
export function ReserveLine({ children, expired }: { children: ReactNode; expired?: boolean }) {
  return (
    <p data-testid="drawer-reserve" className={`px-5 sm:px-6 pb-3 border-b border-border font-sans text-[12px] leading-snug ${expired ? "text-red-700" : "text-ink-muted"}`}>
      {children}
    </p>
  );
}

/** Free-delivery progress, only while below the threshold. */
export function ShipProgress({ progress, children }: { progress: number; children: ReactNode }) {
  return (
    <div data-testid="drawer-ship-progress" className="px-5 sm:px-6 py-3 border-b border-border">
      <p className="font-sans text-[12px] text-charcoal leading-snug">{children}</p>
      <div className="mt-2 h-[3px] w-full bg-navy/10 overflow-hidden">
        <div className="h-full bg-navy transition-[width] duration-500" style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
    </div>
  );
}

/** A cart line: photo, name, quantity, price (original struck if discounted); `free` = units the 1+1 makes free, on their own row. */
export function LineItem({ image, name, note, quantity, canInc, onDec, onInc, onRemove, priceText, originalText, free, freeText, labels }: {
  image: { src: string; alt: string };
  name: string;
  note?: ReactNode;
  quantity: number;
  canInc: boolean;
  onDec: () => void;
  onInc: () => void;
  onRemove: () => void;
  priceText: string | null;          // the paid units (null = every unit is free)
  originalText?: string | null;      // struck before priceText (sale)
  free?: { count: number; unitText: string } | null;
  freeText: string;
  labels: { dec: string; inc: string; remove: string };
}) {
  return (
    <div data-testid="drawer-line" className="py-4 border-b border-border last:border-0">
      <div className="flex gap-3.5">
        <div className="relative w-[72px] h-[72px] flex-shrink-0 bg-white border border-border overflow-hidden">
          <Image src={image.src} alt={image.alt} fill quality={70} sizes="72px" className="object-contain p-1" />
        </div>
        <div className="flex-1 min-w-0 flex flex-col justify-between gap-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h4 className="font-sans text-[14px] font-medium text-navy leading-snug">{name}</h4>
              {note && <p className="font-sans text-[11px] text-ink-muted mt-0.5">{note}</p>}
            </div>
            <button onClick={onRemove} aria-label={labels.remove} className="w-8 h-8 -mt-1.5 -mr-2 flex-shrink-0 flex items-center justify-center text-ink-muted hover:text-navy transition-colors text-[13px]">✕</button>
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center border border-border">
              <button onClick={onDec} aria-label={labels.dec} className="w-9 h-9 flex items-center justify-center text-navy/70 hover:text-navy hover:bg-navy/5 transition-colors text-base">−</button>
              <span className="w-7 text-center font-sans text-[13px] text-navy" aria-live="polite">{quantity}</span>
              <button onClick={onInc} disabled={!canInc} aria-label={labels.inc} className="w-9 h-9 flex items-center justify-center text-navy/70 hover:text-navy hover:bg-navy/5 transition-colors text-base disabled:opacity-25 disabled:cursor-not-allowed">+</button>
            </div>
            {priceText !== null ? (
              <p className="text-right font-sans leading-tight">
                {originalText && <span className="block text-[12px] text-ink-muted line-through">{originalText}</span>}
                <span className="text-[15px] font-semibold text-navy">{priceText}</span>
              </p>
            ) : (
              <FreePrice unitText={free?.unitText ?? ""} count={free?.count ?? 1} freeText={freeText} />
            )}
          </div>
        </div>
      </div>
      {/* The free 1+1 unit(s) of a line that also has paid ones: their own row */}
      {free && free.count > 0 && priceText !== null && (
        <div data-testid="drawer-free-row" className="mt-2 ml-[86px] flex items-center justify-between font-sans text-[12px]">
          <span className="text-ink-muted">1+1{free.count > 1 ? ` × ${free.count}` : ""}</span>
          <FreePrice unitText={free.unitText} count={1} freeText={freeText} />
        </div>
      )}
    </div>
  );
}

function FreePrice({ unitText, count, freeText }: { unitText: string; count: number; freeText: string }) {
  return (
    <p data-testid="drawer-free-price" className="text-right font-sans leading-tight">
      <span className="text-[12px] text-ink-muted line-through mr-2">{count > 1 ? `${count} × ${unitText}` : unitText}</span>
      <span className="text-[14px] font-semibold text-[#2F6B3B]">{freeText}</span>
    </p>
  );
}

/** A plain summary row ("Доставка: Безплатна"); `tone="discount"` = red. */
export function SumRow({ label, value, tone, testId }: { label: string; value: string; tone?: "discount" | "free"; testId?: string }) {
  const color = tone === "discount" ? "text-[#B42318]" : tone === "free" ? "text-[#2F6B3B]" : "text-charcoal";
  return (
    <div data-testid={testId} className={`flex items-center justify-between font-sans text-[13px] ${color}`}>
      <span>{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

/** "Общо €218" big and bold. */
export function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div data-testid="drawer-total" className="flex items-baseline justify-between pt-2.5 mt-1 border-t border-border">
      <span className="font-sans text-[15px] font-semibold text-navy">{label}</span>
      <span className="font-sans text-[22px] font-bold text-navy">{value}</span>
    </div>
  );
}

const ICONS = {
  cash: <><rect x="2" y="6" width="20" height="12" rx="1.5" /><circle cx="12" cy="12" r="2.5" /></>,
  card: <><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></>,
  truck: <><rect x="1" y="5" width="14" height="11" rx="1" /><path d="M15 9h4l3 4v3h-7V9z" /><circle cx="5.5" cy="18" r="2" /><circle cx="18" cy="18" r="2" /></>,
  eye: <><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" /><circle cx="12" cy="12" r="3" /></>,
  return: <><path d="M9 14 4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-3" /></>,
} as const;
export type TrustIcon = keyof typeof ICONS;

/** The row of 3 icons under the button. */
export function TrustRow({ items }: { items: { icon: TrustIcon; label: string }[] }) {
  return (
    <ul data-testid="drawer-trust" className="mt-3 grid grid-cols-3 gap-2">
      {items.map((t) => (
        <li key={t.label} className="flex flex-col items-center gap-1 text-center">
          <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-navy">
            {ICONS[t.icon]}
          </svg>
          <span className="font-sans text-[11px] leading-tight text-ink-muted">{t.label}</span>
        </li>
      ))}
    </ul>
  );
}
