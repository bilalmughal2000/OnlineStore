import { useEffect, useState } from 'react';
import { PlusCircle, PencilLine, Trash2 } from 'lucide-react';
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

/**
 * Who changed what, and when.
 *
 * Every successful write to /admin lands here automatically — see the auditLog
 * middleware on the API. Read-only by design: an audit trail nobody can edit is
 * the only kind worth keeping.
 */
export function Activity() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState('');

  useEffect(() => {
    api
      .get<{ logs: Log[] }>('/admin/activity')
      .then((d) => setLogs(d.logs))
      .finally(() => setLoading(false));
  }, []);

  const shown = action ? logs.filter((l) => l.action === action) : logs;

  return (
    <div className="max-w-3xl">
      <div className="mb-2 flex items-center justify-between gap-4">
        <h1 className="font-serif text-2xl font-bold">Activity Log</h1>
        <Select
          className="w-44"
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
      <p className="mb-6 text-sm text-stone-500">
        Every change made in the admin panel, newest first. Showing the latest 100.
      </p>

      {loading ? (
        <p className="text-sm text-stone-500">Loading…</p>
      ) : !shown.length ? (
        <div className="card p-8 text-center text-sm text-stone-500">
          No activity recorded yet. Changes made from the admin panel will appear here.
        </div>
      ) : (
        <div className="card divide-y divide-stone-100">
          {shown.map((log) => {
            const style = ACTION_STYLE[log.action] ?? { icon: PencilLine, className: 'text-stone-500 bg-stone-100' };
            const Icon = style.icon;
            return (
              <div key={log.id} className="flex items-start gap-3 p-4">
                <span className={`mt-0.5 rounded-md p-1.5 ${style.className}`}>
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
                    {log.entityId && <span className="text-stone-400"> · {log.entityId}</span>}
                  </p>
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
                <span className="whitespace-nowrap text-xs text-stone-400">{formatDate(log.createdAt)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
