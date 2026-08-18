'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

/*
 * One footer link group.
 *
 * Desktop shows the heading with its list open — a normal footer column. On
 * phones the list starts collapsed behind a tappable heading, because three
 * stacked lists of links turn the footer into several screens of scrolling.
 */
export function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-white/[0.06] pb-2 md:border-0 md:pb-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between py-2 text-left md:pointer-events-none md:py-0"
      >
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-cream/35">{title}</span>
        <ChevronDown
          size={15}
          className={`text-cream/35 transition-transform duration-200 md:hidden ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <ul className={`space-y-1.5 pb-1 md:mt-2 md:block md:pb-0 ${open ? 'mt-1 block' : 'hidden'}`}>{children}</ul>
    </div>
  );
}
