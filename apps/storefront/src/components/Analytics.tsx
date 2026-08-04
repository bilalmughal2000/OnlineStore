'use client';

import Script from 'next/script';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef } from 'react';
import { captureAdClick, GA_ID, META_PIXEL_ID, trackPageView } from '@/lib/analytics';

// Fires a page_view on every client-side route change. The App Router navigates
// without a document load, so both SDKs would otherwise only ever report the
// first page of a session — making every product page look like zero traffic.
//
// Also records the fbclid of the landing page. That runs even with no tags
// configured, because the server-side Conversions API depends on it and it must
// not silently stop working the moment the Pixel is absent or blocked.
function RouteChangeTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // The SDK snippets already send the initial page_view on load; skip the first
  // effect run so it isn't double-counted.
  const isFirstRun = useRef(true);

  useEffect(() => {
    captureAdClick();
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    const qs = searchParams?.toString();
    trackPageView(pathname + (qs ? `?${qs}` : ''));
  }, [pathname, searchParams]);

  return null;
}

export function Analytics() {
  return (
    <>
      {GA_ID && (
        <>
          {/* afterInteractive: keeps the tag off the critical path so it can't
              delay LCP, while still loading early enough to catch the session. */}
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              window.gtag = gtag;
              gtag('js', new Date());
              gtag('config', '${GA_ID}', { send_page_view: true });
            `}
          </Script>
        </>
      )}

      {META_PIXEL_ID && (
        <>
          <Script id="meta-pixel-init" strategy="afterInteractive">
            {`
              !function(f,b,e,v,n,t,s)
              {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)}(window,document,'script',
              'https://connect.facebook.net/en_US/fbevents.js');
              fbq('init', '${META_PIXEL_ID}');
              fbq('track', 'PageView');
            `}
          </Script>
          {/* <noscript> fallback so conversions from JS-disabled sessions still
              register. next/script can't emit this, hence the raw tag. */}
          <noscript>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              height="1"
              width="1"
              style={{ display: 'none' }}
              alt=""
              src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
            />
          </noscript>
        </>
      )}

      {/* useSearchParams() requires a Suspense boundary in the App Router. */}
      <Suspense fallback={null}>
        <RouteChangeTracker />
      </Suspense>
    </>
  );
}
