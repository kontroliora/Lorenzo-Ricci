export type ProductCategory = "watches" | "jewellery" | "wallets" | "cardholders";
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
  originalPrice?: number;
  currency: string;
  description: string;
  shortDescription: string;
  specs: ProductSpec[];
  features: string[];
  images: ProductImage[];
  coverImage: ProductImage;
  badge?: string;
  inStock: boolean;
  stock?: number;
  warranty: string;
  descriptionImages?: ProductImage[];
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface CheckoutData {
  name: string;
  phone: string;
  city: string;
  courier: "econt" | "speedy";
  officeAddress: string;
  notes?: string;
}

export interface Review {
  id: string;
  productSlug: string;
  author: string;
  rating: number;
  title?: string;
  body: string;
  imageUrl?: string;
  date: string;
}

export interface SalesNotification {
  city: string;
  product: string;
  minutesAgo: number;
}
