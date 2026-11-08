"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRoCart } from "@/lib/ro/store";
import { roAmounts } from "@/lib/ro/pricing";
import { RO_FREE_SHIPPING_RON, fmtRON } from "@/lib/ro/config";
import { trackWithCapi, genEventId } from "@/lib/fbq";
import { RoCheckoutForm } from "./RoCheckoutForm";
import { opoFreeUnits } from "@/lib/one-plus-one";
import { DrawerTop, ShipProgress, LineItem, SumRow, TotalRow, TrustRow } from "@/components/cart/drawer-ui";
import { RoCartCrossSell } from "./RoCartCrossSell";
import { CollectionOddModal, ODD_MODAL_RO } from "@/components/cart/CollectionOddModal";
import { collectionFreeRanking, collectionUnits, pieceLive } from "@/lib/new-collection";
import { opoGroupOf } from "@/lib/one-plus-one";
import { getProductBySlug } from "@/lib/products";
import { localizeProduct, RO_SLUGS } from "@/lib/ro/catalog";
import { ronOf } from "@/lib/ro/config";
import { useLeatherStock } from "@/lib/use-gifts";
import { roCartLine } from "@/components/ro/product/cart-line";

// Romania cart drawer (port of components/cart/CartDrawer.tsx): lei, card payment only (no ramburs), sets with their discount,
// crossed-out sale prices, free delivery from RO_FREE_SHIPPING_RON (judged on the amount after set discounts). A cart holding a
// product that needs advance payment (EUR 1500 and up) has no order button: the checkout shows the contact flow instead.
// Deliberately without gifts, promo codes, cross-sell and the reservation countdown.
export function RoCartDrawer() {
  const isOpen = useRoCart((s) => s.isOpen);
  const items = useRoCart((s) => s.items);
  const close = useRoCart((s) => s.close);
  const setQuantity = useRoCart((s) => s.setQuantity);
  const removeItem = useRoCart((s) => s.removeItem);
  const [showCheckout, setShowCheckout] = useState(false);
  // Women's collection 1+1: an odd number of collection pieces = one more is free; "Comandă" first offers it (CollectionOddModal).
  const addItem = useRoCart((s) => s.addItem);
  const [oddOpen, setOddOpen] = useState(false);
  const liveStock = useLeatherStock(isOpen);
  const drawerRef = useRef<HTMLDivElement>(null);

  // All money through lib/ro/pricing.ts roAmounts (the server uses the same function). `goods` is after set discounts and is
  // what delivery is judged on.
  const { subtotal, goods, shipping: shippingCost, total } = roAmounts(items);
  const needsPrepayment = items.some((i) => i.prepay);
  // "Economisiți": every crossed-out price minus the current one, over the whole cart.
  const savings = items.reduce((s, i) => s + (i.originalRon != null && i.originalRon > i.ron ? (i.originalRon - i.ron) * i.quantity : 0), 0);
  const count = items.reduce((s, i) => s + i.quantity, 0);
  // The redesigned cart step (owner, 08.11.2026): one red "Reducere" = every saving together (sale prices + sets incl. 1+1).
  const allSavings = savings + (subtotal - goods);
  const freeUnits = opoFreeUnits(items.map((i) => ({ slug: i.slug, unit: i.ron, quantity: i.quantity, onSale: i.onSale })));
  const remaining = Math.max(0, RO_FREE_SHIPPING_RON - goods);
  const progress = Math.min(1, goods / RO_FREE_SHIPPING_RON);
  const reached = remaining === 0 && items.length > 0;

  useEffect(() => {
    if (!isOpen) { setShowCheckout(false); setOddOpen(false); }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, close]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  // Move keyboard focus into the drawer when it opens.
  useEffect(() => {
    if (isOpen) drawerRef.current?.focus({ preventScroll: true });
  }, [isOpen]);

  const collectionLines = items.map((i) => ({ slug: i.slug, quantity: i.quantity }));
  const oddCollection = collectionUnits(collectionLines) % 2 === 1 && !!opoGroupOf(collectionLines.find((l) => collectionUnits([l]) > 0)?.slug);
  const oddSuggestions = oddCollection
    ? collectionFreeRanking(
        items.map((i) => i.slug),
        (slug) => { const p = getProductBySlug(slug); return !!p && p.inStock && pieceLive(slug) && RO_SLUGS.includes(slug) && (liveStock?.[slug] ?? p.stock ?? 1) > 0; },
        new Set(items.map((i) => i.slug)),
      ).slice(0, 4).flatMap((slug) => {
        const raw = getProductBySlug(slug);
        if (!raw) return [];
        const p = localizeProduct(raw);
        return [{ slug, name: p.name, image: p.coverImage, priceText: fmtRON(ronOf(p)) }];
      })
    : [];
  const addFree = (slug: string) => {
    const raw = getProductBySlug(slug);
    if (raw) addItem(roCartLine(localizeProduct(raw), liveStock?.[slug]));
    goCheckout();
  };
  const startCheckout = () => (oddSuggestions.length > 0 ? setOddOpen(true) : goCheckout());
  const goCheckout = () => {
    setOddOpen(false);
    setShowCheckout(true);
    const now = useRoCart.getState().items; // includes a free piece just added from the modal
    trackWithCapi("InitiateCheckout", {
      content_ids:      now.map((i) => i.sku),
      content_category: "RO",
      num_items:        now.reduce((s, i) => s + i.quantity, 0),
      // InitiateCheckout = the value of the goods in the cart (like AddToCart and the Bulgarian InitiateCheckout): delivery is not in it.
      // Purchase keeps the full amount (goods + delivery) on the success page.
      value:            goods,
      currency:         "RON",
    }, genEventId("IC"));
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-charcoal/60 backdrop-blur-xs z-[70] transition-opacity duration-400 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={close}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        tabIndex={-1}
        className={`fixed top-0 right-0 h-full w-full sm:w-[440px] bg-white z-[80] flex flex-col shadow-2xl outline-none transition-transform duration-400 ease-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Coș de cumpărături"
        aria-hidden={!isOpen}
        inert={!isOpen}
      >
        {/* Header - checkout step: same light style as the cart, with the way back to the cart in it */}
        {showCheckout ? (
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <button
              onClick={() => setShowCheckout(false)}
              className="flex items-center gap-2 min-h-[44px] -my-2 pr-3 font-sans text-sm font-medium text-navy/70 transition-colors hover:text-navy"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M8.5 2.5 4 7l4.5 4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
              Coș
            </button>
            <h2 className="font-serif text-[20px] text-navy">Comandă</h2>
            <button onClick={close} aria-label="Închide" className="flex items-center justify-center min-h-[44px] min-w-[44px] -my-2 -mr-3 text-2xl leading-none text-navy/60 transition-colors hover:text-navy">×</button>
          </div>
        ) : (
        <div className="border-b border-border">
          <DrawerTop title={count > 0 ? `Coș · ${count} ${count === 1 ? "produs" : "produse"}` : "Coș"} onClose={close} closeLabel="Închide" />
        </div>
        )}

        {/* Free delivery: progress only while below the threshold (nothing once it is reached) */}
        {items.length > 0 && !showCheckout && !reached && (
          <ShipProgress progress={progress}>
            Mai adăugați <span className="font-semibold text-navy">{fmtRON(remaining)}</span> pentru livrare gratuită
          </ShipProgress>
        )}

        {showCheckout ? (
          <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
            <RoCheckoutForm items={items} />
          </div>
        ) : items.length === 0 ? (
          <div data-testid="drawer-empty" className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <p className="font-serif text-[22px] text-navy">Coșul este gol</p>
            <p className="font-sans text-[13px] text-ink-muted">Adăugați produse pentru a continua</p>
            <div className="flex flex-col sm:flex-row gap-3 mt-3 w-full sm:w-auto">
              <Link href="/ro/ceasuri" onClick={close} className="btn-outline">Ceasuri</Link>
              <Link href="/ro/piele-de-crocodil" onClick={close} className="btn-outline">Piele de crocodil</Link>
            </div>
          </div>
        ) : (
          <>
            {/* Items + the 1+1 upsell */}
            <div className="flex-1 overflow-y-auto px-5 sm:px-6 pb-4">
              {items.map((item, idx) => {
                const atStockLimit = item.stock != null && item.quantity >= item.stock;
                const free = freeUnits[idx] ?? 0;   // units the 1+1 makes free: price struck + "Gratuit" (display only)
                const paid = item.quantity - free;
                return (
                  <LineItem
                    key={item.slug}
                    image={{ src: item.image, alt: item.imageAlt }}
                    name={item.name}
                    note={atStockLimit ? `Stoc disponibil: ${item.stock} buc.` : undefined}
                    quantity={item.quantity}
                    canInc={!atStockLimit}
                    onDec={() => setQuantity(item.slug, item.quantity - 1)}
                    onInc={() => setQuantity(item.slug, item.quantity + 1)}
                    onRemove={() => removeItem(item.slug)}
                    priceText={paid > 0 ? fmtRON(item.ron * paid) : null}
                    originalText={paid > 0 && item.originalRon != null && item.originalRon > item.ron ? fmtRON(item.originalRon * paid) : null}
                    free={free > 0 ? { count: free, unitText: fmtRON(item.ron) } : null}
                    freeText="Gratuit"
                    labels={{ dec: `Scade cantitatea pentru ${item.name}`, inc: `Crește cantitatea pentru ${item.name}`, remove: `Elimină ${item.name} din coș` }}
                  />
                );
              })}
              <RoCartCrossSell />
            </div>

            {/* Footer: summary, button, 3 icons */}
            <div className="px-5 sm:px-6 pt-3 pb-[max(16px,env(safe-area-inset-bottom))] border-t border-border bg-white">
              <div className="flex flex-col gap-1.5">
                {allSavings > 0 && <SumRow label="Reducere" value={`−${fmtRON(allSavings)}`} tone="discount" testId="drawer-discount" />}
                <SumRow label="Livrare" value={shippingCost === 0 ? "Gratuită" : fmtRON(shippingCost)} tone={shippingCost === 0 ? "free" : undefined} testId="drawer-shipping" />
                <TotalRow label="Total" value={fmtRON(total)} />
              </div>

              <button data-testid="drawer-checkout" onClick={startCheckout} className="btn-primary w-full mt-4 py-4 text-[12px] font-semibold">
                {needsPrepayment ? "Continuați comanda - plată în avans" : "Continuați către plată"}
              </button>
              <TrustRow items={[
                { icon: "card", label: "Plată cu cardul" },
                { icon: "truck", label: "Livrare Speedy" },
                { icon: "return", label: "Retur 14 zile" },
              ]} />
            </div>
          </>
        )}
      </div>
      {oddOpen && oddSuggestions.length > 0 && (
        <CollectionOddModal suggestions={oddSuggestions} text={ODD_MODAL_RO} onAdd={addFree} onContinue={goCheckout} onClose={() => setOddOpen(false)} />
      )}
    </>
  );
}
