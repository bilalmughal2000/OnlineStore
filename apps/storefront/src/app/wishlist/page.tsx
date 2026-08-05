'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ShoppingBag, Trash2 } from 'lucide-react';
import { useStore } from '@/providers/StoreProvider';
import { clientApi, ApiError } from '@/lib/client-api';
import { formatPKR, effectivePrice } from '@/lib/format';
import { readGuestWishlist } from '@/lib/guest-wishlist';

export default function WishlistPage() {
  const { user, loading, toggleWishlist, addToCart, showToast } = useStore();
  const [items, setItems] = useState<any[]>([]);
  const [ready, setReady] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);

  // Two sources depending on who's asking: the account's saved rows, or — for a
  // guest — the ids held in this browser, resolved against the catalogue.
  const load = useCallback(async () => {
    if (user) {
      const d = await clientApi.get<{ items: any[] }>('/account/wishlist');
      setItems(d.items);
    } else {
      const ids = readGuestWishlist();
      if (ids.length === 0) {
        setItems([]);
      } else {
        const d = await clientApi.get<{ items: any[] }>(
          `/products?ids=${encodeURIComponent(ids.join(','))}&pageSize=60`,
        );
        // Shape it like the account response so one renderer serves both.
        setItems(d.items.map((product) => ({ id: product.id, productId: product.id, product })));
      }
    }
    setReady(true);
  }, [user]);

  useEffect(() => {
    if (!loading) load();
  }, [loading, load]);

  if (loading || !ready) return <div className="container-x py-20 text-center">Loading…</div>;

  const remove = async (productId: string) => {
    // Routes to localStorage or the API depending on sign-in state.
    await toggleWishlist(productId);
    load();
  };

  const quickAdd = async (product: any) => {
    const available = (product.variants ?? []).find((v: any) => v.stock > 0);
    if (!available) return;
    setAddingId(product.id);
    try {
      // Leaves the item in the wishlist — saving and buying are separate
      // intentions, and silently removing it would surprise people.
      await addToCart(available.id, 1);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not add to cart');
    } finally {
      setAddingId(null);
    }
  };

  return (
    <div className="container-x py-8">
      <h1 className="mb-2 font-serif text-3xl font-bold">Wishlist</h1>
      {/* Saved locally for guests — say so, so nobody assumes it follows them. */}
      {!user && (
        <p className="mb-6 text-sm text-ink/60">
          Saved on this device.{' '}
          <Link href="/login" className="font-medium text-accent hover:underline">
            Log in
          </Link>{' '}
          to keep your wishlist across devices.
        </p>
      )}
      {items.length === 0 ? (
        <p className="py-16 text-center text-ink/60">No saved items yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
          {items.map((w) => (
            <div key={w.id} className="card overflow-hidden">
              <Link href={`/product/${w.product.slug}`} className="relative block aspect-[4/5] bg-black/5">
                {w.product.images[0] && <Image src={w.product.images[0].url} alt={w.product.title} fill sizes="25vw" className="object-cover" />}
              </Link>
              <div className="p-3">
                <p className="line-clamp-1 text-sm font-medium">{w.product.title}</p>
                <p className="text-sm font-semibold">{formatPKR(effectivePrice(w.product))}</p>
                {(() => {
                  // Quick-add takes the first variant with stock, matching the
                  // product card's behaviour. Anything needing a specific
                  // size/colour is a click away on the product page.
                  const available = (w.product.variants ?? []).find((v: any) => v.stock > 0);
                  return (
                    <button
                      onClick={() => quickAdd(w.product)}
                      disabled={!available || addingId === w.productId}
                      className="btn-primary mt-2 w-full justify-center text-xs"
                    >
                      <ShoppingBag size={14} />
                      {!available ? 'Sold Out' : addingId === w.productId ? 'Adding…' : 'Add to Cart'}
                    </button>
                  );
                })()}
                <button onClick={() => remove(w.productId)} className="btn-ghost mt-1 w-full text-xs text-sale">
                  <Trash2 size={14} /> Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
