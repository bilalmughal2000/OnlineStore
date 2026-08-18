import { prisma, ProductStatus } from '@store/database';
import { cached } from '../../lib/cache';

/*
 * Category tree helpers.
 *
 * The schema allows a category to nest to any depth (`parentId` → `children`),
 * but the storefront used to only ever see two levels: the navbar listed roots
 * and `/products?category=x` matched "slug = x OR parent.slug = x". Anything a
 * third level down was unreachable and its products invisible from the parent.
 *
 * Everything here works off ONE flat query and builds the tree in memory —
 * categories number in the dozens, and a recursive Prisma `include` can't
 * express "to any depth" anyway.
 */

export interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  parentId: string | null;
  sortOrder: number;
  /** Products in this category *and* everything nested below it. */
  productCount: number;
  children: CategoryNode[];
}

/** Roots of the active-category forest, each node carrying its rolled-up count. */
async function loadTree(): Promise<CategoryNode[]> {
  // Cached as plain JSON (Redis round-trips through JSON.stringify, so no Maps
  // here). Admin writes bump the cache version, so edits show up immediately.
  return cached<CategoryNode[]>('categories:tree', 300, async () => {
    const [rows, counts] = await Promise.all([
      prisma.category.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          image: true,
          parentId: true,
          sortOrder: true,
        },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
      prisma.product.groupBy({
        by: ['categoryId'],
        where: { status: ProductStatus.PUBLISHED },
        _count: { _all: true },
      }),
    ]);

    const ownCount = new Map<string, number>();
    for (const c of counts) {
      if (c.categoryId) ownCount.set(c.categoryId, c._count._all);
    }

    const nodes = new Map<string, CategoryNode>();
    for (const r of rows) {
      nodes.set(r.id, { ...r, productCount: ownCount.get(r.id) ?? 0, children: [] });
    }

    // Attach each node to its parent. A child whose parent is inactive (or
    // missing) is promoted to a root rather than disappearing from the store.
    const roots: CategoryNode[] = [];
    for (const node of nodes.values()) {
      const parent = node.parentId ? nodes.get(node.parentId) : undefined;
      if (parent) parent.children.push(node);
      else roots.push(node);
    }

    // Roll the counts up so a parent shows the size of its whole subtree —
    // which is exactly what its listing page now returns.
    const rollUp = (node: CategoryNode): number => {
      for (const child of node.children) node.productCount += rollUp(child);
      return node.productCount;
    };
    roots.forEach(rollUp);

    return roots;
  });
}

export interface CategoryIndex {
  roots: CategoryNode[];
  bySlug: Map<string, CategoryNode>;
  /** Root-first path to each node, the node itself last. */
  trail: Map<string, CategoryNode[]>;
}

/** The tree plus lookup maps, rebuilt per request (cheap — it's the cached tree). */
export async function categoryIndex(): Promise<CategoryIndex> {
  const roots = await loadTree();
  const bySlug = new Map<string, CategoryNode>();
  const trail = new Map<string, CategoryNode[]>();

  const walk = (node: CategoryNode, ancestors: CategoryNode[]) => {
    const path = [...ancestors, node];
    bySlug.set(node.slug, node);
    trail.set(node.slug, path);
    node.children.forEach((c) => walk(c, path));
  };
  roots.forEach((r) => walk(r, []));

  return { roots, bySlug, trail };
}

/** A node's id plus every id nested beneath it — the "products in this branch" set. */
export function subtreeIds(node: CategoryNode): string[] {
  const ids = [node.id];
  for (const child of node.children) ids.push(...subtreeIds(child));
  return ids;
}

/** Ids matching a category slug and everything below it; `null` if unknown. */
export async function branchIdsForSlug(slug: string): Promise<string[] | null> {
  const { bySlug } = await categoryIndex();
  const node = bySlug.get(slug);
  return node ? subtreeIds(node) : null;
}
