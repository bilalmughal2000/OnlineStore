import { useEffect, useState } from 'react';
import { Check, Trash2, Star } from 'lucide-react';
import { api } from '@/lib/api';

export function Reviews() {
  const [reviews, setReviews] = useState<any[]>([]);
  const [pendingOnly, setPendingOnly] = useState(true);

  const load = () => api.get<{ reviews: any[] }>(`/admin/reviews${pendingOnly ? '?pending=true' : ''}`).then((d) => setReviews(d.reviews));
  useEffect(() => { load(); }, [pendingOnly]);

  const approve = async (id: string) => { await api.patch(`/admin/reviews/${id}`, { isApproved: true }); load(); };
  const remove = async (id: string) => { await api.del(`/admin/reviews/${id}`); load(); };

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-serif text-2xl font-bold">Reviews</h1>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={pendingOnly} onChange={(e) => setPendingOnly(e.target.checked)} /> Pending only
        </label>
      </div>

      <div className="space-y-3">
        {reviews.map((r) => (
          <div key={r.id} className="card p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-1 text-amber-500">
                  {Array.from({ length: 5 }).map((_, i) => <Star key={i} size={14} fill={i < r.rating ? 'currentColor' : 'none'} />)}
                </div>
                <p className="mt-1 text-sm">{r.comment}</p>
                <p className="mt-1 text-xs text-stone-500">{r.user?.name} on <span className="font-medium">{r.product?.title}</span></p>
              </div>
              <div className="flex gap-2">
                {!r.isApproved && <button onClick={() => approve(r.id)} className="btn-outline text-xs text-green-700"><Check size={14} /> Approve</button>}
                <button onClick={() => remove(r.id)} className="text-stone-400 hover:text-red-600"><Trash2 size={16} /></button>
              </div>
            </div>
          </div>
        ))}
        {reviews.length === 0 && <p className="py-10 text-center text-stone-500">No reviews.</p>}
      </div>
    </div>
  );
}
