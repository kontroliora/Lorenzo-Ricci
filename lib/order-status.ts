// Pure order-status constants/helpers — NO server-only deps, so this is safe to
// import from client components too (unlike lib/orders.ts, which pulls in
// next/headers via lib/supabase/server and can only be imported server-side).

// Statuses that hold stock. A reservation is held INDEFINITELY until the order is
// processed manually. Neither `returning` nor `restocked` reserve — a return frees
// KV stock the same as the legacy `returned` did (KV model unchanged, by decision).
export const RESERVING_STATUSES = ["new", "confirmed", "shipped", "completed"] as const;

// Every status that represents a return (the two sub-statuses + the legacy value
// during the migration window). Use isReturn() instead of === "returned".
export const RETURN_STATUSES = ["returning", "restocked", "returned"] as const;
export const isReturn = (status: string): boolean => (RETURN_STATUSES as readonly string[]).includes(status);
