import type { Metadata, Viewport } from 'next';
import './globals.css';
import { StoreProvider } from '@/providers/StoreProvider';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { PageBack } from '@/components/PageBack';
import { api } from '@/lib/api';
import { Analytics } from '@/components/Analytics';
import { Announcements } from '@/components/Announcements';
import { WhatsAppButton } from '@/components/WhatsAppButton';
import { SITE_URL } from '@/lib/site';
import { THEMES, DEFAULT_THEME, type SocialSettings, type ThemePalette } from '@store/shared-types';

const TITLE = 'Aabroo — Modern Pakistani Fashion';
const DESCRIPTION =
  'Shop modern Pakistani clothing online. Cash on Delivery, JazzCash, EasyPaisa & Stripe.';

export const metadata: Metadata = {
  // metadataBase makes every relative canonical/OG URL resolve to the real
  // domain. Without it Next emits relative OG images, which social crawlers
  // and Google Merchant reject.
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: '%s · Aabroo' },
  description: DESCRIPTION,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: 'Aabroo',
    title: TITLE,
    description: DESCRIPTION,
    locale: 'en_PK',
    url: '/',
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
  robots: { index: true, follow: true },
  // Lets Android/iOS offer "add to home screen" and dress the launched window
  // like an app rather than a browser tab (see app/manifest.ts).
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Aabroo' },
  // Meta requires a verified domain before you can configure Aggregated Event
  // Measurement (which is what keeps Purchase reporting working for iOS
  // traffic). Renders <meta name="facebook-domain-verify"> only when set.
  ...(process.env.NEXT_PUBLIC_META_DOMAIN_VERIFICATION
    ? { other: { 'facebook-domain-verify': process.env.NEXT_PUBLIC_META_DOMAIN_VERIFICATION } }
    : {}),
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
    const [{ header, footer }, { settings }, { announcements }] = await Promise.all([
      api.menu(),
      api.settings(),
      // Best-effort: an announcement failing to load must not take the shell with it.
      api.announcements().catch(() => ({ announcements: [] })),
    ]);
    return {
      header,
      footer,
      announcements,
      storeName: (settings?.store?.name as string) ?? 'Aabroo',
      promoText: (settings?.store?.promoText as string) ?? '',
      themeKey: (settings?.store?.theme as string) ?? DEFAULT_THEME,
      customTheme: settings?.store?.customTheme as ThemePalette | undefined,
      whatsapp: (settings?.whatsapp ?? {}) as { enabled?: boolean; phone?: string; greeting?: string },
      // Social links are admin-managed and render in the footer, so they travel
      // with the rest of the shell data.
      social: (settings?.social ?? {}) as SocialSettings,
    };
  } catch {
    return {
      header: [],
      footer: [],
      announcements: [],
      storeName: 'Aabroo',
      promoText: '',
      themeKey: DEFAULT_THEME,
      customTheme: undefined,
      whatsapp: {},
      social: {},
    };
  }
}

function themeVars(key: string, custom?: ThemePalette): React.CSSProperties {
  // Use the admin's custom palette when selected, else a preset.
  const c = key === 'custom' && custom?.accent ? custom : (THEMES[key] ?? THEMES[DEFAULT_THEME]).colors;
  return {
    '--ink': c.ink,
    '--cream': c.cream,
    '--accent': c.accent,
    '--accent-dark': c.accentDark,
    '--accent-light': c.accentLight,
    '--sale': c.sale,
  } as React.CSSProperties;
}

// Organization + WebSite structured data. The SearchAction enables Google's
// sitelinks search box, and Organization is what populates a brand knowledge panel.
function siteJsonLd(storeName: string) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: storeName,
        url: SITE_URL,
        areaServed: 'PK',
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: SITE_URL,
        name: storeName,
        publisher: { '@id': `${SITE_URL}/#organization` },
        inLanguage: 'en-PK',
        potentialAction: {
          '@type': 'SearchAction',
          target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/search?q={search_term_string}` },
          'query-input': 'required name=search_term_string',
        },
      },
    ],
  };
}

/*
 * `viewport` is separate from `metadata` in Next 14. themeColor tints the phone's
 * browser chrome, and interactiveWidget stops the layout being resized (and the
 * fixed header jumping) every time the on-screen keyboard opens.
 */
export const viewport: Viewport = {
  themeColor: '#1c1917',
  width: 'device-width',
  initialScale: 1,
  interactiveWidget: 'resizes-content',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { header, footer, announcements, storeName, promoText, themeKey, customTheme, whatsapp, social } =
    await getShell();
  return (
    <html lang="en" style={themeVars(themeKey, customTheme)}>
      <head>
        {/* Warm up the connection to the image CDN (LCP hero image lives here). */}
        <link rel="preconnect" href="https://picsum.photos" crossOrigin="" />
        <link rel="preconnect" href="https://res.cloudinary.com" crossOrigin="" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd(storeName)) }}
        />
      </head>
      {/* Desktop keeps the app-shell feel — sticky header, one scrolling region
          below it. Mobile scrolls the document itself (see .app-main). The footer
          scrolls with the content in both: it carries real navigation now, and a
          pinned one would sit on a third of a laptop screen forever. */}
      <body className="flex min-h-dvh flex-col lg:h-dvh lg:overflow-hidden">
        <StoreProvider>
          <Header menu={header} storeName={storeName} promoText={promoText} />
          {/* Event sales / notices: a dismissible ribbon plus a once-only modal. */}
          <Announcements announcements={announcements} />
          <main className="app-main flex flex-1 flex-col">
            <div className="flex-1">
              <PageBack />
              {children}
            </div>
            <Footer links={footer} categories={header} storeName={storeName} social={social} />
          </main>
        </StoreProvider>
        {/* Free click-to-chat — no API, no approval. Hidden until a number
            is set in admin so it can never link somewhere dead. */}
        {whatsapp?.enabled && whatsapp?.phone && (
          <WhatsAppButton phone={whatsapp.phone} greeting={whatsapp.greeting} storeName={storeName} />
        )}
        <Analytics />
      </body>
    </html>
  );
}
