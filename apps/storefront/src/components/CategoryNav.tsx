'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { ArrowRight, ChevronDown } from 'lucide-react';
import type { MenuNode } from '@/lib/types';

/*
 * Category navigation.
 *
 * Categories nest to any depth, so the navbar can't be a flat row of links:
 * hovering a top-level category opens a floating panel showing what's under it,
 * and anything deeper nests inside that panel.
 *
 * Two panel layouts, picked from the shape of the data:
 *   - "groups" — subcategories that have children of their own become columns
 *     with their descendants listed beneath.
 *   - "flat"   — when nothing has a third level, a simple grid of link tiles,
 *     which reads far better than a row of headings with nothing under them.
 */

const kids = (n: MenuNode) => n.children ?? [];
const hasKids = (n: MenuNode) => kids(n).length > 0;

function Count({ n, muted = false }: { n: MenuNode; muted?: boolean }) {
  if (!n.productCount) return null;
  return (
    <span className={`shrink-0 text-[11px] tabular-nums ${muted ? 'text-ink/30' : 'text-ink/40'}`}>
      {n.productCount}
    </span>
  );
}

/** Levels 3+ inside a column — indented, with a hairline tying them to the parent. */
function SubList({ nodes, onNavigate, depth = 0 }: { nodes: MenuNode[]; onNavigate: () => void; depth?: number }) {
  return (
    <ul
      className={
        // A guide line at every level, aligned under the parent's label, so a
        // third-level item reads as belonging to the group above it.
        depth === 0
          ? 'ml-[0.6rem] mt-1 space-y-px border-l border-ink/10 pl-2'
          : 'mt-px space-y-px border-l border-ink/10 pl-2'
      }
    >
      {nodes.map((n) => (
        <li key={n.id}>
          <Link
            href={n.url}
            onClick={onNavigate}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] text-ink/65 transition-colors hover:bg-black/[0.04] hover:text-accent"
          >
            <span className="truncate">{n.label}</span>
            <Count n={n} muted />
          </Link>
          {hasKids(n) && <SubList nodes={kids(n)} onNavigate={onNavigate} depth={depth + 1} />}
        </li>
      ))}
    </ul>
  );
}

/** A subcategory that has its own children: heading + everything beneath it. */
function Group({ node, onNavigate }: { node: MenuNode; onNavigate: () => void }) {
  return (
    <div className="min-w-0">
      <Link
        href={node.url}
        onClick={onNavigate}
        className="group/head flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-ink transition-colors hover:bg-accent/10 hover:text-accent"
      >
        <span className="h-3.5 w-[3px] shrink-0 rounded-full bg-accent/50 transition-colors group-hover/head:bg-accent" />
        <span className="truncate">{node.label}</span>
        <Count n={node} />
      </Link>
      {hasKids(node) && <SubList nodes={kids(node)} onNavigate={onNavigate} />}
    </div>
  );
}

/** Nothing has a third level — show the subcategories as roomy link tiles. */
function FlatGrid({ nodes, onNavigate }: { nodes: MenuNode[]; onNavigate: () => void }) {
  return (
    <div
      className="grid gap-1.5"
      style={{ gridTemplateColumns: `repeat(${Math.min(nodes.length, 3)}, minmax(0, 200px))` }}
    >
      {nodes.map((n) => (
        <Link
          key={n.id}
          href={n.url}
          onClick={onNavigate}
          className="group/tile flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-accent/10 hover:text-accent"
        >
          <span className="truncate">{n.label}</span>
          <Count n={n} />
          <ArrowRight
            size={14}
            className="ml-auto shrink-0 -translate-x-1 text-accent opacity-0 transition-all duration-200 group-hover/tile:translate-x-0 group-hover/tile:opacity-100"
          />
        </Link>
      ))}
    </div>
  );
}

/** Desktop navbar: one floating panel for whichever top-level item is hovered. */
export function CategoryNav({ menu }: { menu: MenuNode[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  // Hover intent. Opening waits a beat so sweeping the pointer across the navbar
  // doesn't flash three panels; once a panel is open, switching is instant.
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = () => {
    if (openTimer.current) clearTimeout(openTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };
  const open = (id: string | null, immediate = false) => {
    clear();
    if (immediate || openId) setOpenId(id);
    else openTimer.current = setTimeout(() => setOpenId(id), 70);
  };
  const closeSoon = () => {
    clear();
    closeTimer.current = setTimeout(() => setOpenId(null), 160);
  };

  const active = menu.find((m) => m.id === openId && hasKids(m));
  const groups = active ? kids(active) : [];
  const isFlat = groups.length > 0 && groups.every((c) => !hasKids(c));

  return (
    <div className="hidden lg:block" onMouseLeave={closeSoon}>
      <nav className="flex items-center gap-0.5" onKeyDown={(e) => e.key === 'Escape' && open(null, true)}>
        {menu.map((m) => {
          const isOpen = m.id === openId;
          return (
            <Link
              key={m.id}
              href={m.url}
              onMouseEnter={() => open(m.id)}
              onFocus={() => open(m.id, true)}
              aria-haspopup={hasKids(m) ? 'true' : undefined}
              aria-expanded={hasKids(m) ? isOpen : undefined}
              className={`flex items-center gap-1 rounded-full px-3.5 py-2 text-sm font-medium transition-colors duration-150 ${
                isOpen ? 'bg-accent/10 text-accent' : 'text-ink hover:bg-black/[0.05]'
              }`}
            >
              {m.label}
              {hasKids(m) && (
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-200 ${isOpen ? 'rotate-180 text-accent' : 'text-ink/40'}`}
                />
              )}
            </Link>
          );
        })}
      </nav>

      {active && (
        <div
          className="absolute left-0 right-0 top-full flex justify-center px-4"
          onMouseEnter={() => open(active.id, true)}
        >
          <div className="menu-pop mt-2 w-max max-w-[min(64rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-[0_20px_60px_-20px_rgba(0,0,0,0.35)]">
            <div className="flex min-h-[8.5rem] items-stretch gap-6 p-5">
              <div className={`min-w-0 ${isFlat ? '' : 'lg:min-w-[26rem]'}`}>
                <div className="mb-3 flex items-center gap-3 border-b border-black/[0.06] px-2.5 pb-2.5">
                  <span className="font-serif text-base font-bold text-ink">{active.label}</span>
                  {active.productCount ? (
                    <span className="rounded-full bg-black/[0.05] px-2 py-0.5 text-[11px] text-ink/50">
                      {active.productCount} products
                    </span>
                  ) : null}
                  <Link
                    href={active.url}
                    onClick={() => open(null, true)}
                    className="group/all ml-auto inline-flex items-center gap-1.5 rounded-full bg-ink px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-white transition-colors hover:bg-accent"
                  >
                    Shop all
                    <ArrowRight size={13} className="transition-transform group-hover/all:translate-x-0.5" />
                  </Link>
                </div>

                {isFlat ? (
                  <FlatGrid nodes={groups} onNavigate={() => open(null, true)} />
                ) : (
                  <div
                    className="grid gap-x-6 gap-y-4"
                    style={{ gridTemplateColumns: `repeat(${Math.min(groups.length, 4)}, minmax(0, 190px))` }}
                  >
                    {groups.map((c) => (
                      <Group key={c.id} node={c} onNavigate={() => open(null, true)} />
                    ))}
                  </div>
                )}

              </div>

              {active.image && (
                <Link
                  href={active.url}
                  onClick={() => open(null, true)}
                  // Stretches to the panel's content height rather than forcing
                  // one, so a shallow category keeps a compact panel.
                  className="group/img relative hidden w-40 shrink-0 self-stretch overflow-hidden rounded-xl xl:block"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {/* Absolute so its intrinsic aspect ratio doesn't decide the
                      panel's height — the links do. */}
                  <img
                    src={active.image}
                    alt={active.label}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover/img:scale-105"
                  />
                  <span className="absolute inset-0 bg-gradient-to-t from-ink/75 via-ink/10 to-transparent" />
                  <span className="absolute bottom-3 left-3 right-3 text-[13px] font-semibold text-white">
                    Explore {active.label}
                  </span>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Drawer version: the same tree as tap-to-expand rows. */
export function MobileCategoryNav({ menu, onNavigate }: { menu: MenuNode[]; onNavigate: () => void }) {
  const [expanded, setExpanded] = useState<string[]>([]);
  const toggle = (id: string) =>
    setExpanded((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const Rows = ({ nodes, depth }: { nodes: MenuNode[]; depth: number }) => (
    <ul className={depth === 0 ? 'space-y-0.5' : 'space-y-0.5 border-l border-ink/10 pl-2'}>
      {nodes.map((n) => {
        const isOpen = expanded.includes(n.id);
        return (
          <li key={n.id}>
            <div className="flex items-center">
              <Link
                href={n.url}
                onClick={onNavigate}
                className={`min-w-0 flex-1 truncate rounded-xl px-3 py-2.5 transition-colors active:bg-accent/10 ${
                  depth === 0 ? 'font-semibold' : 'text-[15px] text-ink/75'
                }`}
              >
                {n.label}
                {n.productCount ? <span className="ml-2 text-[11px] text-ink/35">{n.productCount}</span> : null}
              </Link>
              {hasKids(n) && (
                <button
                  onClick={() => toggle(n.id)}
                  aria-label={`${isOpen ? 'Hide' : 'Show'} ${n.label} subcategories`}
                  aria-expanded={isOpen}
                  className={`shrink-0 rounded-xl p-2 transition ${
                    isOpen ? 'bg-accent/10 text-accent' : 'text-ink/40 hover:bg-black/5'
                  }`}
                >
                  <ChevronDown size={17} className={`transition-transform duration-200 ${isOpen ? '' : '-rotate-90'}`} />
                </button>
              )}
            </div>
            {hasKids(n) && isOpen && (
              <div className="ml-3 mt-0.5">
                <Rows nodes={kids(n)} depth={depth + 1} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );

  return (
    <nav>
      <Rows nodes={menu} depth={0} />
    </nav>
  );
}
