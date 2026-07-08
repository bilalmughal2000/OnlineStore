"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.productQuerySchema = exports.reviewInputSchema = exports.sectionInputSchema = exports.sectionTypes = exports.couponInputSchema = exports.categoryInputSchema = exports.productInputSchema = exports.variantInputSchema = exports.productStatuses = exports.updateOrderStatusSchema = exports.orderStatuses = exports.checkoutSchema = exports.paymentMethods = exports.updateCartItemSchema = exports.addToCartSchema = exports.addressSchema = exports.PROVINCES = exports.resetPasswordSchema = exports.forgotPasswordSchema = exports.loginSchema = exports.registerSchema = void 0;
const zod_1 = require("zod");
// ─────────────────────────── Auth ───────────────────────────
exports.registerSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).max(80),
    email: zod_1.z.string().email(),
    phone: zod_1.z
        .string()
        .regex(/^(\+92|0)?3\d{9}$/, 'Enter a valid Pakistani mobile number')
        .optional(),
    password: zod_1.z.string().min(8).max(72),
});
exports.loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(1),
});
exports.forgotPasswordSchema = zod_1.z.object({ email: zod_1.z.string().email() });
exports.resetPasswordSchema = zod_1.z.object({
    token: zod_1.z.string().min(10),
    password: zod_1.z.string().min(8).max(72),
});
// ─────────────────────────── Address ────────────────────────
exports.PROVINCES = [
    'Punjab',
    'Sindh',
    'Khyber Pakhtunkhwa',
    'Balochistan',
    'Islamabad Capital Territory',
    'Gilgit-Baltistan',
    'Azad Kashmir',
];
exports.addressSchema = zod_1.z.object({
    label: zod_1.z.string().min(1).default('Home'),
    fullName: zod_1.z.string().min(2),
    phone: zod_1.z.string().regex(/^(\+92|0)?3\d{9}$/, 'Enter a valid Pakistani mobile number'),
    addressLine: zod_1.z.string().min(5),
    city: zod_1.z.string().min(2),
    province: zod_1.z.enum(exports.PROVINCES),
    postalCode: zod_1.z.string().optional(),
    isDefault: zod_1.z.boolean().optional(),
});
// ─────────────────────────── Cart ───────────────────────────
exports.addToCartSchema = zod_1.z.object({
    variantId: zod_1.z.string().min(1),
    quantity: zod_1.z.number().int().min(1).max(20).default(1),
});
exports.updateCartItemSchema = zod_1.z.object({
    quantity: zod_1.z.number().int().min(0).max(20),
});
// ─────────────────────────── Checkout / Order ───────────────
exports.paymentMethods = ['COD', 'STRIPE', 'JAZZCASH', 'EASYPAISA'];
exports.checkoutSchema = zod_1.z.object({
    addressId: zod_1.z.string().optional(),
    newAddress: exports.addressSchema.optional(),
    paymentMethod: zod_1.z.enum(exports.paymentMethods),
    couponCode: zod_1.z.string().optional(),
    deliveryMethod: zod_1.z.enum(['standard', 'express']).default('standard'),
    notes: zod_1.z.string().max(500).optional(),
});
exports.orderStatuses = [
    'PLACED',
    'CONFIRMED',
    'PACKED',
    'SHIPPED',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'CANCELLED',
    'RETURNED',
];
exports.updateOrderStatusSchema = zod_1.z.object({
    status: zod_1.z.enum(exports.orderStatuses),
    note: zod_1.z.string().optional(),
});
// ─────────────────────────── Product (admin) ────────────────
exports.productStatuses = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];
exports.variantInputSchema = zod_1.z.object({
    id: zod_1.z.string().optional(),
    size: zod_1.z.string().optional(),
    color: zod_1.z.string().optional(),
    colorHex: zod_1.z.string().optional(),
    sku: zod_1.z.string().optional(),
    priceOverride: zod_1.z.number().optional(),
    stock: zod_1.z.number().int().min(0).default(0),
});
exports.productInputSchema = zod_1.z.object({
    title: zod_1.z.string().min(2),
    slug: zod_1.z.string().optional(),
    description: zod_1.z.string().min(1),
    basePrice: zod_1.z.number().positive(),
    salePrice: zod_1.z.number().positive().optional().nullable(),
    costPrice: zod_1.z.number().positive().optional().nullable(),
    sku: zod_1.z.string().optional(),
    status: zod_1.z.enum(exports.productStatuses).default('DRAFT'),
    isFeatured: zod_1.z.boolean().default(false),
    brand: zod_1.z.string().optional(),
    fabric: zod_1.z.string().optional(),
    categoryId: zod_1.z.string().optional().nullable(),
    seoTitle: zod_1.z.string().optional(),
    seoDescription: zod_1.z.string().optional(),
    images: zod_1.z.array(zod_1.z.object({ url: zod_1.z.string().url(), alt: zod_1.z.string().optional(), isPrimary: zod_1.z.boolean().optional() })).default([]),
    variants: zod_1.z.array(exports.variantInputSchema).default([]),
});
// ─────────────────────────── Category (admin) ───────────────
exports.categoryInputSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    slug: zod_1.z.string().optional(),
    description: zod_1.z.string().optional(),
    image: zod_1.z.string().optional(),
    parentId: zod_1.z.string().optional().nullable(),
    isActive: zod_1.z.boolean().default(true),
    sortOrder: zod_1.z.number().int().default(0),
});
// ─────────────────────────── Coupon (admin) ─────────────────
exports.couponInputSchema = zod_1.z.object({
    code: zod_1.z.string().min(2).transform((s) => s.toUpperCase()),
    type: zod_1.z.enum(['PERCENTAGE', 'FIXED']),
    value: zod_1.z.number().positive(),
    minOrderValue: zod_1.z.number().min(0).default(0),
    usageLimit: zod_1.z.number().int().positive().optional().nullable(),
    perUserLimit: zod_1.z.number().int().positive().optional().nullable(),
    isActive: zod_1.z.boolean().default(true),
    startsAt: zod_1.z.string().datetime().optional().nullable(),
    expiresAt: zod_1.z.string().datetime().optional().nullable(),
});
// ─────────────────────────── Homepage section (admin) ───────
exports.sectionTypes = ['PRODUCT_GRID', 'BANNER', 'CAROUSEL', 'CATEGORY_TILES'];
exports.sectionInputSchema = zod_1.z.object({
    title: zod_1.z.string().min(1),
    type: zod_1.z.enum(exports.sectionTypes),
    config: zod_1.z.record(zod_1.z.any()).default({}),
    sortOrder: zod_1.z.number().int().default(0),
    isActive: zod_1.z.boolean().default(true),
    startDate: zod_1.z.string().datetime().optional().nullable(),
    endDate: zod_1.z.string().datetime().optional().nullable(),
});
// ─────────────────────────── Review ─────────────────────────
exports.reviewInputSchema = zod_1.z.object({
    rating: zod_1.z.number().int().min(1).max(5),
    comment: zod_1.z.string().max(1000).optional(),
    images: zod_1.z.array(zod_1.z.string().url()).max(5).default([]),
});
// ─────────────────────────── Product query ──────────────────
exports.productQuerySchema = zod_1.z.object({
    category: zod_1.z.string().optional(),
    search: zod_1.z.string().optional(),
    minPrice: zod_1.z.coerce.number().optional(),
    maxPrice: zod_1.z.coerce.number().optional(),
    size: zod_1.z.string().optional(),
    color: zod_1.z.string().optional(),
    brand: zod_1.z.string().optional(),
    onSale: zod_1.z.coerce.boolean().optional(),
    inStock: zod_1.z.coerce.boolean().optional(),
    sort: zod_1.z.enum(['newest', 'price_asc', 'price_desc', 'popularity', 'rating']).default('newest'),
    page: zod_1.z.coerce.number().int().min(1).default(1),
    pageSize: zod_1.z.coerce.number().int().min(1).max(60).default(12),
});
//# sourceMappingURL=index.js.map