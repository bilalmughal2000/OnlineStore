'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Menu, Search, ShoppingBag, User, X } from 'lucide-react';
import { useStore } from '@/providers/StoreProvider';
import { clientApi } from '@/lib/client-api';

interface MenuLink {
  id: string;
  label: string;
  url: string;
}

export function Header({ menu, storeName, promoText }: { menu: MenuLink[]; storeName: string; promoText?: string }) {
  const { cartCount, user } = useStore();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  // Refresh the promo text fresh on the client so admin edits show immediately,
  // regardless of page (ISR/CDN) caching. Starts from the SSR value.
  const [promo, setPromo] = useState<string | undefined>(promoText);
  useEffect(() => {
    clientApi
      .get<{ settings: { store?: { promoText?: string } } }>(`/content/settings?_=${Date.now()}`)
      .then((d) => setPromo(d.settings?.store?.promoText ?? ''))
      .catch(() => {});
  }, []);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
  };

  return (
    <header className="z-40 shrink-0 border-b border-black/5 bg-cream/95 backdrop-blur">
      {promo && <div className="bg-ink py-2 text-center text-xs text-white">{promo}</div>}
      <div className="container-x flex h-16 items-center justify-between gap-4">
        <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="Menu">
          <Menu />
        </button>

        <Link href="/" className="font-serif text-2xl font-bold tracking-tight">
          {storeName}
        </Link>

        <nav className="hidden items-center gap-6 lg:flex">
          {menu.map((m) => (
            <Link key={m.id} href={m.url} className="text-sm font-medium hover:text-accent">
              {m.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <form onSubmit={submitSearch} className="hidden items-center md:flex">
            <div className="relative">
              <Search size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink/40" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search products..."
                className="w-48 rounded-full border border-ink/15 bg-white py-2 pl-8 pr-3 text-sm outline-none focus:border-accent"
              />
            </div>
          </form>
          <Link href={user ? '/account' : '/login'} aria-label="Account" className="hover:text-accent">
            <User />
          </Link>
          <Link href="/cart" aria-label="Cart" className="relative hover:text-accent">
            <ShoppingBag />
            {cartCount > 0 && (
              <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold text-white">
                {cartCount}
              </span>
            )}
          </Link>
        </div>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72 bg-cream p-5">
            <div className="mb-6 flex items-center justify-between">
              <span className="font-serif text-xl font-bold">{storeName}</span>
              <button onClick={() => setOpen(false)} aria-label="Close">
                <X />
              </button>
            </div>
            <form onSubmit={submitSearch} className="mb-4">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search..."
                className="input"
              />
            </form>
            <nav className="flex flex-col gap-1">
              {menu.map((m) => (
                <Link
                  key={m.id}
                  href={m.url}
                  onClick={() => setOpen(false)}
                  className="rounded px-2 py-2.5 font-medium hover:bg-black/5"
                >
                  {m.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
