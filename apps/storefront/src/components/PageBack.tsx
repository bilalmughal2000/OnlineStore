'use client';

import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

// Back control shown on every inner page (hidden on the homepage). Uses
// router.back() so the previous page's state & scroll position are restored.
export function PageBack() {
  const pathname = usePathname();
  const router = useRouter();

  if (pathname === '/') return null;

  return (
    <div className="container-x pt-4">
      <button
        type="button"
        onClick={() => router.back()}
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-ink/60 transition hover:bg-black/5 hover:text-accent"
      >
        <ArrowLeft size={16} /> Back
      </button>
    </div>
  );
}
