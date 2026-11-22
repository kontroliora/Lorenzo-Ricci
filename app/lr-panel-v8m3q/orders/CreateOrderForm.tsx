"use client";
import { useState, useTransition, useEffect } from "react";
import { allProducts as products } from "@/lib/products"; // the whole catalogue, as before the shop window was narrowed (lib/storefront.ts)
import { usePriceOverrides } from "@/lib/use-price-overrides";
import { calcBundleDiscount, bundleLineText } from "@/lib/bundles";
import { opoGroupOf } from "@/lib/one-plus-one";
import { isOnSale, eurText } from "@/lib/price";
import type { Product } from "@/lib/types";
import { createManualOrder } from "./actions";

const field: React.CSSProperties = {
  width: "100%", background: "rgba(255,255,255,0.05)", border: "0.5px solid rgba(255,255,255,0.12)",
  borderRadius: 8, padding: "9px 12px", color: "#fff", fontSize: 13,
};
const label: React.CSSProperties = {
  display: "block", color: "rgba(255,255,255,0.45)", fontSize: 10, letterSpacing: "0.14em",
  textTransform: "uppercase", marginBottom: 6,
};

export function CreateOrderForm({ onClose }: { onClose: () => void }) {
  const [pending, start] = useTransition();
  const [msg, setMsg]         = useState("");
  const [name, setName]       = useState("");
  const [phone, setPhone]     = useState("");
  const [city, setCity]       = useState("");
  const [courier, setCourier] = useState<"econt" | "home">("econt");
  const [address, setAddress] = useState("");
  // Only slug + quantity live in state. Every price is derived below from the live
  // catalogue, so the form can never show (or send) a price the shop isn't charging.
  const [items, setItems]     = useState<{ slug: string; quantity: number }[]>([]);
  const [total, setTotal]     = useState("");
  const [manualTotal, setManualTotal] = useState(false);
  const [notes, setNotes]     = useState("");
  const [status, setStatus]   = useState<"new" | "confirmed">("new");
  // Замяна по рекламация: клиентът не плаща нищо, но стоката реално излиза.
  const [replacement, setReplacement] = useState(false);
  const [replacesRef, setReplacesRef] = useState("");

  // The same prices the website shows: the catalogue already carries the 1+1 fixed
  // prices (lib/products.ts), and this hook layers today's sale overrides on top
  // (/api/price-overrides). Until the fetch lands it returns the catalogue price, so
  // the form starts correct and only gets sharper — and the server prices the order
  // again on submit, so what is saved is right whatever the browser had.
  const withSale = usePriceOverrides();
  const livePrice = (slug: string): Product | undefined => {
    const p = products.find((x) => x.slug === slug);
    return p ? withSale(p) : undefined;
  };

  const lines = items
    .map((i) => ({ product: livePrice(i.slug), quantity: i.quantity }))
    .filter((l): l is { product: Product; quantity: number } => !!l.product);

  const gross = lines.reduce((s, l) => s + l.product.price * l.quantity, 0);
  // Сетове и 1+1 — точно сметката на количката (lib/bundles.ts).
  const { totalDiscount, active } = calcBundleDiscount(lines);
  const goods = Math.round(Math.max(0, gross - totalDiscount) * 100) / 100;

  // Пре-попълни сумата с авто-изчислената (цена × количество), докато не бъде
  // редактирана ръчно. Изтриване на полето връща авто-режима. Пази срещу
  // случайно въвеждане на единична цена вместо общата (бъгът от LR-IRC30C).
  useEffect(() => {
    if (!manualTotal) setTotal(goods > 0 ? goods.toFixed(2) : "");
  }, [goods, manualTotal]);

  const totalNum = total.trim() && !isNaN(parseFloat(total)) ? parseFloat(total) : goods;
  const underGoods = goods > 0 && manualTotal && totalNum < goods - 0.01;

  const addProduct = (slug: string) => {
    if (!products.some((x) => x.slug === slug)) return;
    setItems((cur) => cur.some((i) => i.slug === slug)
      ? cur.map((i) => i.slug === slug ? { ...i, quantity: i.quantity + 1 } : i)
      : [...cur, { slug, quantity: 1 }]);
  };
  const setQty = (slug: string, q: number) =>
    setItems((cur) => q < 1 ? cur.filter((i) => i.slug !== slug) : cur.map((i) => i.slug === slug ? { ...i, quantity: q } : i));

  const submit = () => start(async () => {
    setMsg("");
    if (replacement && !replacesRef.trim()) { setMsg("Напиши номера на старата поръчка (напр. LR-AB12CD)."); return; }
    const r = await createManualOrder({
      name, phone, city, courier, address,
      items: lines.map((l) => ({
        slug: l.product.slug, name: l.product.name, sku: l.product.sku,
        price: l.product.price, currency: l.product.currency, quantity: l.quantity,
      })),
      // null = let the server price it (catalogue + today's promotions). A number only
      // when the owner typed one, so a discount they meant is never overwritten.
      total: replacement ? 0 : (manualTotal ? totalNum : null),
      replacementFor: replacement ? replacesRef.trim() : null,
      notes, status,
    });
    if (r.ok) onClose();
    else setMsg(r.message);
  });

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "24px 16px" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 460, background: "#0d1220", border: "0.5px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14 }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: "#fff", fontSize: 16, fontWeight: 500 }}>+ Създай ръчна поръчка</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>

        <div>
          <span style={label}>Две имена</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Иван Иванов" style={field} />
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}><span style={label}>Телефон</span><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0888 123 456" inputMode="tel" style={field} /></div>
          <div style={{ flex: 1 }}><span style={label}>Град</span><input value={city} onChange={(e) => setCity(e.target.value)} placeholder="София" style={field} /></div>
        </div>

        <div>
          <span style={label}>Доставка</span>
          <div style={{ display: "flex", gap: 8 }}>
            {(["econt", "home"] as const).map((c) => (
              <button key={c} onClick={() => setCourier(c)}
                style={{ flex: 1, padding: "9px 10px", borderRadius: 8, fontSize: 12, cursor: "pointer",
                  border: `1px solid ${courier === c ? "#85B7EB" : "rgba(255,255,255,0.12)"}`,
                  background: courier === c ? "rgba(133,183,235,0.12)" : "rgba(255,255,255,0.04)",
                  color: courier === c ? "#85B7EB" : "rgba(255,255,255,0.6)" }}>
                {c === "econt" ? "Еконт до офис" : "Личен адрес"}
              </button>
            ))}
          </div>
          <input value={address} onChange={(e) => setAddress(e.target.value)}
            placeholder={courier === "econt" ? "Кой офис на Еконт…" : "Точен адрес…"} style={{ ...field, marginTop: 8 }} />
        </div>

        <div>
          <span style={label}>Продукти (резервира наличност)</span>
          <select onChange={(e) => { addProduct(e.target.value); e.target.value = ""; }} value="" style={{ ...field, cursor: "pointer" }}>
            <option value="">+ добави продукт…</option>
            {products.map((p) => withSale(p)).map((p) => (
              <option key={p.slug} value={p.slug} style={{ color: "#000" }}>
                {p.name} — {eurText(p.price, p.currency)}{isOnSale(p) ? ` (промо, беше ${eurText(p.originalPrice!, p.currency)})` : ""}{opoGroupOf(p.slug) ? " · 1+1" : ""}
              </option>
            ))}
          </select>
          {lines.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
              {lines.map(({ product: p, quantity }) => (
                <div key={p.slug} style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "6px 10px" }}>
                  <span style={{ flex: 1, color: "#fff", fontSize: 13 }}>
                    {p.name}
                    {opoGroupOf(p.slug) && (
                      <span style={{ color: "#C9A7F5", fontSize: 10, marginLeft: 6, letterSpacing: "0.08em" }}>1+1</span>
                    )}
                    {isOnSale(p) && (
                      <span style={{ color: "#97C459", fontSize: 11, marginLeft: 6 }}>
                        промо {eurText(p.price, p.currency)} · <s style={{ color: "rgba(255,255,255,0.35)" }}>{eurText(p.originalPrice!, p.currency)}</s>
                      </span>
                    )}
                  </span>
                  <button onClick={() => setQty(p.slug, quantity - 1)} style={qtyBtn}>−</button>
                  <span style={{ color: "#fff", fontSize: 13, minWidth: 18, textAlign: "center" }}>{quantity}</span>
                  <button onClick={() => setQty(p.slug, quantity + 1)} style={qtyBtn}>+</button>
                  <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 12, minWidth: 52, textAlign: "right" }}>{(p.price * quantity).toFixed(2)} {p.currency}</span>
                </div>
              ))}
              {active.length > 0 && (
                <div style={{ background: "rgba(151,196,89,0.08)", border: "0.5px solid rgba(151,196,89,0.25)", borderRadius: 8, padding: "6px 10px", display: "flex", flexDirection: "column", gap: 3 }}>
                  {active.map((b) => (
                    <div key={b.id} style={{ display: "flex", justifyContent: "space-between", color: "#97C459", fontSize: 12 }}>
                      <span>{bundleLineText(b)}</span><span>−{b.discount.toFixed(2)} €</span>
                    </div>
                  ))}
                  <div style={{ display: "flex", justifyContent: "space-between", color: "rgba(255,255,255,0.55)", fontSize: 11, borderTop: "0.5px solid rgba(255,255,255,0.08)", paddingTop: 3 }}>
                    <span>стока {gross.toFixed(2)} € − отстъпки</span><span>{goods.toFixed(2)} €</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ background: replacement ? "rgba(201,167,245,0.08)" : "transparent", border: `0.5px solid ${replacement ? "rgba(201,167,245,0.3)" : "rgba(255,255,255,0.08)"}`, borderRadius: 10, padding: "10px 12px" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, color: "rgba(255,255,255,0.75)", fontSize: 12, cursor: "pointer" }}>
            <input type="checkbox" checked={replacement} onChange={(e) => setReplacement(e.target.checked)} />
            Замяна по рекламация — клиентът не плаща нищо
          </label>
          {replacement && (
            <>
              <input
                value={replacesRef}
                onChange={(e) => setReplacesRef(e.target.value.toUpperCase())}
                placeholder="Номер на старата поръчка, напр. LR-AB12CD"
                style={{ ...field, marginTop: 8 }}
              />
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, margin: "6px 0 0", lineHeight: 1.45 }}>
                Сумата става <b>0</b> и оборотът не се пипа. Стоката пак излиза от наличността, защото реално я изпращаш.
                На старата поръчка заведи рекламация с изход <b>„Замяна · нова стока"</b>.
              </p>
            </>
          )}
        </div>

        <div style={{ display: replacement ? "none" : "block" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={label}>Сума за наложен платеж</span>
            {manualTotal && (
              <button onClick={() => setManualTotal(false)}
                style={{ background: "none", border: "none", color: "#85B7EB", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer", padding: 0 }}>
                ↺ авто ({goods.toFixed(2)} €)
              </button>
            )}
          </div>
          <input
            value={total}
            onChange={(e) => { const v = e.target.value; setTotal(v); setManualTotal(v.trim() !== ""); }}
            placeholder={goods > 0 ? `${goods.toFixed(2)}` : "0.00"}
            inputMode="decimal"
            style={{ ...field, borderColor: underGoods ? "rgba(240,149,149,0.65)" : "rgba(255,255,255,0.12)" }}
          />
          {underGoods ? (
            <p style={{ color: "#F0A855", fontSize: 11, margin: "6px 0 0", lineHeight: 1.4 }}>
              ⚠️ Под изчислената сума (цена × количество = <b>{goods.toFixed(2)} €</b>). Разлика −{(goods - totalNum).toFixed(2)} €. Ако е нарочна отстъпка — ОК; иначе натисни „↺ авто".
            </p>
          ) : (
            <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, margin: "6px 0 0" }}>
              {manualTotal ? "Ръчно въведена." : "Автоматично — цените от сайта (с промоциите) и отстъпките за комплект / 1+1. Промени само при допълнителна отстъпка."}
            </p>
          )}
        </div>

        <div>
          <span style={label}>Бележка</span>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="напр. от Viber / Instagram" style={field} />
        </div>

        <div>
          <span style={label}>Начален статус</span>
          <div style={{ display: "flex", gap: 8 }}>
            {([["new", "За обаждане"], ["confirmed", "Вече говорих — потвърдена"]] as const).map(([s, lbl]) => (
              <button key={s} onClick={() => setStatus(s)}
                style={{ flex: 1, padding: "9px 10px", borderRadius: 8, fontSize: 12, cursor: "pointer",
                  border: `1px solid ${status === s ? "#97C459" : "rgba(255,255,255,0.12)"}`,
                  background: status === s ? "rgba(151,196,89,0.12)" : "rgba(255,255,255,0.04)",
                  color: status === s ? "#97C459" : "rgba(255,255,255,0.6)" }}>
                {lbl}
              </button>
            ))}
          </div>
        </div>

        {msg && <p style={{ color: "#F09595", fontSize: 12, margin: 0 }}>{msg}</p>}

        <button disabled={pending} onClick={submit}
          style={{ background: "#0F6E56", color: "#fff", border: "none", borderRadius: 8, padding: "11px", fontSize: 13, fontWeight: 500, cursor: "pointer", opacity: pending ? 0.6 : 1 }}>
          {pending ? "Създавам…" : "Създай поръчката"}
        </button>
      </div>
    </div>
  );
}

const qtyBtn: React.CSSProperties = {
  width: 26, height: 26, borderRadius: 6, border: "0.5px solid rgba(255,255,255,0.15)",
  background: "rgba(255,255,255,0.05)", color: "#fff", fontSize: 15, cursor: "pointer", lineHeight: 1,
};
