'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Trash2 } from 'lucide-react';
import { useStore } from '@/providers/StoreProvider';
import { clientApi } from '@/lib/client-api';
import { formatPKR, effectivePrice } from '@/lib/format';

export default function WishlistPage() {
  const { user, loading } = useStore();
  const [items, setItems] = useState<any[]>([]);
  const [ready, setReady] = useState(false);

  const load = () => clientApi.get<{ items: any[] }>('/account/wishlist').then((d) => { setItems(d.items); setReady(true); });

  useEffect(() => {
    if (user) load();
  }, [user]);

  if (loading) return <div className="container-x py-20 text-center">Loading…</div>;
  if (!user) return <div className="container-x py-20 text-center">Please <Link href="/login" className="text-accent">log in</Link>.</div>;
  if (!ready) return <div className="container-x py-20 text-center">Loading…</div>;

  const remove = async (productId: string) => {
    await clientApi.del(`/account/wishlist/${productId}`);
    load();
  };

  return (
    <div className="container-x py-8">
      <h1 className="mb-6 font-serif text-3xl font-bold">Wishlist</h1>
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
                <button onClick={() => remove(w.productId)} className="btn-ghost mt-2 w-full text-xs text-sale">
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
