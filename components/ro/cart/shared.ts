// Small pieces shared by the Romanian cart drawer and the checkout form (display only: all money comes from
// lib/ro/pricing.ts roAmounts()).
import { PREPAYMENT_THRESHOLD_EUR } from "@/lib/price";
import { fmtRON, ronPrice } from "@/lib/ro/config";

/** "Reducere set: Milano Twist" from the set's Romanian label ("Set Milano Twist"). The amount is shown next to it. */
export const bundleLineLabel = (label: string): string => `Reducere set: ${label.replace(/^Set\s+/i, "")}`;

/** "1.500 EUR (7.875 lei)": the advance-payment threshold, as the owner's EUR figure and its lei equivalent. */
export const PREPAYMENT_THRESHOLD_TEXT = `${PREPAYMENT_THRESHOLD_EUR.toLocaleString("ro-RO")} EUR (${fmtRON(ronPrice(PREPAYMENT_THRESHOLD_EUR))})`;
