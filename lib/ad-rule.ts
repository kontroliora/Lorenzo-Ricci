// The ad rule (owner's playbook, 08.11.2026), shared by the health alert and the ROAS tab. Judged on the last 3 days, never on one day:
// an ad at least 3 days old is red when, over the last 3 Sofia days (today included), it spent €50+ with 0 orders, OR its cost per
// order is above €35. No server imports: the panel's client components read these numbers too.
export const RULE_DAYS = 3;
export const MIN_AD_AGE_DAYS = 3;
export const ZERO_ORDER_SPEND_3D = 50;   // € in 3 days with 0 orders
export const MAX_COST_PER_ORDER = 35;    // € per order over 3 days (also the red colour of cost-per-order cells)
