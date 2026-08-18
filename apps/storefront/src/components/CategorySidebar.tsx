'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ChevronDown, LayoutGrid, X } from 'lucide-react';
import type { Category } from '@/lib/types';

/*
 * Subcategory navigation for a listing page.
 *
 * Shows the whole branch the current category belongs to — every level, not just
 * the active path — so "Women › Sarees › yy" is reachable while browsing Women.
 * Branches start expanded and can be collapsed; the panel scrolls on its own so
 * a deep tree never runs off the bottom of the page.
 */

interface Props {
  /** Top-level category with its full subtree. */
  branch: Category;
  /** Slug of the category being viewed. */
  activeSlug: string;
  /** Root-first slugs from `branch` down to the active category. */
  trail: string[];
}

function Row({
  node,
  activeSlug,
  trail,
  depth,
  collapsed,
  toggle,
  onNavigate,
}: {
  node: Category;
  activeSlug: string;
  trail: string[];
  depth: number;
  collapsed: Set<string>;
  toggle: (slug: string) => void;
  onNavigate?: () => void;
}) {
  const children = node.children ?? [];
  const isActive = node.slug === activeSlug;
  const onPath = trail.includes(node.slug);
  const isOpen = children.length > 0 && !collapsed.has(node.slug);

  return (
    <li>
      <div className="relative flex items-center">
        <Link
          href={`/category/${node.slug}`}
          onClick={onNavigate}
          aria-current={isActive ? 'page' : undefined}
          style={{ paddingLeft: `${depth * 0.875 + 0.625}rem` }}
          className={`flex min-w-0 flex-1 items-center gap-2 rounded-xl py-2.5 pr-2 text-sm transition-colors duration-150 sm:py-2 ${
            isActive
              ? 'bg-accent/10 font-semibold text-accent'
              : onPath
                ? 'font-medium text-ink hover:bg-black/[0.04]'
                : 'text-ink/70 hover:bg-black/[0.04] hover:text-ink'
          }`}
        >
          {isActive && (
            <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-accent" />
          )}
          <span className="min-w-0 flex-1 truncate">{node.name}</span>
          {node.productCount ? (
            <span
              className={`shrink-0 rounded-full px-1.5 py-0.5 text-[11px] tabular-nums ${
                isActive ? 'bg-accent/15 text-accent' : 'bg-black/[0.05] text-ink/45'
              }`}
            >
              {node.productCount}
            </span>
          ) : null}
        </Link>

        {/* Fixed-width slot, occupied or not, so every row's count lines up. */}
        <span className="flex w-7 shrink-0 justify-center">
          {children.length > 0 && (
            <button
              type="button"
              onClick={() => toggle(node.slug)}
              aria-expanded={isOpen}
              aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${node.name}`}
              className="rounded-lg p-1.5 text-ink/35 transition hover:bg-accent/10 hover:text-accent"
            >
              <ChevronDown size={15} className={`transition-transform duration-200 ${isOpen ? '' : '-rotate-90'}`} />
            </button>
          )}
        </span>
      </div>

      {isOpen && (
        <ul className="mt-0.5 space-y-0.5">
          {children.map((c) => (
            <Row
              key={c.id}
              node={c}
              activeSlug={activeSlug}
              trail={trail}
              depth={depth + 1}
              collapsed={collapsed}
              toggle={toggle}
              onNavigate={onNavigate}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function Tree({ branch, activeSlug, trail, onNavigate }: Props & { onNavigate?: () => void }) {
  // Everything starts expanded — these trees are small, and a subcategory that
  // only appears once you're already inside it is a subcategory nobody finds.
  // Collapsing is opt-in and kept while the shopper stays on the page.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggle = (slug: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });

  return (
    <ul className="space-y-0.5">
      <Row
        node={branch}
        activeSlug={activeSlug}
        trail={trail}
        depth={0}
        collapsed={collapsed}
        toggle={toggle}
        onNavigate={onNavigate}
      />
    </ul>
  );
}

/** Direct children of the current category as horizontal chips (small screens). */
function Chips({ node }: { node: Category }) {
  const children = node.children ?? [];
  if (!children.length) return null;
  return (
    <div className="-mx-4 mb-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 lg:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {children.map((c) => (
        <Link
          key={c.id}
          href={`/category/${c.slug}`}
          className="shrink-0 snap-start rounded-full border border-ink/10 bg-white px-4 py-2 text-sm font-medium text-ink/80 shadow-sm transition hover:border-accent hover:text-accent active:scale-95"
        >
          {c.name}
          {c.productCount ? <span className="ml-1.5 text-[11px] text-ink/40">{c.productCount}</span> : null}
        </Link>
      ))}
    </div>
  );
}

export function CategorySidebar({ branch, activeSlug, trail }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);
  if (!branch.children?.length) return null;

  const current = findNode(branch, activeSlug) ?? branch;

  return (
    <>
      {/* ── Desktop: sticky card that scrolls independently of the product grid ── */}
      <aside className="hidden w-64 shrink-0 lg:block">
        <div className="sticky top-4">
          {/* Height budget: the sticky header (~6rem) plus a gap top and bottom.
              Without a cap, a deep tree runs off the bottom of the viewport with
              no way to scroll to the rest of it. */}
          <div className="card flex max-h-[calc(100dvh-9rem)] flex-col overflow-hidden">
            <div className="flex items-center gap-2 border-b border-black/5 px-4 py-3">
              <LayoutGrid size={15} className="text-accent" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-ink/60">Categories</h2>
            </div>
            {/* Only this list scrolls, so a deep tree can't run off the page. */}
            <div className="app-scroll flex-1 px-2 py-2">
              <Tree branch={branch} activeSlug={activeSlug} trail={trail} />
            </div>
          </div>
        </div>
      </aside>

      {/* ── Mobile: chips for the current level + a full-tree bottom sheet ── */}
      <div className="lg:hidden">
        <Chips node={current} />
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="mb-5 flex w-full items-center gap-2 rounded-xl border border-ink/10 bg-white px-4 py-3 text-sm font-semibold shadow-sm transition active:scale-[0.99]"
        >
          <LayoutGrid size={16} className="text-accent" />
          Browse {branch.name}
          <ChevronDown size={16} className="ml-auto text-ink/40" />
        </button>

        {sheetOpen && (
          <div className="fixed inset-0 z-50 flex items-end lg:hidden">
            <button
              aria-label="Close categories"
              onClick={() => setSheetOpen(false)}
              className="absolute inset-0 bg-black/40"
            />
            <div className="sheet-up relative flex max-h-[80dvh] w-full flex-col rounded-t-2xl bg-cream">
              <div className="flex items-center justify-between border-b border-black/5 px-4 py-3">
                <span className="flex items-center gap-2 font-semibold">
                  <LayoutGrid size={16} className="text-accent" />
                  {branch.name}
                </span>
                <button
                  onClick={() => setSheetOpen(false)}
                  aria-label="Close"
                  className="rounded-full p-1.5 text-ink/50 hover:bg-black/5"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="app-scroll flex-1 px-2 py-2">
                <Tree
                  branch={branch}
                  activeSlug={activeSlug}
                  trail={trail}
                  onNavigate={() => setSheetOpen(false)}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/** Locate a category inside a branch by slug. */
function findNode(node: Category, slug: string): Category | null {
  if (node.slug === slug) return node;
  for (const child of node.children ?? []) {
    const hit = findNode(child, slug);
    if (hit) return hit;
  }
  return null;
}
