// Test-mode card payments must never block the panel: a Stripe TEST payment cannot be refunded with a live key (or with no key at all),
// and there is no real money to give back. Stripe puts the mode in the id of a Checkout Session (cs_test_... / cs_live_...), which every
// card order stores in orders.stripe_session_id, so the order itself tells what kind of payment it is.
// Pure (no imports): used by the panel's cancel action and covered by the tests.

export type StripeMode = "live" | "test" | "unknown";

export const modeOfSession = (id?: string | null): StripeMode =>
  /^cs_live_/.test(String(id ?? "")) ? "live" : /^cs_test_/.test(String(id ?? "")) ? "test" : "unknown";

export const modeOfKey = (key?: string | null): StripeMode =>
  /^(sk|rk)_live_/.test(String(key ?? "").trim()) ? "live" : /^(sk|rk)_test_/.test(String(key ?? "").trim()) ? "test" : "unknown";

export type RefundPlan =
  | { action: "refund" }                                    // ask Stripe for the refund (a refund in the SAME mode, test included, works)
  | { action: "skip"; why: "no-key" | "test-payment" }      // a test payment: nothing to refund, cancel / mark it without Stripe and without an e-mail
  | { action: "refuse"; message: string };                  // a LIVE payment that cannot be refunded from here: never cancel it silently

export function refundPlan(sessionId: string | null | undefined, secretKey: string | null | undefined): RefundPlan {
  const hasKey = String(secretKey ?? "").trim().length > 0;
  const order = modeOfSession(sessionId);
  const key = modeOfKey(secretKey);
  if (order === "live") {
    if (!hasKey) return { action: "refuse", message: "Платена с карта в Stripe (live), но сайтът няма Stripe ключ: върни сумата ръчно от Stripe и после откажи поръчката." };
    if (key === "test") return { action: "refuse", message: "Платена с карта в Stripe (live), но сайтът работи с тестов Stripe ключ: върни сумата ръчно от Stripe и после откажи поръчката." };
    return { action: "refund" };
  }
  // a test payment (cs_test_...) or one of unknown origin
  if (!hasKey) return { action: "skip", why: "no-key" };
  if (order === "test" && key === "live") return { action: "skip", why: "test-payment" };
  return { action: "refund" };
}

/** Stripe answered "no such payment_intent": the payment belongs to the other mode / account, so it is a test payment for this key. */
export function isMissingStripeObject(e: unknown): boolean {
  const x = (e ?? {}) as { code?: unknown; raw?: { code?: unknown }; message?: unknown };
  return x.code === "resource_missing" || x.raw?.code === "resource_missing" || /No such (payment_intent|charge|payment)/i.test(String(x.message ?? ""));
}
