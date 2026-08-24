/**
 * Cart stock checks, shared by the cart and checkout pages.
 *
 * A cart never reserves stock — it's claimed at checkout, so whoever pays first
 * gets it. That's the right default (reserving would let abandoned carts hide
 * sellable inventory), but it means a shopper can reach the payment step with
 * something that has since sold out. The API refuses that order, which is
 * correct but arrives at the worst possible moment: after they've typed an
 * address and chosen how to pay.
 *
 * `priceCart` already returns live `stock` per line, so both pages can say so
 * up front instead of letting the buyer walk into a rejection.
 */

export interface StockLine {
  variantId: string;
  productTitle: string;
  variantLabel?: string | null;
  quantity: number;
  stock: number;
}

export type StockState =
  /** Gone entirely — the line has to be removed before checkout. */
  | { kind: 'sold-out'; available: 0 }
  /** Some left, but fewer than the shopper asked for. */
  | { kind: 'not-enough'; available: number }
  /** Enough for now, but few enough to be worth flagging. */
  | { kind: 'low'; available: number }
  | { kind: 'ok'; available: number };

/** How few is "only N left". Matches the product page's threshold. */
export const LOW_STOCK_AT = 5;

export function stockStateOf(line: StockLine): StockState {
  if (line.stock <= 0) return { kind: 'sold-out', available: 0 };
  if (line.quantity > line.stock) return { kind: 'not-enough', available: line.stock };
  if (line.stock <= LOW_STOCK_AT) return { kind: 'low', available: line.stock };
  return { kind: 'ok', available: line.stock };
}

/** True when this line would make the order fail. */
export const blocksCheckout = (s: StockState) => s.kind === 'sold-out' || s.kind === 'not-enough';

/** The lines that must be fixed before the order can go through. */
export function blockingLines<T extends StockLine>(lines: T[]): T[] {
  return lines.filter((l) => blocksCheckout(stockStateOf(l)));
}

/** Short label for a line, e.g. `Lawn Kurta — M / Red`. */
export const lineLabel = (l: StockLine) =>
  [l.productTitle, l.variantLabel].filter(Boolean).join(' — ');

/** One-line explanation of what the shopper needs to do about this line. */
export function stockMessage(line: StockLine): string | null {
  const s = stockStateOf(line);
  switch (s.kind) {
    case 'sold-out':
      return 'Sold out — remove it to continue.';
    case 'not-enough':
      return `Only ${s.available} left — reduce the quantity to continue.`;
    case 'low':
      return `Only ${s.available} left — someone else may be buying this.`;
    default:
      return null;
  }
}
