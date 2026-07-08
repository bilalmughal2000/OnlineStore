import { prisma } from '@store/database';

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

// Ensures a unique slug for a model that has a unique `slug` column.
export async function uniqueSlug(
  base: string,
  model: 'product' | 'category',
  ignoreId?: string,
): Promise<string> {
  const root = slugify(base) || 'item';
  let slug = root;
  let n = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const found =
      model === 'product'
        ? await prisma.product.findUnique({ where: { slug } })
        : await prisma.category.findUnique({ where: { slug } });
    if (!found || found.id === ignoreId) return slug;
    slug = `${root}-${++n}`;
  }
}

export async function logActivity(
  adminId: string,
  action: string,
  entity: string,
  entityId?: string,
  meta?: unknown,
) {
  await prisma.adminActivityLog.create({
    data: { adminId, action, entity, entityId, meta: meta as never },
  });
}
