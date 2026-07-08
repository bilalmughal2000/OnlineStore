import type { Metadata } from 'next';
import './globals.css';
import { StoreProvider } from '@/providers/StoreProvider';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { api } from '@/lib/api';

export const metadata: Metadata = {
  title: { default: 'Aabroo — Modern Pakistani Fashion', template: '%s · Aabroo' },
  description: 'Shop modern Pakistani clothing online. Cash on Delivery, JazzCash, EasyPaisa & Stripe.',
};

async function getShell() {
  try {
    const [{ header, footer }, { settings }] = await Promise.all([api.menu(), api.settings()]);
    return {
      header,
      footer,
      storeName: (settings?.store?.name as string) ?? 'Aabroo',
    };
  } catch {
    return { header: [], footer: [], storeName: 'Aabroo' };
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { header, footer, storeName } = await getShell();
  return (
    <html lang="en">
      <body>
        <StoreProvider>
          <Header menu={header} storeName={storeName} />
          <main className="min-h-[60vh]">{children}</main>
          <Footer links={footer} storeName={storeName} />
        </StoreProvider>
      </body>
    </html>
  );
}
