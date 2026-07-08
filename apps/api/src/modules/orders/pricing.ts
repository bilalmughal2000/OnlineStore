import { prisma, CouponType } from '@store/database';
import { toNum, round2 } from '../../lib/money';
import { badRequest } from '../../lib/errors';

export interface PricedLine {
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

export interface CartPricing {
  lines: PricedLine[];
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
  couponCode: string | null;
  freeShippingThreshold: number;
  amountToFreeShipping: number;
}

async function getSettings() {
  const rows = await prisma.setting.findMany({
    where: { key: { in: ['shipping', 'tax'] } },
  });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value as Record<string, unknown>]));
  return {
    flatRate: Number(map.shipping?.flatRate ?? 200),
    freeShippingThreshold: Number(map.shipping?.freeShippingThreshold ?? 3000),
    taxEnabled: Boolean(map.tax?.enabled ?? false),
    taxRate: Number(map.tax?.rate ?? 0),
  };
}

// The unit price = variant override, else product sale price, else base price.
function unitPriceOf(variant: {
  priceOverride: unknown;
  product: { basePrice: unknown; salePrice: unknown };
}): number {
  if (variant.priceOverride != null) return toNum(variant.priceOverride as never);
  if (variant.product.salePrice != null) return toNum(variant.product.salePrice as never);
  return toNum(variant.product.basePrice as never);
}

/**
 * Computes authoritative cart pricing server-side (never trust the client).
 * Optionally applies a coupon; throws if the coupon is invalid for this cart.
 */
export async function priceCart(
  items: { variantId: string; quantity: number }[],
  opts: { couponCode?: string | null; userId?: string } = {},
): Promise<CartPricing> {
  const settings = await getSettings();

  const variantIds = items.map((i) => i.variantId);
  const variants = await prisma.productVariant.findMany({
    where: { id: { in: variantIds } },
    include: {
      product: {
        include: { images: { where: { isPrimary: true }, take: 1 } },
      },
    },
  });
  const byId = new Map(variants.map((v) => [v.id, v]));

  const lines: PricedLine[] = [];
  for (const item of items) {
    const v = byId.get(item.variantId);
    if (!v) continue; // silently drop stale variant references
    const unitPrice = unitPriceOf(v);
    lines.push({
      variantId: v.id,
      productId: v.productId,
      productTitle: v.product.title,
      slug: v.product.slug,
      variantLabel: [v.size, v.color].filter(Boolean).join(' / '),
      unitPrice,
      quantity: item.quantity,
      lineTotal: round2(unitPrice * item.quantity),
      stock: v.stock,
      image: v.product.images[0]?.url ?? null,
    });
  }

  const subtotal = round2(lines.reduce((s, l) => s + l.lineTotal, 0));

  // ── Coupon ──
  let discount = 0;
  let couponCode: string | null = null;
  if (opts.couponCode) {
    const coupon = await prisma.coupon.findUnique({ where: { code: opts.couponCode.toUpperCase() } });
    const now = new Date();
    if (!coupon || !coupon.isActive) throw badRequest('Invalid coupon code');
    if (coupon.startsAt && coupon.startsAt > now) throw badRequest('Coupon is not active yet');
    if (coupon.expiresAt && coupon.expiresAt < now) throw badRequest('Coupon has expired');
    if (subtotal < toNum(coupon.minOrderValue))
      throw badRequest(`Coupon requires a minimum order of Rs. ${toNum(coupon.minOrderValue)}`);
    if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit)
      throw badRequest('Coupon usage limit reached');
    if (coupon.perUserLimit != null && opts.userId) {
      const used = await prisma.order.count({
        where: { userId: opts.userId, couponCode: coupon.code },
      });
      if (used >= coupon.perUserLimit) throw badRequest('You have already used this coupon');
    }
    discount =
      coupon.type === CouponType.PERCENTAGE
        ? round2((subtotal * toNum(coupon.value)) / 100)
        : Math.min(toNum(coupon.value), subtotal);
    couponCode = coupon.code;
  }

  const taxable = Math.max(0, subtotal - discount);
  const shipping =
    lines.length === 0 || taxable >= settings.freeShippingThreshold ? 0 : settings.flatRate;
  const tax = settings.taxEnabled ? round2((taxable * settings.taxRate) / 100) : 0;
  const total = round2(taxable + shipping + tax);

  return {
    lines,
    subtotal,
    discount,
    shipping,
    tax,
    total,
    couponCode,
    freeShippingThreshold: settings.freeShippingThreshold,
    amountToFreeShipping: Math.max(0, settings.freeShippingThreshold - taxable),
  };
}
