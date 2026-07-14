'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Star, BadgeCheck } from 'lucide-react';
import type { Review } from '@/lib/types';
import { useStore } from '@/providers/StoreProvider';
import { clientApi, ApiError } from '@/lib/client-api';

function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex text-amber-500">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} size={size} fill={i < Math.round(value) ? 'currentColor' : 'none'} className={i < Math.round(value) ? '' : 'text-ink/25'} />
      ))}
    </span>
  );
}

function initials(name: string) {
  return name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}

export function ProductReviews({
  productId,
  initialReviews,
  ratingAvg,
  ratingCount,
}: {
  productId: string;
  initialReviews: Review[];
  ratingAvg: number;
  ratingCount: number;
}) {
  const { user, showToast } = useStore();
  const [reviews, setReviews] = useState<Review[]>(initialReviews);
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  const { avg, count, breakdown } = useMemo(() => {
    const count = reviews.length || ratingCount;
    const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : ratingAvg;
    const breakdown = [5, 4, 3, 2, 1].map((star) => ({
      star,
      n: reviews.filter((r) => r.rating === star).length,
    }));
    return { avg, count, breakdown };
  }, [reviews, ratingAvg, ratingCount]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { review } = await clientApi.post<{ review: Review }>(`/account/products/${productId}/reviews`, {
        rating,
        comment: comment.trim() || undefined,
        images: [],
      });
      // Optimistically show it (replace any existing review by the same user).
      setReviews((prev) => [
        { ...review, user: { name: user?.name ?? 'You' } },
        ...prev.filter((r) => r.id !== review.id),
      ]);
      setComment('');
      setOpen(false);
      showToast('Thanks for your review!');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not submit review');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-16 border-t border-black/10 pt-10">
      <h2 className="mb-6 font-serif text-2xl font-bold">Customer Reviews</h2>

      <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
        {/* Summary */}
        <div className="h-fit rounded-lg border border-black/5 bg-white p-5">
          <div className="text-center">
            <p className="font-serif text-5xl font-bold">{avg.toFixed(1)}</p>
            <div className="mt-1 flex justify-center">
              <Stars value={avg} size={18} />
            </div>
            <p className="mt-1 text-sm text-ink/50">{count} review{count === 1 ? '' : 's'}</p>
          </div>
          <div className="mt-5 space-y-1.5">
            {breakdown.map(({ star, n }) => (
              <div key={star} className="flex items-center gap-2 text-xs">
                <span className="w-3 text-ink/60">{star}</span>
                <Star size={12} className="text-amber-500" fill="currentColor" />
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/10">
                  <div className="h-full bg-amber-500" style={{ width: `${count ? (n / count) * 100 : 0}%` }} />
                </div>
                <span className="w-4 text-right text-ink/50">{n}</span>
              </div>
            ))}
          </div>
          {user ? (
            <button onClick={() => setOpen((o) => !o)} className="btn-primary mt-5 w-full">
              {open ? 'Cancel' : 'Write a Review'}
            </button>
          ) : (
            <Link href="/login" className="btn-outline mt-5 w-full">
              Log in to review
            </Link>
          )}
        </div>

        {/* List + form */}
        <div>
          {open && user && (
            <form onSubmit={submit} className="mb-6 rounded-lg border border-accent/30 bg-accent/5 p-5">
              <p className="label">Your rating</p>
              <div className="mb-3 flex gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onMouseEnter={() => setHover(i + 1)}
                    onMouseLeave={() => setHover(0)}
                    onClick={() => setRating(i + 1)}
                    aria-label={`${i + 1} star`}
                  >
                    <Star
                      size={26}
                      className="text-amber-500"
                      fill={i < (hover || rating) ? 'currentColor' : 'none'}
                    />
                  </button>
                ))}
              </div>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share your experience with this product…"
                className="input h-24 resize-none"
              />
              <button disabled={busy} className="btn-primary mt-3">
                {busy ? 'Submitting…' : 'Submit Review'}
              </button>
            </form>
          )}

          {reviews.length === 0 ? (
            <p className="py-10 text-center text-ink/50">No reviews yet — be the first to review this product.</p>
          ) : (
            <div className="space-y-5">
              {reviews.map((r) => (
                <div key={r.id} className="flex gap-4 border-b border-black/5 pb-5 last:border-0">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent/10 text-sm font-semibold text-accent">
                    {initials(r.user?.name ?? 'A')}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{r.user?.name ?? 'Anonymous'}</p>
                      {r.verified && (
                        <span className="inline-flex items-center gap-0.5 text-xs text-green-700">
                          <BadgeCheck size={13} /> Verified Buyer
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2">
                      <Stars value={r.rating} />
                      <span className="text-xs text-ink/40">
                        {new Date(r.createdAt).toLocaleDateString('en-PK', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    {r.comment && <p className="mt-2 text-sm text-ink/80">{r.comment}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
