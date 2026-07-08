import { z } from 'zod';
export declare const registerSchema: z.ZodObject<{
    name: z.ZodString;
    email: z.ZodString;
    phone: z.ZodOptional<z.ZodString>;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    email: string;
    password: string;
    phone?: string | undefined;
}, {
    name: string;
    email: string;
    password: string;
    phone?: string | undefined;
}>;
export declare const loginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
}, {
    email: string;
    password: string;
}>;
export declare const forgotPasswordSchema: z.ZodObject<{
    email: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
}, {
    email: string;
}>;
export declare const resetPasswordSchema: z.ZodObject<{
    token: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    password: string;
    token: string;
}, {
    password: string;
    token: string;
}>;
export declare const PROVINCES: readonly ["Punjab", "Sindh", "Khyber Pakhtunkhwa", "Balochistan", "Islamabad Capital Territory", "Gilgit-Baltistan", "Azad Kashmir"];
export declare const addressSchema: z.ZodObject<{
    label: z.ZodDefault<z.ZodString>;
    fullName: z.ZodString;
    phone: z.ZodString;
    addressLine: z.ZodString;
    city: z.ZodString;
    province: z.ZodEnum<["Punjab", "Sindh", "Khyber Pakhtunkhwa", "Balochistan", "Islamabad Capital Territory", "Gilgit-Baltistan", "Azad Kashmir"]>;
    postalCode: z.ZodOptional<z.ZodString>;
    isDefault: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    phone: string;
    label: string;
    fullName: string;
    addressLine: string;
    city: string;
    province: "Punjab" | "Sindh" | "Khyber Pakhtunkhwa" | "Balochistan" | "Islamabad Capital Territory" | "Gilgit-Baltistan" | "Azad Kashmir";
    postalCode?: string | undefined;
    isDefault?: boolean | undefined;
}, {
    phone: string;
    fullName: string;
    addressLine: string;
    city: string;
    province: "Punjab" | "Sindh" | "Khyber Pakhtunkhwa" | "Balochistan" | "Islamabad Capital Territory" | "Gilgit-Baltistan" | "Azad Kashmir";
    label?: string | undefined;
    postalCode?: string | undefined;
    isDefault?: boolean | undefined;
}>;
export declare const addToCartSchema: z.ZodObject<{
    variantId: z.ZodString;
    quantity: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    variantId: string;
    quantity: number;
}, {
    variantId: string;
    quantity?: number | undefined;
}>;
export declare const updateCartItemSchema: z.ZodObject<{
    quantity: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    quantity: number;
}, {
    quantity: number;
}>;
export declare const paymentMethods: readonly ["COD", "STRIPE", "JAZZCASH", "EASYPAISA"];
export declare const checkoutSchema: z.ZodObject<{
    addressId: z.ZodOptional<z.ZodString>;
    newAddress: z.ZodOptional<z.ZodObject<{
        label: z.ZodDefault<z.ZodString>;
        fullName: z.ZodString;
        phone: z.ZodString;
        addressLine: z.ZodString;
        city: z.ZodString;
        province: z.ZodEnum<["Punjab", "Sindh", "Khyber Pakhtunkhwa", "Balochistan", "Islamabad Capital Territory", "Gilgit-Baltistan", "Azad Kashmir"]>;
        postalCode: z.ZodOptional<z.ZodString>;
        isDefault: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        phone: string;
        label: string;
        fullName: string;
        addressLine: string;
        city: string;
        province: "Punjab" | "Sindh" | "Khyber Pakhtunkhwa" | "Balochistan" | "Islamabad Capital Territory" | "Gilgit-Baltistan" | "Azad Kashmir";
        postalCode?: string | undefined;
        isDefault?: boolean | undefined;
    }, {
        phone: string;
        fullName: string;
        addressLine: string;
        city: string;
        province: "Punjab" | "Sindh" | "Khyber Pakhtunkhwa" | "Balochistan" | "Islamabad Capital Territory" | "Gilgit-Baltistan" | "Azad Kashmir";
        label?: string | undefined;
        postalCode?: string | undefined;
        isDefault?: boolean | undefined;
    }>>;
    paymentMethod: z.ZodEnum<["COD", "STRIPE", "JAZZCASH", "EASYPAISA"]>;
    couponCode: z.ZodOptional<z.ZodString>;
    deliveryMethod: z.ZodDefault<z.ZodEnum<["standard", "express"]>>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    paymentMethod: "COD" | "STRIPE" | "JAZZCASH" | "EASYPAISA";
    deliveryMethod: "standard" | "express";
    addressId?: string | undefined;
    newAddress?: {
        phone: string;
        label: string;
        fullName: string;
        addressLine: string;
        city: string;
        province: "Punjab" | "Sindh" | "Khyber Pakhtunkhwa" | "Balochistan" | "Islamabad Capital Territory" | "Gilgit-Baltistan" | "Azad Kashmir";
        postalCode?: string | undefined;
        isDefault?: boolean | undefined;
    } | undefined;
    couponCode?: string | undefined;
    notes?: string | undefined;
}, {
    paymentMethod: "COD" | "STRIPE" | "JAZZCASH" | "EASYPAISA";
    addressId?: string | undefined;
    newAddress?: {
        phone: string;
        fullName: string;
        addressLine: string;
        city: string;
        province: "Punjab" | "Sindh" | "Khyber Pakhtunkhwa" | "Balochistan" | "Islamabad Capital Territory" | "Gilgit-Baltistan" | "Azad Kashmir";
        label?: string | undefined;
        postalCode?: string | undefined;
        isDefault?: boolean | undefined;
    } | undefined;
    couponCode?: string | undefined;
    deliveryMethod?: "standard" | "express" | undefined;
    notes?: string | undefined;
}>;
export declare const orderStatuses: readonly ["PLACED", "CONFIRMED", "PACKED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "RETURNED"];
export declare const updateOrderStatusSchema: z.ZodObject<{
    status: z.ZodEnum<["PLACED", "CONFIRMED", "PACKED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "RETURNED"]>;
    note: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "PLACED" | "CONFIRMED" | "PACKED" | "SHIPPED" | "OUT_FOR_DELIVERY" | "DELIVERED" | "CANCELLED" | "RETURNED";
    note?: string | undefined;
}, {
    status: "PLACED" | "CONFIRMED" | "PACKED" | "SHIPPED" | "OUT_FOR_DELIVERY" | "DELIVERED" | "CANCELLED" | "RETURNED";
    note?: string | undefined;
}>;
export declare const productStatuses: readonly ["DRAFT", "PUBLISHED", "ARCHIVED"];
export declare const variantInputSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    size: z.ZodOptional<z.ZodString>;
    color: z.ZodOptional<z.ZodString>;
    colorHex: z.ZodOptional<z.ZodString>;
    sku: z.ZodOptional<z.ZodString>;
    priceOverride: z.ZodOptional<z.ZodNumber>;
    stock: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    stock: number;
    id?: string | undefined;
    size?: string | undefined;
    color?: string | undefined;
    colorHex?: string | undefined;
    sku?: string | undefined;
    priceOverride?: number | undefined;
}, {
    id?: string | undefined;
    size?: string | undefined;
    color?: string | undefined;
    colorHex?: string | undefined;
    sku?: string | undefined;
    priceOverride?: number | undefined;
    stock?: number | undefined;
}>;
export declare const productInputSchema: z.ZodObject<{
    title: z.ZodString;
    slug: z.ZodOptional<z.ZodString>;
    description: z.ZodString;
    basePrice: z.ZodNumber;
    salePrice: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    costPrice: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    sku: z.ZodOptional<z.ZodString>;
    status: z.ZodDefault<z.ZodEnum<["DRAFT", "PUBLISHED", "ARCHIVED"]>>;
    isFeatured: z.ZodDefault<z.ZodBoolean>;
    brand: z.ZodOptional<z.ZodString>;
    fabric: z.ZodOptional<z.ZodString>;
    categoryId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    seoTitle: z.ZodOptional<z.ZodString>;
    seoDescription: z.ZodOptional<z.ZodString>;
    images: z.ZodDefault<z.ZodArray<z.ZodObject<{
        url: z.ZodString;
        alt: z.ZodOptional<z.ZodString>;
        isPrimary: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        url: string;
        alt?: string | undefined;
        isPrimary?: boolean | undefined;
    }, {
        url: string;
        alt?: string | undefined;
        isPrimary?: boolean | undefined;
    }>, "many">>;
    variants: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        size: z.ZodOptional<z.ZodString>;
        color: z.ZodOptional<z.ZodString>;
        colorHex: z.ZodOptional<z.ZodString>;
        sku: z.ZodOptional<z.ZodString>;
        priceOverride: z.ZodOptional<z.ZodNumber>;
        stock: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        stock: number;
        id?: string | undefined;
        size?: string | undefined;
        color?: string | undefined;
        colorHex?: string | undefined;
        sku?: string | undefined;
        priceOverride?: number | undefined;
    }, {
        id?: string | undefined;
        size?: string | undefined;
        color?: string | undefined;
        colorHex?: string | undefined;
        sku?: string | undefined;
        priceOverride?: number | undefined;
        stock?: number | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
    title: string;
    description: string;
    basePrice: number;
    isFeatured: boolean;
    images: {
        url: string;
        alt?: string | undefined;
        isPrimary?: boolean | undefined;
    }[];
    variants: {
        stock: number;
        id?: string | undefined;
        size?: string | undefined;
        color?: string | undefined;
        colorHex?: string | undefined;
        sku?: string | undefined;
        priceOverride?: number | undefined;
    }[];
    sku?: string | undefined;
    slug?: string | undefined;
    salePrice?: number | null | undefined;
    costPrice?: number | null | undefined;
    brand?: string | undefined;
    fabric?: string | undefined;
    categoryId?: string | null | undefined;
    seoTitle?: string | undefined;
    seoDescription?: string | undefined;
}, {
    title: string;
    description: string;
    basePrice: number;
    status?: "DRAFT" | "PUBLISHED" | "ARCHIVED" | undefined;
    sku?: string | undefined;
    slug?: string | undefined;
    salePrice?: number | null | undefined;
    costPrice?: number | null | undefined;
    isFeatured?: boolean | undefined;
    brand?: string | undefined;
    fabric?: string | undefined;
    categoryId?: string | null | undefined;
    seoTitle?: string | undefined;
    seoDescription?: string | undefined;
    images?: {
        url: string;
        alt?: string | undefined;
        isPrimary?: boolean | undefined;
    }[] | undefined;
    variants?: {
        id?: string | undefined;
        size?: string | undefined;
        color?: string | undefined;
        colorHex?: string | undefined;
        sku?: string | undefined;
        priceOverride?: number | undefined;
        stock?: number | undefined;
    }[] | undefined;
}>;
export declare const categoryInputSchema: z.ZodObject<{
    name: z.ZodString;
    slug: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    image: z.ZodOptional<z.ZodString>;
    parentId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    isActive: z.ZodDefault<z.ZodBoolean>;
    sortOrder: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    name: string;
    isActive: boolean;
    sortOrder: number;
    slug?: string | undefined;
    description?: string | undefined;
    image?: string | undefined;
    parentId?: string | null | undefined;
}, {
    name: string;
    slug?: string | undefined;
    description?: string | undefined;
    image?: string | undefined;
    parentId?: string | null | undefined;
    isActive?: boolean | undefined;
    sortOrder?: number | undefined;
}>;
export declare const couponInputSchema: z.ZodObject<{
    code: z.ZodEffects<z.ZodString, string, string>;
    type: z.ZodEnum<["PERCENTAGE", "FIXED"]>;
    value: z.ZodNumber;
    minOrderValue: z.ZodDefault<z.ZodNumber>;
    usageLimit: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    perUserLimit: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    isActive: z.ZodDefault<z.ZodBoolean>;
    startsAt: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    expiresAt: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    value: number;
    code: string;
    type: "PERCENTAGE" | "FIXED";
    isActive: boolean;
    minOrderValue: number;
    usageLimit?: number | null | undefined;
    perUserLimit?: number | null | undefined;
    startsAt?: string | null | undefined;
    expiresAt?: string | null | undefined;
}, {
    value: number;
    code: string;
    type: "PERCENTAGE" | "FIXED";
    isActive?: boolean | undefined;
    minOrderValue?: number | undefined;
    usageLimit?: number | null | undefined;
    perUserLimit?: number | null | undefined;
    startsAt?: string | null | undefined;
    expiresAt?: string | null | undefined;
}>;
export declare const sectionTypes: readonly ["PRODUCT_GRID", "BANNER", "CAROUSEL", "CATEGORY_TILES"];
export declare const sectionInputSchema: z.ZodObject<{
    title: z.ZodString;
    type: z.ZodEnum<["PRODUCT_GRID", "BANNER", "CAROUSEL", "CATEGORY_TILES"]>;
    config: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodAny>>;
    sortOrder: z.ZodDefault<z.ZodNumber>;
    isActive: z.ZodDefault<z.ZodBoolean>;
    startDate: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    endDate: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    type: "PRODUCT_GRID" | "BANNER" | "CAROUSEL" | "CATEGORY_TILES";
    title: string;
    isActive: boolean;
    sortOrder: number;
    config: Record<string, any>;
    startDate?: string | null | undefined;
    endDate?: string | null | undefined;
}, {
    type: "PRODUCT_GRID" | "BANNER" | "CAROUSEL" | "CATEGORY_TILES";
    title: string;
    isActive?: boolean | undefined;
    sortOrder?: number | undefined;
    config?: Record<string, any> | undefined;
    startDate?: string | null | undefined;
    endDate?: string | null | undefined;
}>;
export declare const reviewInputSchema: z.ZodObject<{
    rating: z.ZodNumber;
    comment: z.ZodOptional<z.ZodString>;
    images: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    images: string[];
    rating: number;
    comment?: string | undefined;
}, {
    rating: number;
    images?: string[] | undefined;
    comment?: string | undefined;
}>;
export declare const productQuerySchema: z.ZodObject<{
    category: z.ZodOptional<z.ZodString>;
    search: z.ZodOptional<z.ZodString>;
    minPrice: z.ZodOptional<z.ZodNumber>;
    maxPrice: z.ZodOptional<z.ZodNumber>;
    size: z.ZodOptional<z.ZodString>;
    color: z.ZodOptional<z.ZodString>;
    brand: z.ZodOptional<z.ZodString>;
    onSale: z.ZodOptional<z.ZodBoolean>;
    inStock: z.ZodOptional<z.ZodBoolean>;
    sort: z.ZodDefault<z.ZodEnum<["newest", "price_asc", "price_desc", "popularity", "rating"]>>;
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    sort: "rating" | "newest" | "price_asc" | "price_desc" | "popularity";
    page: number;
    pageSize: number;
    search?: string | undefined;
    category?: string | undefined;
    size?: string | undefined;
    color?: string | undefined;
    brand?: string | undefined;
    minPrice?: number | undefined;
    maxPrice?: number | undefined;
    onSale?: boolean | undefined;
    inStock?: boolean | undefined;
}, {
    search?: string | undefined;
    category?: string | undefined;
    sort?: "rating" | "newest" | "price_asc" | "price_desc" | "popularity" | undefined;
    size?: string | undefined;
    color?: string | undefined;
    brand?: string | undefined;
    minPrice?: number | undefined;
    maxPrice?: number | undefined;
    onSale?: boolean | undefined;
    inStock?: boolean | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
}>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type AddressInput = z.infer<typeof addressSchema>;
export type AddToCartInput = z.infer<typeof addToCartSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type ProductInput = z.infer<typeof productInputSchema>;
export type CategoryInput = z.infer<typeof categoryInputSchema>;
export type CouponInput = z.infer<typeof couponInputSchema>;
export type SectionInput = z.infer<typeof sectionInputSchema>;
export type ReviewInput = z.infer<typeof reviewInputSchema>;
export type ProductQuery = z.infer<typeof productQuerySchema>;
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
