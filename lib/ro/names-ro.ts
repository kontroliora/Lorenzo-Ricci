// Romanian names of the products whose catalogue name is Bulgarian ("Гривна ...", "Колие ..."): bracelet = brățară,
// necklace = colier. Every other product name is a Latin brand/model name and is shown as it is.
export const RO_NAMES: Record<string, string> = {
  "bracelet-diamante-cross": "Brățară Diamante Cross",
  "bracelet-milano-forte": "Brățară Milano Forte",
  "bracelet-milano-twist": "Brățară Milano Twist",
  "bracelet-signature": "Brățară Signature",
  "necklace-aurelius": "Colier Aurelius Cross",
  "necklace-grande-imperiale": "Colier Grande Imperiale",
  "necklace-milano-forte": "Colier Milano Forte",
  "necklace-milano-twist": "Colier Milano Twist",
};

/** The name the Romanian store shows (and stores on orders / e-mails) for a product. */
export const roName = (p: { slug: string; name: string }): string => RO_NAMES[p.slug] ?? p.name;
