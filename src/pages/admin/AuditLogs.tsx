import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { humanizeError } from '@/utils/errorMessage';
import type { AuditAction, Json } from '@/types/database';

interface AuditLogRow {
  id: string;
  created_at: string;
  action: AuditAction;
  target_type: string;
  target_id: string;
  old_value: Json | null;
  new_value: Json | null;
  actor_id: string | null;
  actor_name: string | null;
  actor_email: string | null;
  student_name: string | null;
  item_title: string | null;
}

const PAGE_SIZE = 50;

export function AdminAuditLogs() {
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [filterAction, setFilterAction] = useState<string>('');
  const [filterTarget, setFilterTarget] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<AuditLogRow | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [logsRes, countRes] = await Promise.all([
      supabase.rpc('get_audit_logs', {
        p_limit: PAGE_SIZE,
        p_offset: page * PAGE_SIZE,
        p_action: filterAction || null,
        p_target_type: filterTarget || null,
      }),
      supabase.rpc('count_audit_logs', {
        p_action: filterAction || null,
        p_target_type: filterTarget || null,
      }),
    ]);
    setLoading(false);
    if (logsRes.error) {
      setError(humanizeError(logsRes.error));
      return;
    }
    setLogs((logsRes.data as AuditLogRow[]) ?? []);
    setTotal(Number(countRes.data ?? 0));
  }, [page, filterAction, filterTarget]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Audit Logs</h1>
        <p className="text-sm text-content-muted">
          Every grade change is recorded with actor, old value, and new value.
        </p>
      </header>

      <div className="card flex flex-wrap items-end gap-3">
        <div>
          <label className="label">Action</label>
          <select
            className="input"
            value={filterAction}
            onChange={(e) => {
              setPage(0);
              setFilterAction(e.target.value);
            }}
          >
            <option value="">All actions</option>
            <option value="insert">insert</option>
            <option value="update">update</option>
            <option value="delete">delete</option>
            <option value="publish">publish</option>
            <option value="lock">lock</option>
          </select>
        </div>
        <div>
          <label className="label">Target</label>
          <select
            className="input"
            value={filterTarget}
            onChange={(e) => {
              setPage(0);
              setFilterTarget(e.target.value);
            }}
          >
            <option value="">All targets</option>
            <option value="score">score</option>
            <option value="finalized_grade">finalized_grade</option>
          </select>
        </div>
        <button
          onClick={() => {
            setFilterAction('');
            setFilterTarget('');
            setPage(0);
          }}
          className="btn-secondary"
        >
          Reset
        </button>
        <div className="ml-auto text-sm text-content-subtle">
          {loading ? 'Loading…' : `${total.toLocaleString()} total log${total === 1 ? '' : 's'}`}
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-600 ring-1 ring-red-500/30 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="card overflow-x-auto p-0">
        <table className="min-w-full divide-y divide-line text-sm">
          <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-content-subtle">
            <tr>
              <th className="px-4 py-2">When</th>
              <th className="px-4 py-2">Actor</th>
              <th className="px-4 py-2">Action</th>
              <th className="px-4 py-2">Target</th>
              <th className="px-4 py-2">Context</th>
              <th className="px-4 py-2">Change</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-content-subtle">
                  Loading…
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-content-subtle">
                  No logs yet.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-surface-3">
                  <td className="whitespace-nowrap px-4 py-2 text-content-subtle">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-2">
                    <div className="font-medium">{log.actor_name ?? '—'}</div>
                    <div className="text-xs text-content-subtle">{log.actor_email ?? ''}</div>
                  </td>
                  <td className="px-4 py-2">
                    <ActionBadge action={log.action} />
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{log.target_type}</td>
                  <td className="px-4 py-2 text-xs text-content-muted">
                    {log.student_name && (
                      <div>
                        Student: <strong>{log.student_name}</strong>
                      </div>
                    )}
                    {log.item_title && (
                      <div>
                        Item: <strong>{log.item_title}</strong>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs font-mono">
                    <ChangeSummary log={log} />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => setViewing(log)} className="btn-secondary text-xs">
                      View diff
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-xs text-content-subtle">
            Page {page + 1} of {totalPages}
          </div>
          <div className="flex gap-2">
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="btn-secondary text-xs disabled:opacity-50"
            >
              Previous
            </button>
            <button
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="btn-secondary text-xs disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {viewing && <DiffModal log={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

function ActionBadge({ action }: { action: AuditAction }) {
  const cls =
    action === 'insert'
      ? 'badge-success'
      : action === 'update'
        ? 'badge-warning'
        : action === 'delete'
          ? 'badge-danger'
          : action === 'lock'
            ? 'badge-danger'
            : 'badge-neutral';
  return <span className={cls}>{action}</span>;
}

function ChangeSummary({ log }: { log: AuditLogRow }) {
  if (log.target_type === 'score') {
    const oldScore = (log.old_value as { score?: number | null } | null)?.score;
    const newScore = (log.new_value as { score?: number | null } | null)?.score;
    const oldStatus = (log.old_value as { status?: string } | null)?.status;
    const newStatus = (log.new_value as { status?: string } | null)?.status;

    if (log.action === 'insert') {
      return (
        <span>
          → {newScore ?? '—'} ({newStatus})
        </span>
      );
    }
    if (log.action === 'delete') {
      return <span className="text-red-600">deleted ({oldScore ?? '—'})</span>;
    }
    return (
      <span>
        {oldScore ?? '—'} → {newScore ?? '—'}
        {oldStatus !== newStatus && (
          <span className="ml-1 text-content-subtle">
            ({oldStatus} → {newStatus})
          </span>
        )}
      </span>
    );
  }
  return <span className="text-content-subtle">—</span>;
}

function DiffModal({ log, onClose }: { log: AuditLogRow; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 px-4 animate-fade-in">
      <div className="card w-full max-w-3xl space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold">Audit Log Detail</h3>
            <div className="mt-1 text-xs text-content-subtle">
              {new Date(log.created_at).toLocaleString()} · {log.actor_name ?? '—'} ·{' '}
              <ActionBadge action={log.action} /> on <code>{log.target_type}</code>
            </div>
          </div>
          <button onClick={onClose} className="btn-secondary text-xs">
            Close
          </button>
        </div>

        {(log.student_name || log.item_title) && (
          <div className="rounded-md bg-surface-2 px-3 py-2 text-sm">
            {log.student_name && (
              <div>
                Student: <strong>{log.student_name}</strong>
              </div>
            )}
            {log.item_title && (
              <div>
                Item: <strong>{log.item_title}</strong>
              </div>
            )}
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <div className="mb-1 text-xs font-semibold uppercase text-content-subtle">
              Old value
            </div>
            <pre className="max-h-96 overflow-auto rounded-xl bg-red-500/10 p-3 text-xs text-red-700 ring-1 ring-red-500/30 dark:text-red-200">
              {log.old_value ? JSON.stringify(log.old_value, null, 2) : '—'}
            </pre>
          </div>
          <div>
            <div className="mb-1 text-xs font-semibold uppercase text-content-subtle">
              New value
            </div>
            <pre className="max-h-96 overflow-auto rounded-xl bg-emerald-500/10 p-3 text-xs text-emerald-700 ring-1 ring-emerald-500/30 dark:text-emerald-200">
              {log.new_value ? JSON.stringify(log.new_value, null, 2) : '—'}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
