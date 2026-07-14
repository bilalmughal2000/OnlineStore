// Tells the Next.js storefront to purge its cached data immediately after an
// admin change (theme, menu, banners, pages, catalog, etc.). Fire-and-forget.
export function pingStorefrontRevalidate(): void {
  const url = process.env.STOREFRONT_URL ?? 'http://localhost:3000';
  const secret = process.env.REVALIDATE_SECRET ?? 'dev-revalidate-secret';
  fetch(`${url}/api/revalidate`, {
    method: 'POST',
    headers: { 'x-revalidate-secret': secret },
  }).catch(() => {
    /* storefront may be down / unreachable — ignore */
  });
}
