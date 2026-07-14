import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';

// Called server-to-server by the admin API after a change, to purge cached
// storefront data immediately (e.g. theme, menu, banners, pages, catalog).
export async function POST(req: Request) {
  const secret = req.headers.get('x-revalidate-secret');
  if (secret !== (process.env.REVALIDATE_SECRET ?? 'dev-revalidate-secret')) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  revalidateTag('storefront');
  return NextResponse.json({ revalidated: true });
}
