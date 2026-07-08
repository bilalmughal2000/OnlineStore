import Link from 'next/link';

export function Pagination({
  page,
  totalPages,
  baseParams,
}: {
  page: number;
  totalPages: number;
  baseParams: Record<string, string>;
}) {
  if (totalPages <= 1) return null;
  const mk = (p: number) => {
    const params = new URLSearchParams(baseParams);
    params.set('page', String(p));
    return `?${params.toString()}`;
  };
  return (
    <div className="mt-10 flex items-center justify-center gap-2">
      {page > 1 && (
        <Link href={mk(page - 1)} className="btn-outline">
          Prev
        </Link>
      )}
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
        <Link
          key={p}
          href={mk(p)}
          className={`btn ${p === page ? 'bg-ink text-white' : 'btn-outline'}`}
        >
          {p}
        </Link>
      ))}
      {page < totalPages && (
        <Link href={mk(page + 1)} className="btn-outline">
          Next
        </Link>
      )}
    </div>
  );
}
