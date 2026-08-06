import { useCallback, useEffect, useState } from 'react';
import { PlusCircle, PencilLine, Trash2, Search, X } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { Select } from '@/components/Select';

interface Log {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
  adminName: string;
  adminEmail: string;
  /** Null once that account has been deleted — the row itself survives. */
  adminId: string | null;
}

const ACTION_STYLE: Record<string, { icon: typeof PlusCircle; className: string }> = {
  create: { icon: PlusCircle, className: 'text-emerald-600 bg-emerald-50' },
  update: { icon: PencilLine, className: 'text-amber-600 bg-amber-50' },
  delete: { icon: Trash2, className: 'text-red-600 bg-red-50' },
};

const PAGE_SIZE = 50;

/**
 * Turn a date input's "YYYY-MM-DD" into an absolute instant.
 *
 * A bare date string is parsed as UTC midnight, but the person picking it means
 * midnight *where they are*. In Pakistan (UTC+5) that's a five-hour gap wide
 * enough that filtering by "today" hid actions taken minutes earlier, because
 * the server's clock was still on the previous UTC day. Sending a full ISO
 * instant computed from local time removes the ambiguity entirely.
 */
function dayBoundary(value: string, edge: 'start' | 'end'): string {
  const [y, m, d] = value.split('-').map(Number);
  const dt =
    edge === 'start'
      ? new Date(y, m - 1, d, 0, 0, 0, 0)
      : new Date(y, m - 1, d, 23, 59, 59, 999);
  return dt.toISOString();
}

/**
 * Who changed what, and when.
 *
 * Every successful write to /admin lands here automatically — see the auditLog
 * middleware on the API. Entries can't be edited, only aged out by date, and
 * the purge itself gets recorded.
 */
export function Activity() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const [purging, setPurging] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(
    (goToPage = page) => {
      setLoading(true);
      const q = new URLSearchParams({ page: String(goToPage), pageSize: String(PAGE_SIZE) });
      if (search.trim()) q.set('search', search.trim());
      if (action) q.set('action', action);
      if (from) q.set('from', dayBoundary(from, 'start'));
      if (to) q.set('to', dayBoundary(to, 'end'));
      return api
        .get<{ logs: Log[]; total: number }>(`/admin/activity?${q}`)
        .then((d) => {
          setLogs(d.logs);
          setTotal(d.total);
        })
        .finally(() => setLoading(false));
    },
    [page, search, action, from, to],
  );

  // Debounced so typing in the search box doesn't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      load(1);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, action, from, to]);

  useEffect(() => {
    load(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const filtered = Boolean(search || action || from || to);
  const clear = () => {
    setSearch('');
    setAction('');
    setFrom('');
    setTo('');
  };

  const purge = async () => {
    // Deleting by an open-ended "before" is the common case (retention);
    // a from/to pair removes a specific window.
    const params = new URLSearchParams();
    if (from) params.set('from', dayBoundary(from, 'start'));
    if (to) params.set('before', dayBoundary(to, 'end'));
    if (!params.toString()) {
      setNotice('Pick a date range first — choose a "To" date to delete everything up to it.');
      return;
    }
    const what = from ? `between ${from} and ${to || 'now'}` : `on or before ${to}`;
    if (!confirm(`Permanently delete all activity ${what}?\n\nThis cannot be undone.`)) return;
    setPurging(true);
    try {
      const r = await api.del<{ deleted: number }>(`/admin/activity?${params}`);
      setNotice(`Deleted ${r.deleted} ${r.deleted === 1 ? 'entry' : 'entries'}.`);
      setPage(1);
      await load(1);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not delete entries.');
    } finally {
      setPurging(false);
    }
  };

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="max-w-4xl">
      <h1 className="font-serif text-2xl font-bold">Activity Log</h1>
      <p className="mb-5 mt-1 text-sm text-stone-500">
        Every change made in the admin panel, newest first.
      </p>

      {/* Filters */}
      <div className="card mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-1">
            <label className="label">Search</label>
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                className="input pl-9"
                placeholder="Name, email, item…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="label">Action</label>
            <Select
              value={action}
              onChange={setAction}
              options={[
                { value: '', label: 'All actions' },
                { value: 'create', label: 'Created' },
                { value: 'update', label: 'Updated' },
                { value: 'delete', label: 'Deleted' },
              ]}
            />
          </div>
          <div>
            <label className="label">From</label>
            <input type="date" className="input" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="label">To</label>
            <input type="date" className="input" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-stone-500">
            {loading ? 'Loading…' : `${total} ${total === 1 ? 'entry' : 'entries'}${filtered ? ' match' : ''}`}
          </p>
          <div className="flex flex-wrap gap-2">
            {filtered && (
              <button onClick={clear} className="btn-outline text-xs">
                <X size={14} /> Clear filters
              </button>
            )}
            <button
              onClick={purge}
              disabled={purging || (!from && !to)}
              title={!from && !to ? 'Choose a date range to delete' : undefined}
              className="btn-danger text-xs"
            >
              <Trash2 size={14} /> {purging ? 'Deleting…' : 'Delete in range'}
            </button>
          </div>
        </div>

        {notice && <p className="mt-3 rounded bg-stone-100 p-2 text-xs text-stone-600">{notice}</p>}
      </div>

      {loading ? (
        <p className="text-sm text-stone-500">Loading…</p>
      ) : !logs.length ? (
        <div className="card p-8 text-center text-sm text-stone-500">
          {filtered ? 'No activity matches these filters.' : 'No activity recorded yet.'}
        </div>
      ) : (
        <div className="card divide-y divide-stone-100">
          {logs.map((log) => {
            const style = ACTION_STYLE[log.action] ?? { icon: PencilLine, className: 'text-stone-500 bg-stone-100' };
            const Icon = style.icon;
            return (
              <div key={log.id} className="flex items-start gap-3 p-4">
                <span className={`mt-0.5 shrink-0 rounded-md p-1.5 ${style.className}`}>
                  <Icon size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="font-medium" title={log.adminEmail}>
                      {log.adminName}
                    </span>
                    {!log.adminId && <span className="text-stone-400"> (account removed)</span>}{' '}
                    <span className="text-stone-500">{log.action}d</span>{' '}
                    <span className="font-medium">{log.entity}</span>
                  </p>
                  {log.entityId && (
                    <p className="truncate text-xs text-stone-400">{log.entityId}</p>
                  )}
                  {log.meta != null && (
                    // The recorded request body, credentials stripped. Collapsed
                    // because it's for the rare "what exactly changed?" moment.
                    <details className="mt-1">
                      <summary className="cursor-pointer text-xs text-stone-400 hover:text-stone-600">
                        Details
                      </summary>
                      <pre className="mt-1 overflow-x-auto rounded bg-stone-50 p-2 text-xs text-stone-600">
                        {JSON.stringify(log.meta, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
                <span className="shrink-0 whitespace-nowrap text-xs text-stone-400">{formatDate(log.createdAt)}</span>
              </div>
            );
          })}
        </div>
      )}

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between gap-3">
          <button onClick={() => setPage((p) => p - 1)} disabled={page <= 1} className="btn-outline text-xs">
            Previous
          </button>
          <span className="text-xs text-stone-500">
            Page {page} of {pages}
          </span>
          <button onClick={() => setPage((p) => p + 1)} disabled={page >= pages} className="btn-outline text-xs">
            Next
          </button>
        </div>
      )}
    </div>
  );
}
