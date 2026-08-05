import type { Locale } from "./config";

// Conversion-path dictionary (header, footer, announcement, product card, cart).
// Secondary pages (story, faq, policies, warranty) stay Bulgarian for now.
//
// `bg` defines the key set; `en`/`ro` are typed as Record<Key, string>, so adding a
// Bulgarian key without its translations fails the build. That's deliberate — a
// missing translation should never silently ship as Bulgarian to a foreign visitor.

const bg = {
  // ── Announcement bar ──
  "ann.shipping":        "Безплатна доставка за поръчки над €60",
  "ann.warranty":        "2 години гаранция на часовниците · Доживотна на бижутата",
  "ann.delivery":        "Доставка до 2 работни дни · Преглед и тест преди плащане",
  "ann.shipping.short":  "Безплатна доставка над €60",
  "ann.warranty.short":  "Гаранция 2 год. · Доживотна за бижута",
  "ann.delivery.short":  "Доставка до 2 работни дни",

  // ── Navigation ──
  "nav.home":     "Начало",
  "nav.watches":  "Часовници",
  "nav.jewellery":"Бижута",
  "nav.leather":  "Кожени Изделия",
  "nav.story":    "История",
  "nav.faq":      "FAQ",
  "nav.menu":     "Меню",

  // ── Footer ──
  "footer.collections":  "Колекции",
  "footer.bracelets":    "Гривни",
  "footer.necklaces":    "Колиета",
  "footer.care":         "Обслужване на клиенти",
  "footer.faqLong":      "Често задавани въпроси",
  "footer.shippingRet":  "Доставка и връщане",
  "footer.warrantyCare": "Гаранция и поддръжка",
  "footer.privacy":      "Политика за поверителност",
  "footer.contact":      "Контакт",
  "footer.hours":        "Пон-Пет, 10:00-18:00",

  // ── Trust badges ──
  "trust.warranty2y":      "2г Гаранция",
  "trust.onWatches":       "на часовниците",
  "trust.warrantyLife":    "Доживотна гаранция",
  "trust.onJewellery":     "на бижутата",
  "trust.days2":           "До 2 работни дни",
  "trust.courier":         "Еконт",
  "trust.inspect":         "Преглед преди плащане",
  "trust.cod":             "Наложен платеж",

  // ── Product card / product page ──
  "product.addToCart": "ДОБАВИ В КОЛИЧКАТА",
  "product.added":     "✓ ДОБАВЕНО",
  "product.inStock":   "Налични",
  "product.soldOut":   "Изчерпан",
  "product.review":    "ревю",
  "product.reviews":   "ревюта",
  "product.dayView":   "Дневна снимка",
  "product.nightView": "Нощна снимка",
  "product.learnMore": "Научи повече",

  // ── Cart ──
  "cart.title":        "Количка",
  "cart.close":        "Затвори",
  "cart.remove":       "Премахни",
  "cart.item":         "продукт",
  "cart.items":        "продукта",
  "cart.empty":        "Количката е празна",
  "cart.promoCode":    "Промо код",
  "cart.apply":        "Приложи",
  "cart.promoInvalid": "Невалиден промо код",
  "cart.promoError":   "Грешка при проверката. Опитайте отново.",
  "cart.subtotal":     "Междинна сума",
  "cart.total":        "Общо",
  "cart.checkout":     "Към поръчка",

  // ── Language switcher ──
  "lang.label": "Език",
} as const;

export type DictKey = keyof typeof bg;

const en: Record<DictKey, string> = {
  "ann.shipping":       "Free shipping on orders over €60",
  "ann.warranty":       "2-year warranty on watches · Lifetime on jewellery",
  "ann.delivery":       "Delivery within 2 working days · Inspect before you pay",
  "ann.shipping.short": "Free shipping over €60",
  "ann.warranty.short": "2-year warranty · Lifetime on jewellery",
  "ann.delivery.short": "Delivery within 2 working days",

  "nav.home":      "Home",
  "nav.watches":   "Watches",
  "nav.jewellery": "Jewellery",
  "nav.leather":   "Leather Goods",
  "nav.story":     "Our Story",
  "nav.faq":       "FAQ",
  "nav.menu":      "Menu",

  "footer.collections":  "Collections",
  "footer.bracelets":    "Bracelets",
  "footer.necklaces":    "Necklaces",
  "footer.care":         "Customer Care",
  "footer.faqLong":      "Frequently Asked Questions",
  "footer.shippingRet":  "Shipping & Returns",
  "footer.warrantyCare": "Warranty & Care",
  "footer.privacy":      "Privacy Policy",
  "footer.contact":      "Contact",
  "footer.hours":        "Mon–Fri, 10:00–18:00",

  "trust.warranty2y":   "2-Year Warranty",
  "trust.onWatches":    "on watches",
  "trust.warrantyLife": "Lifetime Warranty",
  "trust.onJewellery":  "on jewellery",
  "trust.days2":        "Within 2 working days",
  "trust.courier":      "Econt",
  "trust.inspect":      "Inspect before paying",
  "trust.cod":          "Cash on delivery",

  "product.addToCart": "ADD TO CART",
  "product.added":     "✓ ADDED",
  "product.inStock":   "In stock",
  "product.soldOut":   "Sold out",
  "product.review":    "review",
  "product.reviews":   "reviews",
  "product.dayView":   "Day view",
  "product.nightView": "Night view",
  "product.learnMore": "Learn more",

  "cart.title":        "Cart",
  "cart.close":        "Close",
  "cart.remove":       "Remove",
  "cart.item":         "item",
  "cart.items":        "items",
  "cart.empty":        "Your cart is empty",
  "cart.promoCode":    "Promo code",
  "cart.apply":        "Apply",
  "cart.promoInvalid": "Invalid promo code",
  "cart.promoError":   "Could not verify the code. Please try again.",
  "cart.subtotal":     "Subtotal",
  "cart.total":        "Total",
  "cart.checkout":     "Checkout",

  "lang.label": "Language",
};

const ro: Record<DictKey, string> = {
  "ann.shipping":       "Livrare gratuită la comenzi peste €60",
  "ann.warranty":       "Garanție 2 ani la ceasuri · Pe viață la bijuterii",
  "ann.delivery":       "Livrare în maximum 2 zile lucrătoare · Verificare înainte de plată",
  "ann.shipping.short": "Livrare gratuită peste €60",
  "ann.warranty.short": "Garanție 2 ani · Pe viață la bijuterii",
  "ann.delivery.short": "Livrare în max. 2 zile lucrătoare",

  "nav.home":      "Acasă",
  "nav.watches":   "Ceasuri",
  "nav.jewellery": "Bijuterii",
  "nav.leather":   "Articole din piele",
  "nav.story":     "Povestea noastră",
  "nav.faq":       "Întrebări frecvente",
  "nav.menu":      "Meniu",

  "footer.collections":  "Colecții",
  "footer.bracelets":    "Brățări",
  "footer.necklaces":    "Coliere",
  "footer.care":         "Relații cu clienții",
  "footer.faqLong":      "Întrebări frecvente",
  "footer.shippingRet":  "Livrare și retur",
  "footer.warrantyCare": "Garanție și întreținere",
  "footer.privacy":      "Politica de confidențialitate",
  "footer.contact":      "Contact",
  "footer.hours":        "Luni–Vineri, 10:00–18:00",

  "trust.warranty2y":   "Garanție 2 ani",
  "trust.onWatches":    "la ceasuri",
  "trust.warrantyLife": "Garanție pe viață",
  "trust.onJewellery":  "la bijuterii",
  "trust.days2":        "Max. 2 zile lucrătoare",
  "trust.courier":      "Econt",
  "trust.inspect":      "Verificare înainte de plată",
  "trust.cod":          "Plata ramburs",

  "product.addToCart": "ADAUGĂ ÎN COȘ",
  "product.added":     "✓ ADĂUGAT",
  "product.inStock":   "În stoc",
  "product.soldOut":   "Stoc epuizat",
  "product.review":    "recenzie",
  "product.reviews":   "recenzii",
  "product.dayView":   "Imagine de zi",
  "product.nightView": "Imagine de noapte",
  "product.learnMore": "Află mai multe",

  "cart.title":        "Coș",
  "cart.close":        "Închide",
  "cart.remove":       "Elimină",
  "cart.item":         "produs",
  "cart.items":        "produse",
  "cart.empty":        "Coșul este gol",
  "cart.promoCode":    "Cod promoțional",
  "cart.apply":        "Aplică",
  "cart.promoInvalid": "Cod promoțional invalid",
  "cart.promoError":   "Codul nu a putut fi verificat. Încercați din nou.",
  "cart.subtotal":     "Subtotal",
  "cart.total":        "Total",
  "cart.checkout":     "Finalizează comanda",

  "lang.label": "Limbă",
};

export const DICT: Record<Locale, Record<DictKey, string>> = { bg, en, ro };

// Non-hook translator, for server components and callbacks.
export function translate(locale: Locale, key: DictKey): string {
  return DICT[locale][key] ?? DICT.bg[key] ?? key;
}
