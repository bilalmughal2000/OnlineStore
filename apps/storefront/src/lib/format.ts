// PKR currency formatting used throughout the storefront.
export function formatPKR(amount: number): string {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    maximumFractionDigits: 0,
  }).format(amount);
}

// Effective price = sale price if present, else base price.
export function effectivePrice(p: { basePrice: number; salePrice?: number | null }): number {
  return p.salePrice ?? p.basePrice;
}

export function discountPct(p: { basePrice: number; salePrice?: number | null }): number | null {
  if (!p.salePrice || p.salePrice >= p.basePrice) return null;
  return Math.round(((p.basePrice - p.salePrice) / p.basePrice) * 100);
}
