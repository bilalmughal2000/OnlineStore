'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Heart, Menu, Search, ShoppingBag, User, X } from 'lucide-react';
import { SearchBox } from '@/components/SearchBox';
import { useStore } from '@/providers/StoreProvider';
import { clientApi } from '@/lib/client-api';
import { CategoryNav, MobileCategoryNav } from '@/components/CategoryNav';
import type { MenuNode } from '@/lib/types';

export function Header({ menu, storeName, promoText }: { menu: MenuNode[]; storeName: string; promoText?: string }) {
  const { cartCount, user, wishlist } = useStore();
  const [open, setOpen] = useState(false);
  // Phones get a full-screen search sheet instead of a dropdown under a tiny input.
  const [searchOpen, setSearchOpen] = useState(false);
  // The drawer is portalled to <body>: this header uses backdrop-blur, and a
  // backdrop-filter makes an element the containing block for its fixed-position
  // descendants — inside it, the full-screen drawer collapsed to the header's
  // own 64px box.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // Refresh the promo text fresh on the client so admin edits show immediately,
  // regardless of page (ISR/CDN) caching. Starts from the SSR value.
  const [promo, setPromo] = useState<string | undefined>(promoText);
  useEffect(() => {
    clientApi
      .get<{ settings: { store?: { promoText?: string } } }>(`/content/settings?_=${Date.now()}`)
      .then((d) => setPromo(d.settings?.store?.promoText ?? ''))
      .catch(() => {});
  }, []);

  return (
    <header className="sticky top-0 z-40 shrink-0 border-b border-black/5 bg-cream/95 backdrop-blur lg:relative">
      {promo && <div className="bg-ink py-2 text-center text-xs text-white">{promo}</div>}
      <div className="container-x flex h-16 items-center justify-between gap-4">
        <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="Menu">
          <Menu />
        </button>

        <Link href="/" className="font-serif text-2xl font-bold tracking-tight">
          {storeName}
        </Link>

        <CategoryNav menu={menu} />

        <div className="flex items-center gap-3">
          <div className="hidden md:flex">
            <SearchBox menu={menu} />
          </div>
          <button
            onClick={() => setSearchOpen(true)}
            aria-label="Search"
            className="hover:text-accent md:hidden"
          >
            <Search />
          </button>
          {/* Always visible: the wishlist works without an account, so it needs
              a way in that isn't behind the account area. */}
          <Link href="/wishlist" aria-label="Wishlist" className="relative hover:text-accent">
            <Heart />
            {wishlist.size > 0 && (
              <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold text-white">
                {wishlist.size}
              </span>
            )}
          </Link>
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

      {/* Mobile search sheet */}
      {searchOpen && mounted && createPortal(
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSearchOpen(false)} />
          <div className="sheet-down absolute inset-x-0 top-0 max-h-[92dvh] bg-cream shadow-xl">
            <SearchBox menu={menu} variant="sheet" onClose={() => setSearchOpen(false)} />
          </div>
        </div>,
        document.body,
      )}

      {/* Mobile drawer */}
      {open && mounted && createPortal(
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          {/* Scrolls, because an expanded category tree can be taller than the screen. */}
          <div className="app-scroll absolute left-0 top-0 h-full w-72 bg-cream p-5">
            <div className="mb-6 flex items-center justify-between">
              <span className="font-serif text-xl font-bold">{storeName}</span>
              <button onClick={() => setOpen(false)} aria-label="Close">
                <X />
              </button>
            </div>
            <button
              onClick={() => {
                setOpen(false);
                setSearchOpen(true);
              }}
              className="mb-4 flex w-full items-center gap-2 rounded-full border border-ink/15 bg-white px-3.5 py-2.5 text-sm text-ink/45"
            >
              <Search size={16} />
              Search products…
            </button>
            <MobileCategoryNav menu={menu} onNavigate={() => setOpen(false)} />
          </div>
        </div>,
        document.body,
      )}
    </header>
  );
}
