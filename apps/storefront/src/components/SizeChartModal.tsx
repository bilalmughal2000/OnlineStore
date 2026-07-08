'use client';

import Image from 'next/image';
import { X } from 'lucide-react';

interface SizeChart {
  image?: string | null;
  table?: { headers: string[]; rows: string[][] } | null;
}

export function SizeChartModal({ chart, onClose }: { chart: SizeChart; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 max-h-[85vh] w-full max-w-lg overflow-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-serif text-xl font-bold">Size Chart</h3>
          <button onClick={onClose} aria-label="Close" className="text-ink/50 hover:text-ink">
            <X />
          </button>
        </div>

        {chart.table && chart.table.rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-ink text-white">
                  {chart.table.headers.map((h, i) => (
                    <th key={i} className="border border-black/10 px-3 py-2 text-left font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {chart.table.rows.map((row, ri) => (
                  <tr key={ri} className={ri % 2 ? 'bg-black/5' : ''}>
                    {row.map((cell, ci) => (
                      <td key={ci} className="border border-black/10 px-3 py-2">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-ink/50">Measurements in inches. Fit may vary slightly by style.</p>
          </div>
        )}

        {chart.image && (
          <div className="relative mt-4 h-[50vh] w-full">
            <Image src={chart.image} alt="Size chart" fill className="object-contain" />
          </div>
        )}

        {!chart.table && !chart.image && (
          <p className="text-sm text-ink/60">Size chart not available for this product.</p>
        )}
      </div>
    </div>
  );
}
