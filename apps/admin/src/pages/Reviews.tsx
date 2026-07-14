import { useEffect, useState } from 'react';
import { Eye, EyeOff, Trash2, Star } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { Select } from '@/components/Select';

export function Reviews() {
  const [reviews, setReviews] = useState<any[]>([]);
  const [filter, setFilter] = useState('');

  const load = () =>
    api.get<{ reviews: any[] }>(`/admin/reviews${filter ? `?filter=${filter}` : ''}`).then((d) => setReviews(d.reviews));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  // Hide = remove from storefront (isApproved false); Show = make visible again.
  const setVisible = async (id: string, isApproved: boolean) => {
    await api.patch(`/admin/reviews/${id}`, { isApproved });
    load();
  };
  const remove = async (id: string) => {
    if (!confirm('Delete this review permanently?')) return;
    await api.del(`/admin/reviews/${id}`);
    load();
  };

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="font-serif text-2xl font-bold">Reviews</h1>
        <Select
          className="w-44"
          value={filter}
          onChange={setFilter}
          options={[
            { value: '', label: 'All reviews' },
            { value: 'visible', label: 'Visible' },
            { value: 'hidden', label: 'Hidden' },
          ]}
        />
      </div>

      <div className="space-y-3">
        {reviews.map((r) => (
          <div key={r.id} className="card p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-0.5 text-amber-500">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} size={14} fill={i < r.rating ? 'currentColor' : 'none'} />
                    ))}
                  </div>
                  <span className={`badge ${r.isApproved ? 'bg-green-100 text-green-700' : 'bg-stone-200 text-stone-600'}`}>
                    {r.isApproved ? 'Visible' : 'Hidden'}
                  </span>
                </div>
                {r.comment && <p className="mt-1.5 text-sm">{r.comment}</p>}
                <p className="mt-1 text-xs text-stone-500">
                  {r.user?.name} on <span className="font-medium">{r.product?.title}</span> · {formatDate(r.createdAt)}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                {r.isApproved ? (
                  <button onClick={() => setVisible(r.id, false)} className="btn-outline text-xs" title="Hide from storefront">
                    <EyeOff size={14} /> Hide
                  </button>
                ) : (
                  <button onClick={() => setVisible(r.id, true)} className="btn-outline text-xs text-green-700" title="Show on storefront">
                    <Eye size={14} /> Show
                  </button>
                )}
                <button onClick={() => remove(r.id)} className="text-stone-400 hover:text-red-600" title="Delete">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
        {reviews.length === 0 && <p className="py-10 text-center text-stone-500">No reviews.</p>}
      </div>
    </div>
  );
}
