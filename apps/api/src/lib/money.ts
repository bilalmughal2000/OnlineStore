import { Prisma } from '@store/database';

// Helpers to work with Prisma Decimal values as plain numbers at the edges.
export const toNum = (d: Prisma.Decimal | number | null | undefined): number =>
  d == null ? 0 : typeof d === 'number' ? d : Number(d.toString());

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;
