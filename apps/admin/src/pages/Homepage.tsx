import { useState } from 'react';
import { Banners } from './Banners';
import { Sections } from './Sections';

// Combined "Homepage" management: hero banners + content sections, under one nav item.
export function Homepage() {
  const [tab, setTab] = useState<'banners' | 'sections'>('banners');

  return (
    <div>
      <h1 className="mb-4 font-serif text-2xl font-bold">Homepage</h1>
      <div className="mb-6 flex gap-4 border-b border-stone-200">
        {(['banners', 'sections'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 pb-2 text-sm font-medium capitalize transition ${
              tab === t ? 'border-brand text-brand' : 'border-transparent text-stone-500 hover:text-stone-700'
            }`}
          >
            {t === 'banners' ? 'Hero Banners' : 'Sections'}
          </button>
        ))}
      </div>
      {tab === 'banners' ? <Banners /> : <Sections />}
    </div>
  );
}
