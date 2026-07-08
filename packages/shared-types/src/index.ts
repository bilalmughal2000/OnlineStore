import { z } from 'zod';

// ─────────────────────────── Auth ───────────────────────────
export const registerSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  phone: z
    .string()
    .regex(/^(\+92|0)?3\d{9}$/, 'Enter a valid Pakistani mobile number')
    .optional(),
  password: z.string().min(8).max(72),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const forgotPasswordSchema = z.object({ email: z.string().email() });

export const resetPasswordSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8).max(72),
});

// ─────────────────────────── Address ────────────────────────
export const PROVINCES = [
  'Punjab',
  'Sindh',
  'Khyber Pakhtunkhwa',
  'Balochistan',
  'Islamabad Capital Territory',
  'Gilgit-Baltistan',
  'Azad Kashmir',
] as const;

export const addressSchema = z.object({
  label: z.string().min(1).default('Home'),
  fullName: z.string().min(2),
  phone: z.string().regex(/^(\+92|0)?3\d{9}$/, 'Enter a valid Pakistani mobile number'),
  addressLine: z.string().min(5),
  city: z.string().min(2),
  province: z.enum(PROVINCES),
  postalCode: z.string().optional(),
  isDefault: z.boolean().optional(),
});

// ─────────────────────────── Cart ───────────────────────────
export const addToCartSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.number().int().min(1).max(20).default(1),
});

export const updateCartItemSchema = z.object({
  quantity: z.number().int().min(0).max(20),
});

// ─────────────────────────── Checkout / Order ───────────────
export const paymentMethods = ['COD', 'STRIPE', 'JAZZCASH', 'EASYPAISA'] as const;

export const checkoutSchema = z.object({
  addressId: z.string().optional(),
  newAddress: addressSchema.optional(),
  paymentMethod: z.enum(paymentMethods),
  couponCode: z.string().optional(),
  deliveryMethod: z.enum(['standard', 'express']).default('standard'),
  notes: z.string().max(500).optional(),
});

export const orderStatuses = [
  'PLACED',
  'CONFIRMED',
  'PACKED',
  'SHIPPED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
  'RETURNED',
] as const;

export const updateOrderStatusSchema = z.object({
  status: z.enum(orderStatuses),
  note: z.string().optional(),
});

// ─────────────────────────── Product (admin) ────────────────
export const productStatuses = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const;

// A size chart can be an uploaded image and/or a structured table.
export const sizeChartTableSchema = z.object({
  headers: z.array(z.string()).min(1),
  rows: z.array(z.array(z.string())),
});

export const variantInputSchema = z.object({
  id: z.string().optional(),
  size: z.string().optional(),
  color: z.string().optional(),
  colorHex: z.string().optional(),
  sku: z.string().optional(),
  priceOverride: z.number().optional(),
  stock: z.number().int().min(0).default(0),
});

export const productInputSchema = z.object({
  title: z.string().min(2),
  slug: z.string().optional(),
  description: z.string().min(1),
  basePrice: z.number().positive(),
  salePrice: z.number().positive().optional().nullable(),
  costPrice: z.number().positive().optional().nullable(),
  sku: z.string().optional(),
  status: z.enum(productStatuses).default('DRAFT'),
  isFeatured: z.boolean().default(false),
  brand: z.string().optional(),
  fabric: z.string().optional(),
  categoryId: z.string().optional().nullable(),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  sizeChartImage: z.string().url().optional().nullable(),
  sizeChartTable: sizeChartTableSchema.optional().nullable(),
  images: z.array(z.object({ url: z.string().url(), alt: z.string().optional(), isPrimary: z.boolean().optional() })).default([]),
  variants: z.array(variantInputSchema).default([]),
});

// ─────────────────────────── Category (admin) ───────────────
export const categoryInputSchema = z.object({
  name: z.string().min(1),
  slug: z.string().optional(),
  description: z.string().optional(),
  image: z.string().optional(),
  parentId: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

// ─────────────────────────── Coupon (admin) ─────────────────
export const couponInputSchema = z.object({
  code: z.string().min(2).transform((s) => s.toUpperCase()),
  type: z.enum(['PERCENTAGE', 'FIXED']),
  value: z.number().positive(),
  minOrderValue: z.number().min(0).default(0),
  usageLimit: z.number().int().positive().optional().nullable(),
  perUserLimit: z.number().int().positive().optional().nullable(),
  isActive: z.boolean().default(true),
  startsAt: z.string().datetime().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
});

// ─────────────────────────── Homepage section (admin) ───────
export const sectionTypes = ['PRODUCT_GRID', 'BANNER', 'CAROUSEL', 'CATEGORY_TILES'] as const;

export const sectionInputSchema = z.object({
  title: z.string().min(1),
  type: z.enum(sectionTypes),
  config: z.record(z.any()).default({}),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
});

// ─────────────────────────── Review ─────────────────────────
export const reviewInputSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
  images: z.array(z.string().url()).max(5).default([]),
});

// ─────────────────────────── Product query ──────────────────
export const productQuerySchema = z.object({
  category: z.string().optional(),
  search: z.string().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  size: z.string().optional(),
  color: z.string().optional(),
  brand: z.string().optional(),
  onSale: z.coerce.boolean().optional(),
  inStock: z.coerce.boolean().optional(),
  sort: z.enum(['newest', 'price_asc', 'price_desc', 'popularity', 'rating']).default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(60).default(12),
});

// ─────────────────────────── Inferred types ─────────────────
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type AddressInput = z.infer<typeof addressSchema>;
export type AddToCartInput = z.infer<typeof addToCartSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type SizeChartTable = z.infer<typeof sizeChartTableSchema>;
export type ProductInput = z.infer<typeof productInputSchema>;
export type CategoryInput = z.infer<typeof categoryInputSchema>;
export type CouponInput = z.infer<typeof couponInputSchema>;
export type SectionInput = z.infer<typeof sectionInputSchema>;
export type ReviewInput = z.infer<typeof reviewInputSchema>;
export type ProductQuery = z.infer<typeof productQuerySchema>;

// ─────────────────────────── DTOs (API responses) ───────────
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: 'CUSTOMER' | 'STAFF' | 'ADMIN';
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
