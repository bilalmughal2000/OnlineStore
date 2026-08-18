// Shapes returned by the API (kept intentionally lightweight for the storefront).
export interface ProductImage {
  id: string;
  url: string;
  alt?: string | null;
  isPrimary: boolean;
}

export interface Variant {
  id: string;
  size?: string | null;
  color?: string | null;
  colorHex?: string | null;
  stock: number;
  priceOverride?: number | null;
}

export interface Product {
  id: string;
  title: string;
  slug: string;
  description: string;
  basePrice: number;
  salePrice?: number | null;
  brand?: string | null;
  sku?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  fabric?: string | null;
  fabricCare?: string | null;
  shippingReturns?: string | null;
  ratingAvg: number;
  ratingCount: number;
  isFeatured: boolean;
  sizeChartImage?: string | null;
  sizeChartTable?: { headers: string[]; rows: string[][] } | null;
  images: ProductImage[];
  variants: Variant[];
  category?: { id: string; name: string; slug: string } | null;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  image?: string | null;
  parentId?: string | null;
  /** Products in this category and every category nested below it. */
  productCount?: number;
  children?: Category[];
}

/** A header nav entry — a top-level category with its subcategories, any depth. */
export interface MenuNode {
  id: string;
  label: string;
  url: string;
  slug?: string;
  image?: string | null;
  productCount?: number;
  children?: MenuNode[];
}

/** A dated store-wide announcement (event sale, holiday, notice). */
export interface Announcement {
  id: string;
  title: string;
  message?: string | null;
  badge?: string | null;
  imageUrl?: string | null;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  couponCode?: string | null;
  placement: 'modal' | 'ribbon' | 'both';
  showCountdown: boolean;
  startDate?: string | null;
  endDate?: string | null;
  /** Part of the dismissal key, so an edited announcement can show once more. */
  updatedAt: string;
}

export interface Banner {
  id: string;
  title?: string | null;
  subtitle?: string | null;
  ctaLabel?: string | null;
  imageUrl: string;
  link?: string | null;
}

export interface HomepageSection {
  id: string;
  title: string;
  type: 'PRODUCT_GRID' | 'BANNER' | 'CAROUSEL' | 'CATEGORY_TILES';
  products?: Product[];
  categories?: Category[];
}

/** Courier fields on an order, present once the parcel has been booked. */
export interface OrderTracking {
  courier?: string | null;
  trackingNumber?: string | null;
  courierStatus?: string | null;
}

export interface CartLine {
  variantId: string;
  productId: string;
  productTitle: string;
  slug: string;
  variantLabel: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  stock: number;
  image: string | null;
}

export interface Cart {
  cartId: string;
  lines: CartLine[];
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
  couponCode: string | null;
  freeShippingThreshold: number;
  amountToFreeShipping: number;
}

export interface Review {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  verified?: boolean;
  user?: { name: string } | null;
  /** Display name when the review was left without an account. */
  guestName?: string | null;
}

export interface Testimonial {
  id: string;
  rating: number;
  comment: string | null;
  user?: { name: string } | null;
  product?: { title: string; slug: string; images: { url: string }[] } | null;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: 'CUSTOMER' | 'STAFF' | 'ADMIN';
}
