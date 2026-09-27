export type ProductCategory = "watches" | "jewellery" | "wallets" | "cardholders" | "bags";
export type JewellerySubcategory = "bracelet" | "necklace";

export interface ProductImage {
  src: string;
  alt: string;
}

export interface ProductSpec {
  label: string;
  value: string;
}

export interface Product {
  id: string;
  slug: string;
  sku: string;
  name: string;
  category: ProductCategory;
  subcategory?: JewellerySubcategory;
  price: number;
  currency: string;
  priceAED?: number; // optional Dubai price — shown to AE visitors instead of the EUR base
  priceRON?: number; // optional Romania price — shown to RO visitors instead of the EUR base

  description: string;
  tabDescription?: string[];   // multi-paragraph "ОПИСАНИЕ" tab copy; falls back to `description`
  descriptionSections?: { heading: string; body: string }[]; // quiet-heading prose sections for
  // the "ОПИСАНИЕ" tab — takes precedence over tabDescription, which takes precedence over
  // `description`. See ProductInfo.tsx.
  materialNote?: string;
  crocodileSpecies?: string; // e.g. "нилски крокодил (Crocodylus niloticus)" — set ONLY once confirmed
  // from that product's own CITES permit. Leave unset otherwise; components must
  // never fall back to a default/assumed species (LeatherDescription renders
  // neutral "крокодилска кожа" wording when this is unset).
  citesPermitNumber?: string; // TODO: fill in from each product's own CITES export/re-export
  // permit once available. Left empty on every product for now — not yet rendered anywhere.
  descriptionImage?: ProductImage; // per-product macro shot for the shared LeatherDescription
  // ("Автентичност и Структура") block — no fallback: when unset, the media column is omitted.
  shortDescription: string;
  specs: ProductSpec[];
  features: string[];
  images: ProductImage[];
  coverImage: ProductImage;
  badge?: string;
  inStock: boolean;
  stock?: number;
  warranty: string;
  commercial_warranty_text?: string; // optional voluntary/commercial warranty copy, beyond the 2-year statutory minimum — empty until provided
  descriptionImages?: ProductImage[];
  descriptionVideo?: string;
  quoteVideo?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface CheckoutData {
  name: string;
  phone: string;
  city: string;
  courier: "econt" | "home";
  officeAddress: string;
  notes?: string;
}

export interface Review {
  id: string;
  productSlug: string;
  author: string;
  rating: number;
  title?: string;
  body?: string;
  imageUrl?: string;
  date: string;
}

export interface SalesNotification {
  city: string;
  product: string;
  minutesAgo: number;
}
