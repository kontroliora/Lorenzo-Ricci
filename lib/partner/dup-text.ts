import type { PartnerDuplicate } from "./orders";

/** The text of the repeat-order warning: the partner e-mail and the /partner panel say the same. */
export function partnerDuplicateText(d: PartnerDuplicate): string {
  const more = d.count - 1;
  return `Този клиент има още ${more} ${more === 1 ? "поръчка" : "поръчки"} за последните 72 часа: ${d.others.map((r) => `#${r}`).join(", ")}.${d.sameProducts ? " ЕДНАКВИ ПРОДУКТИ." : ""} Провери с клиента колко броя иска, преди да потвърждаваш.`;
}
