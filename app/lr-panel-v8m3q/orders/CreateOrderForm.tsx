"use client";
import { useState, useTransition } from "react";
import { products } from "@/lib/products";
import { createManualOrder, type ManualItemInput } from "./actions";

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
  const [items, setItems]     = useState<ManualItemInput[]>([]);
  const [total, setTotal]     = useState("");
  const [notes, setNotes]     = useState("");
  const [status, setStatus]   = useState<"new" | "confirmed">("new");

  const goods = items.reduce((s, i) => s + i.price * i.quantity, 0);

  const addProduct = (slug: string) => {
    const p = products.find((x) => x.slug === slug);
    if (!p) return;
    setItems((cur) => {
      if (cur.some((i) => i.slug === slug)) return cur.map((i) => i.slug === slug ? { ...i, quantity: i.quantity + 1 } : i);
      return [...cur, { slug: p.slug, name: p.name, sku: p.sku, price: p.price, currency: p.currency, quantity: 1 }];
    });
  };
  const setQty = (slug: string, q: number) =>
    setItems((cur) => q < 1 ? cur.filter((i) => i.slug !== slug) : cur.map((i) => i.slug === slug ? { ...i, quantity: q } : i));

  const submit = () => start(async () => {
    setMsg("");
    const r = await createManualOrder({
      name, phone, city, courier, address, items,
      total: total.trim() ? parseFloat(total) : goods,
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
            {products.map((p) => <option key={p.slug} value={p.slug} style={{ color: "#000" }}>{p.name} — {p.price} {p.currency}</option>)}
          </select>
          {items.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
              {items.map((i) => (
                <div key={i.slug} style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "6px 10px" }}>
                  <span style={{ flex: 1, color: "#fff", fontSize: 13 }}>{i.name}</span>
                  <button onClick={() => setQty(i.slug, i.quantity - 1)} style={qtyBtn}>−</button>
                  <span style={{ color: "#fff", fontSize: 13, minWidth: 18, textAlign: "center" }}>{i.quantity}</span>
                  <button onClick={() => setQty(i.slug, i.quantity + 1)} style={qtyBtn}>+</button>
                  <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 12, minWidth: 52, textAlign: "right" }}>{(i.price * i.quantity).toFixed(2)} {i.currency}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <span style={label}>Сума за наложен платеж</span>
            <input value={total} onChange={(e) => setTotal(e.target.value)} placeholder={goods > 0 ? `авто: ${goods.toFixed(2)} €` : "0.00"} inputMode="decimal" style={field} />
          </div>
          <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, paddingBottom: 10 }}>Наложен платеж</span>
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
