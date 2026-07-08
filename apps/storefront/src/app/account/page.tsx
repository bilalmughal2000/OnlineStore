'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Package, Heart, MapPin, LogOut, User } from 'lucide-react';
import { useStore } from '@/providers/StoreProvider';

export default function AccountPage() {
  const { user, loading, logout } = useStore();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/login?redirect=/account');
  }, [loading, user, router]);

  if (loading || !user) return <div className="container-x py-20 text-center">Loading…</div>;

  const tiles = [
    { href: '/account/orders', icon: Package, title: 'My Orders', desc: 'Track & view order history' },
    { href: '/account/wishlist', icon: Heart, title: 'Wishlist', desc: 'Saved items' },
    { href: '/account/addresses', icon: MapPin, title: 'Addresses', desc: 'Manage delivery addresses' },
    { href: '/account/profile', icon: User, title: 'Profile', desc: 'Name, phone & password' },
  ];

  return (
    <div className="container-x py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold">Hi, {user.name.split(' ')[0]}</h1>
          <p className="text-ink/60">{user.email}</p>
        </div>
        <button onClick={() => { logout(); router.push('/'); }} className="btn-outline">
          <LogOut size={16} /> Log out
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <Link key={t.href} href={t.href} className="card p-5 transition hover:border-accent/40 hover:shadow-md">
            <t.icon className="text-accent" />
            <p className="mt-3 font-semibold">{t.title}</p>
            <p className="text-sm text-ink/60">{t.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
