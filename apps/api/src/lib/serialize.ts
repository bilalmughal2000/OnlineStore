import { Prisma } from '@store/database';

// Recursively convert Prisma.Decimal → number so API responses are clean JSON
// (numbers, not string-encoded decimals). Dates are left to default ISO handling.
export function serialize<T>(value: T): T {
  if (value == null) return value;
  if (value instanceof Prisma.Decimal) return Number(value.toString()) as unknown as T;
  if (Array.isArray(value)) return value.map((v) => serialize(v)) as unknown as T;
  if (value instanceof Date) return value as unknown as T;
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = serialize(v);
    }
    return out as T;
  }
  return value;
}
