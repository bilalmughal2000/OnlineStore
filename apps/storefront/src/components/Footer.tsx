import Link from 'next/link';
import { ShieldCheck, Truck, RotateCcw, Banknote } from 'lucide-react';

interface MenuLink {
  id: string;
  label: string;
  url: string;
}

export function Footer({ links, storeName }: { links: MenuLink[]; storeName: string }) {
  return (
    <footer className="mt-16 border-t border-black/5 bg-white">
      <div className="container-x grid grid-cols-2 gap-6 py-10 md:grid-cols-4">
        {[
          { icon: ShieldCheck, t: 'Secure Payments', d: 'Stripe / JazzCash / EasyPaisa' },
          { icon: Banknote, t: 'Cash on Delivery', d: 'Pay when you receive' },
          { icon: Truck, t: 'Fast Delivery', d: 'Nationwide in 3-5 days' },
          { icon: RotateCcw, t: 'Easy Returns', d: '7-day return policy' },
        ].map(({ icon: Icon, t, d }) => (
          <div key={t} className="flex items-start gap-3">
            <Icon className="mt-0.5 shrink-0 text-accent" size={22} />
            <div>
              <p className="text-sm font-semibold">{t}</p>
              <p className="text-xs text-ink/60">{d}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-black/5">
        <div className="container-x flex flex-col items-center justify-between gap-4 py-6 md:flex-row">
          <div>
            <p className="font-serif text-lg font-bold">{storeName}</p>
            <p className="text-xs text-ink/50">© {new Date().getFullYear()} {storeName}. All rights reserved.</p>
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-2">
            {links.map((l) => (
              <Link key={l.id} href={l.url} className="text-sm text-ink/70 hover:text-accent">
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
