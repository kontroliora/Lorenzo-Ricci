"use client";
import { useState, useTransition } from "react";
import { markCartCall } from "./cart-actions";
import { cartSection, fmtAgo, CART_MAX_NO_ANSWER, CART_MIN_EUR, type AbandonedCart, type CartCallState } from "@/lib/abandoned-carts";
import type { StuckSummary } from "@/lib/checkout-events";

const FIELD_BG: Record<string, string> = { name: "имена", phone: "телефон", email: "имейл", city: "град", postCode: "пощенски код", officeAddress: "офис / адрес", county: "județ", address: "адрес" };
const flag = (m: string) => (m === "ro" ? "🇷🇴" : "BG");

/** Where customers stopped in the checkout (last 24 h): which fields refused the submit, which server refusals, which network failures. */
function StuckStrip({ stuck }: { stuck: StuckSummary }) {
  if (stuck.total === 0) return <div data-testid="stuck-strip" style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>Засядания в чекаута за 24 ч: няма записани.</div>;
  return (
    <div data-testid="stuck-strip" style={{ border: "0.5px solid rgba(240,149,149,0.4)", background: "rgba(240,149,149,0.06)", borderRadius: 12, padding: "12px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ color: "#F09595", fontSize: 12, fontWeight: 500 }}>Засядания в чекаута · последните 24 ч · {stuck.total}</div>
      {stuck.byField.length > 0 && <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 12, lineHeight: 1.6 }}>Не са минали заради поле: {stuck.byField.map((f) => `${flag(f.market)} ${FIELD_BG[f.field] ?? f.field} ×${f.n}`).join(" · ")}</div>}
      {stuck.byServer.length > 0 && <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 12, lineHeight: 1.6 }}>Сървърът е отказал: {stuck.byServer.map((s) => `${flag(s.market)} ${s.code} ×${s.n}`).join(" · ")}</div>}
      {stuck.network > 0 && <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 12 }}>Проблем с връзката: ×{stuck.network}</div>}
    </div>
  );
}

// "Изоставени колички" (Bulgaria): carts whose owner typed a phone in the checkout and did not order. The staff phones them and logs
// the result; "не иска" and the 2nd "не вдига" make a cart disappear for good, an order by the same phone / e-mail makes it vanish by
// itself (decided on the server, lib/abandoned-carts.ts). Two lists: left 1-24 h ago, and "Пропуснати" (older).

const dateFmt = (iso: string) =>
  new Date(iso).toLocaleString("bg-BG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Sofia" });

const outline = (border: string, fg: string): React.CSSProperties => ({
  background: "transparent", border: `0.5px solid ${border}`, color: fg, borderRadius: 20, padding: "8px 14px", fontSize: 12, cursor: "pointer",
});

function CartCard({ cart, now, onNotice, onLocal }: {
  cart: AbandonedCart; now: number; onNotice?: (m: string) => void;
  onLocal: (id: string, patch: { callState: CartCallState; callAttempts: number }) => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const digits = cart.phone.replace(/[^\d+]/g, "");

  const log = (outcome: CartCallState) => start(async () => {
    setError("");
    try {
      const err = await markCartCall(cart.id, outcome);
      if (err) { setError(err); onNotice?.(`${cart.name || cart.phone}: ${err}`); return; }
      onLocal(cart.id, { callState: outcome, callAttempts: outcome === "no_answer" ? cart.callAttempts + 1 : cart.callAttempts });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Възникна грешка. Опитай пак.");
    }
  });

  const stateBadge = cart.callState === "will_order"
    ? { text: `Ще поръча${cart.lastCallAt ? ` · звъннато ${dateFmt(cart.lastCallAt)}` : ""}`, bg: "rgba(151,196,89,0.14)", fg: "#97C459" }
    : cart.callState === "no_answer"
      ? { text: `Не вдига · ${cart.callAttempts} от ${CART_MAX_NO_ANSWER}`, bg: "rgba(250,199,117,0.14)", fg: "#FAC775" }
      : null;

  return (
    <div data-testid="abandoned-cart" style={{ background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ color: "#fff", fontSize: 15, fontWeight: 500 }}>{cart.name || "Без име"}</div>
          <a href={`tel:${digits}`} style={{ color: "#85B7EB", fontSize: 16, fontWeight: 500, textDecoration: "none" }}>{cart.phone}</a>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: "#fff", fontSize: 18, fontWeight: 500 }}>€{cart.subtotal.toFixed(2)}</div>
          <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>
            напуснала {fmtAgo(now, cart.updatedAt)} · {dateFmt(cart.updatedAt)}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {cart.items.map((it, i) => (
          <div key={`${it.slug}-${i}`} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {it.image
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={it.image} alt={it.name} width={48} height={48} style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 8, background: "#fff", flexShrink: 0 }} />
              : <span style={{ width: 48, height: 48, borderRadius: 8, background: "rgba(255,255,255,0.08)", flexShrink: 0 }} aria-hidden />}
            <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, lineHeight: 1.4 }}>
              {it.name}{it.quantity > 1 ? ` × ${it.quantity}` : ""}
              <span style={{ color: "rgba(255,255,255,0.45)" }}> · €{it.price.toFixed(2)}</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 20, background: cart.emailedAt ? "rgba(133,183,235,0.14)" : "rgba(255,255,255,0.06)", color: cart.emailedAt ? "#85B7EB" : "rgba(255,255,255,0.55)" }}>
          {cart.emailedAt ? `Имейл за напомняне: изпратен ${dateFmt(cart.emailedAt)}` : cart.email ? "Имейл за напомняне: още не е изпратен" : "Няма имейл · не е получавал напомняне"}
        </span>
        {stateBadge && <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 20, background: stateBadge.bg, color: stateBadge.fg }}>{stateBadge.text}</span>}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button disabled={pending} onClick={() => log("will_order")} style={outline("#3B6D11", "#97C459")}>Звъннах — ще поръча</button>
        <button disabled={pending} onClick={() => log("declined")} style={outline("#A32D2D", "#F09595")}>Звъннах — не иска</button>
        <button disabled={pending} onClick={() => log("no_answer")} style={outline("#854F0B", "#FAC775")}>Не вдига</button>
      </div>
      {error && <div role="alert" style={{ color: "#F09595", fontSize: 12 }}>{error}</div>}
    </div>
  );
}

export function AbandonedCartsView({ carts, now, onNotice, stuck }: { carts: AbandonedCart[]; now: number; onNotice?: (m: string) => void; stuck?: StuckSummary | null }) {
  // What the screen already knows after a click (the server data catches up on the next refresh): the new state, or gone.
  const [local, setLocal] = useState<Record<string, { callState: CartCallState; callAttempts: number }>>({});
  const merged = carts
    .map((c) => (local[c.id] ? { ...c, ...local[c.id] } : c))
    .filter((c) => !(c.callState === "declined" || (c.callState === "no_answer" && c.callAttempts >= CART_MAX_NO_ANSWER)));
  const recent = merged.filter((c) => cartSection(c.updatedAt, now) === "recent");
  const missed = merged.filter((c) => cartSection(c.updatedAt, now) === "missed");
  const onLocal = (id: string, patch: { callState: CartCallState; callAttempts: number }) => setLocal((s) => ({ ...s, [id]: patch }));
  const list = (arr: AbandonedCart[]) => arr.map((c) => <CartCard key={c.id} cart={c} now={now} onNotice={onNotice} onLocal={onLocal} />);

  return (
    <>
      <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, lineHeight: 1.6 }}>
        Клиенти, които са въвели телефон в чекаута и не са поръчали · количка над €{CART_MIN_EUR} · само България.
        „Не иска“ и втората „Не вдига“ ги махат оттук. Ако клиентът поръча (същия телефон или имейл), количката изчезва сама.
      </div>

      {stuck && <StuckStrip stuck={stuck} />}

      <div data-testid="carts-recent" className="flex flex-col gap-4">
        <div style={{ color: "#FAC775", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase" }}>Изоставени преди 1–24 часа · {recent.length}</div>
        {recent.length === 0
          ? <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, padding: "18px 0" }}>Няма колички за обаждане в момента.</div>
          : list(recent)}
      </div>

      {missed.length > 0 && (
        <div data-testid="carts-missed" className="flex flex-col gap-4 mt-2 pt-4 border-t border-white/6">
          <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase" }}>Пропуснати · над 24 часа · {missed.length}</div>
          {list(missed)}
        </div>
      )}
    </>
  );
}
