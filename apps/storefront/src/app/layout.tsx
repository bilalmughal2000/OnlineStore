import type { Metadata } from 'next';
import './globals.css';
import { StoreProvider } from '@/providers/StoreProvider';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { PageBack } from '@/components/PageBack';
import { api } from '@/lib/api';
import { THEMES, DEFAULT_THEME } from '@store/shared-types';

export const metadata: Metadata = {
  title: { default: 'Aabroo — Modern Pakistani Fashion', template: '%s · Aabroo' },
  description: 'Shop modern Pakistani clothing online. Cash on Delivery, JazzCash, EasyPaisa & Stripe.',
  // Inline SVG favicon (emoji) — avoids a favicon.ico 404 console error.
  icons: {
    icon: [
      {
        url:
          'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🧵</text></svg>',
      },
    ],
  },
};

async function getShell() {
  try {
    const [{ header, footer }, { settings }] = await Promise.all([api.menu(), api.settings()]);
    return {
      header,
      footer,
      storeName: (settings?.store?.name as string) ?? 'Aabroo',
      themeKey: (settings?.store?.theme as string) ?? DEFAULT_THEME,
    };
  } catch {
    return { header: [], footer: [], storeName: 'Aabroo', themeKey: DEFAULT_THEME };
  }
}

function themeVars(key: string): React.CSSProperties {
  const c = (THEMES[key] ?? THEMES[DEFAULT_THEME]).colors;
  return {
    '--ink': c.ink,
    '--cream': c.cream,
    '--accent': c.accent,
    '--accent-dark': c.accentDark,
    '--accent-light': c.accentLight,
    '--sale': c.sale,
  } as React.CSSProperties;
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { header, footer, storeName, themeKey } = await getShell();
  return (
    <html lang="en" style={themeVars(themeKey)}>
      <head>
        {/* Warm up the connection to the image CDN (LCP hero image lives here). */}
        <link rel="preconnect" href="https://picsum.photos" crossOrigin="" />
        <link rel="preconnect" href="https://res.cloudinary.com" crossOrigin="" />
      </head>
      <body className="flex h-dvh flex-col overflow-hidden">
        <StoreProvider>
          <Header menu={header} storeName={storeName} />
          {/* Only this middle region scrolls; header + footer stay fixed. */}
          <main className="app-scroll flex-1">
            <PageBack />
            {children}
          </main>
          <Footer links={footer} storeName={storeName} />
        </StoreProvider>
      </body>
    </html>
  );
}
