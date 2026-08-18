'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Clock, Search, Tag, TrendingUp, X } from 'lucide-react';
import { clientApi } from '@/lib/client-api';
import { formatPKR, effectivePrice, discountPct } from '@/lib/format';
import type { MenuNode, Product } from '@/lib/types';

/*
 * Search with live suggestions.
 *
 * Typing queries products *and* categories after a short debounce; before the
 * shopper types anything the panel is still useful — recent searches (kept in
 * this browser), the categories from the navbar, and what's popular right now.
 *
 * One component, two shells: an inline dropdown on desktop and a full-screen
 * sheet on phones, where a 300px dropdown under a 40px input is unusable.
 */

interface SuggestProduct {
  id: string;
  title: string;
  slug: string;
  basePrice: number;
  salePrice?: number | null;
  brand?: string | null;
  category?: { name: string; slug: string } | null;
  images: { url: string }[];
}

interface SuggestCategory {
  id: string;
  name: string;
  slug: string;
  productCount: number;
}

const RECENT_KEY = 'store_recent_searches';
const MAX_RECENT = 5;

function readRecent(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string').slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

function pushRecent(term: string) {
  const clean = term.trim();
  if (clean.length < 2) return;
  const next = [clean, ...readRecent().filter((t) => t.toLowerCase() !== clean.toLowerCase())].slice(0, MAX_RECENT);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* private mode — suggestions just won't persist */
  }
}

export function SearchBox({
  menu = [],
  variant = 'inline',
  onClose,
}: {
  /** Top-level categories, reused as browse suggestions (no extra request). */
  menu?: MenuNode[];
  variant?: 'inline' | 'sheet';
  onClose?: () => void;
}) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(variant === 'sheet');
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<SuggestProduct[]>([]);
  const [categories, setCategories] = useState<SuggestCategory[]>([]);
  const [popular, setPopular] = useState<SuggestProduct[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [cursor, setCursor] = useState(-1);

  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const term = q.trim();

  useEffect(() => setRecent(readRecent()), []);

  // The sheet is opened deliberately, so put the caret in the field.
  useEffect(() => {
    if (variant === 'sheet') inputRef.current?.focus();
  }, [variant]);

  // Popular products, fetched once the panel is first opened rather than on
  // page load — this is a suggestion, not something worth costing every visit.
  useEffect(() => {
    if (!open || popular.length) return;
    clientApi
      .get<{ items: Product[] }>('/products?sort=popularity&pageSize=4')
      .then((d) => setPopular(d.items as unknown as SuggestProduct[]))
      .catch(() => {});
  }, [open, popular.length]);

  // Debounced suggestions. `seq` drops responses that arrive out of order, so a
  // slow request for "ku" can't overwrite the results for "kurti".
  const seq = useRef(0);
  useEffect(() => {
    if (term.length < 2) {
      setProducts([]);
      setCategories([]);
      setLoading(false);
      return;
    }
    const mine = ++seq.current;
    setLoading(true);
    const timer = setTimeout(() => {
      clientApi
        .get<{ items: SuggestProduct[]; categories: SuggestCategory[] }>(
          `/products/search?q=${encodeURIComponent(term)}`,
        )
        .then((d) => {
          if (mine !== seq.current) return;
          setProducts(d.items ?? []);
          setCategories(d.categories ?? []);
        })
        .catch(() => {
          if (mine === seq.current) {
            setProducts([]);
            setCategories([]);
          }
        })
        .finally(() => {
          if (mine === seq.current) setLoading(false);
        });
    }, 200);
    return () => clearTimeout(timer);
  }, [term]);

  // Close the inline dropdown on an outside click.
  useEffect(() => {
    if (variant !== 'inline' || !open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [variant, open]);

  const close = useCallback(() => {
    setOpen(variant === 'sheet');
    setCursor(-1);
    onClose?.();
  }, [onClose, variant]);

  const go = useCallback(
    (href: string, remember?: string) => {
      if (remember) {
        pushRecent(remember);
        setRecent(readRecent());
      }
      setOpen(false);
      setCursor(-1);
      onClose?.();
      router.push(href);
    },
    [onClose, router],
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (term.length < 1) return;
    go(`/search?q=${encodeURIComponent(term)}`, term);
  };

  // Flat list of everything arrow keys can land on, in visual order.
  const targets = useMemo(() => {
    if (term.length >= 2) {
      return [
        ...products.map((p) => ({ href: `/product/${p.slug}`, remember: term })),
        ...categories.map((c) => ({ href: `/category/${c.slug}`, remember: term })),
        ...(products.length || categories.length
          ? [{ href: `/search?q=${encodeURIComponent(term)}`, remember: term }]
          : []),
      ];
    }
    return [
      ...recent.map((r) => ({ href: `/search?q=${encodeURIComponent(r)}`, remember: r })),
      ...menu.map((m) => ({ href: m.url, remember: undefined })),
      ...popular.map((p) => ({ href: `/product/${p.slug}`, remember: undefined })),
    ];
  }, [term, products, categories, recent, menu, popular]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      close();
      inputRef.current?.blur();
      return;
    }
    if (!targets.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setCursor((c) => (c + 1) % targets.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor((c) => (c <= 0 ? targets.length - 1 : c - 1));
    } else if (e.key === 'Enter' && cursor >= 0) {
      e.preventDefault();
      const t = targets[cursor];
      go(t.href, t.remember);
    }
  };

  const clearRecent = () => {
    try {
      localStorage.removeItem(RECENT_KEY);
    } catch {
      /* ignore */
    }
    setRecent([]);
  };

  // Index bookkeeping so the highlighted row matches the keyboard cursor.
  let idx = -1;
  const nextIdx = () => ++idx;
  const rowClass = (i: number) =>
    `flex items-center gap-3 rounded-xl px-2.5 py-2 transition-colors ${
      i === cursor ? 'bg-accent/10' : 'hover:bg-black/[0.04]'
    }`;

  const panel = (
    <div className={variant === 'sheet' ? 'space-y-5' : 'space-y-4'}>
      {term.length >= 2 ? (
        <>
          {loading && !products.length && !categories.length && (
            <div className="space-y-2 px-2.5 py-1">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="skeleton h-11 w-11 rounded-lg" />
                  <div className="flex-1 space-y-1.5">
                    <div className="skeleton h-3 w-2/3" />
                    <div className="skeleton h-3 w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && !products.length && !categories.length && (
            <div className="px-2.5 py-6 text-center">
              <p className="text-sm font-medium text-ink">Nothing matched “{term}”</p>
              <p className="mt-1 text-xs text-ink/50">Try a shorter word, or browse a category below.</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {menu.slice(0, 5).map((m) => (
                  <button key={m.id} onClick={() => go(m.url)} className="chip">
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {products.length > 0 && (
            <section>
              <h3 className="search-head">Products</h3>
              <ul>
                {products.map((p) => {
                  const i = nextIdx();
                  const off = discountPct(p);
                  return (
                    <li key={p.id}>
                      <button className={`w-full text-left ${rowClass(i)}`} onClick={() => go(`/product/${p.slug}`, term)}>
                        <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-black/5">
                          {p.images?.[0]?.url && (
                            <Image src={p.images[0].url} alt="" fill sizes="44px" className="object-cover" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-ink">{p.title}</span>
                          <span className="block truncate text-[11px] text-ink/45">
                            {p.category?.name ?? p.brand ?? 'Product'}
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="block text-sm font-semibold text-ink">{formatPKR(effectivePrice(p))}</span>
                          {off && <span className="block text-[11px] font-medium text-sale">-{off}%</span>}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {categories.length > 0 && (
            <section>
              <h3 className="search-head">Categories</h3>
              <ul>
                {categories.map((c) => {
                  const i = nextIdx();
                  return (
                    <li key={c.id}>
                      <button
                        className={`w-full text-left ${rowClass(i)}`}
                        onClick={() => go(`/category/${c.slug}`, term)}
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                          <Tag size={15} />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{c.name}</span>
                        <span className="shrink-0 text-[11px] text-ink/45">
                          {c.productCount} {c.productCount === 1 ? 'product' : 'products'}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {(products.length > 0 || categories.length > 0) &&
            (() => {
              const i = nextIdx();
              return (
                <button
                  onClick={() => go(`/search?q=${encodeURIComponent(term)}`, term)}
                  className={`group flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2.5 text-sm font-semibold text-accent ${
                    i === cursor ? 'bg-accent/10' : 'hover:bg-accent/[0.06]'
                  }`}
                >
                  See all results for “{term}”
                  <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
                </button>
              );
            })()}
        </>
      ) : (
        <>
          {recent.length > 0 && (
            <section>
              <div className="flex items-center justify-between">
                <h3 className="search-head">Recent searches</h3>
                <button onClick={clearRecent} className="pr-2.5 text-[11px] text-ink/40 hover:text-accent">
                  Clear
                </button>
              </div>
              <ul>
                {recent.map((r) => {
                  const i = nextIdx();
                  return (
                    <li key={r}>
                      <button
                        className={`w-full text-left ${rowClass(i)}`}
                        onClick={() => go(`/search?q=${encodeURIComponent(r)}`, r)}
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-black/[0.04] text-ink/50">
                          <Clock size={14} />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm text-ink/80">{r}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {menu.length > 0 && (
            <section>
              <h3 className="search-head">Browse</h3>
              <div className="flex flex-wrap gap-2 px-2.5">
                {menu.map((m) => {
                  const i = nextIdx();
                  return (
                    <button
                      key={m.id}
                      onClick={() => go(m.url)}
                      className={`chip ${i === cursor ? 'border-accent text-accent' : ''}`}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {popular.length > 0 && (
            <section>
              <h3 className="search-head">
                <TrendingUp size={12} className="mr-1 inline-block text-accent" />
                Popular right now
              </h3>
              <ul>
                {popular.map((p) => {
                  const i = nextIdx();
                  return (
                    <li key={p.id}>
                      <button className={`w-full text-left ${rowClass(i)}`} onClick={() => go(`/product/${p.slug}`)}>
                        <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-black/5">
                          {p.images?.[0]?.url && (
                            <Image src={p.images[0].url} alt="" fill sizes="44px" className="object-cover" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-ink">{p.title}</span>
                          <span className="block truncate text-[11px] text-ink/45">
                            {p.category?.name ?? p.brand ?? 'Product'}
                          </span>
                        </span>
                        <span className="shrink-0 text-sm font-semibold text-ink">{formatPKR(effectivePrice(p))}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );

  const field = (
    <form onSubmit={submit} className="relative flex-1">
      <Search
        size={16}
        className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${
          open ? 'text-accent' : 'text-ink/40'
        }`}
      />
      <input
        ref={inputRef}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setCursor(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Search products, categories…"
        aria-label="Search"
        autoComplete="off"
        className={`w-full rounded-full border bg-white py-2 pl-9 pr-8 text-sm outline-none transition-colors ${
          open ? 'border-accent' : 'border-ink/15 hover:border-ink/25'
        }`}
      />
      {q && (
        <button
          type="button"
          onClick={() => {
            setQ('');
            inputRef.current?.focus();
          }}
          aria-label="Clear search"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-ink/40 hover:bg-black/5 hover:text-ink"
        >
          <X size={14} />
        </button>
      )}
    </form>
  );

  if (variant === 'sheet') {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-2 border-b border-black/5 px-4 py-3">
          {field}
          <button onClick={onClose} aria-label="Close search" className="rounded-full p-2 text-ink/50 hover:bg-black/5">
            <X size={20} />
          </button>
        </div>
        <div className="app-scroll flex-1 px-2 py-3">{panel}</div>
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="relative flex w-56 items-center xl:w-72">
      {field}
      {open && (
        <div className="menu-pop absolute left-1/2 top-full z-50 mt-2 w-[26rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-[0_20px_60px_-20px_rgba(0,0,0,0.35)]">
          <div className="app-scroll max-h-[min(70dvh,32rem)] px-2 py-3">{panel}</div>
        </div>
      )}
    </div>
  );
}
