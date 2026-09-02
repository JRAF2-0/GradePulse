import { FormEvent, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAllAppeals, type AdminAppealRow } from '@/hooks/useAppeals';
import { humanizeError } from '@/utils/errorMessage';
import { SkeletonCard } from '@/components/Skeleton';
import type { AppealStatus } from '@/types/database';

export function AdminAppeals() {
  const { appeals, loading, error, refresh } = useAllAppeals();
  const [statusFilter, setStatusFilter] = useState<AppealStatus | 'all'>('pending');
  const [classFilter, setClassFilter] = useState<string>('');
  const [resolving, setResolving] = useState<AdminAppealRow | null>(null);

  const classOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const a of appeals) {
      if (!seen.has(a.class_id)) {
        seen.set(a.class_id, `${a.subject_code} — ${a.subject_title}`);
      }
    }
    return Array.from(seen.entries()).map(([id, label]) => ({ id, label }));
  }, [appeals]);

  const filtered = useMemo(
    () =>
      appeals.filter(
        (a) =>
          (statusFilter === 'all' || a.status === statusFilter) &&
          (classFilter === '' || a.class_id === classFilter),
      ),
    [appeals, statusFilter, classFilter],
  );

  const counts = {
    pending: appeals.filter((a) => a.status === 'pending').length,
    approved: appeals.filter((a) => a.status === 'approved').length,
    rejected: appeals.filter((a) => a.status === 'rejected').length,
  };

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Appeals (system-wide)</h1>
        <p className="text-sm text-content-muted">
          Review and resolve grade appeals filed by students. Teachers handle appeals within their
          own classes; admins have escalation authority across all classes.
        </p>
      </header>

      <div className="card flex flex-wrap items-end gap-3">
        <div>
          <label className="label">Status</label>
          <div className="flex gap-1 rounded-md bg-surface-3 p-1 text-sm">
            {(['pending', 'approved', 'rejected', 'all'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded px-3 py-1 capitalize ${
                  statusFilter === s ? 'bg-surface shadow-sm font-medium' : 'text-content-muted'
                }`}
              >
                {s} {s !== 'all' && `(${counts[s as keyof typeof counts]})`}
              </button>
            ))}
          </div>
        </div>
        <div className="grow">
          <label className="label">Class</label>
          <select
            className="input"
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
          >
            <option value="">All classes</option>
            {classOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-600 ring-1 ring-red-500/30 dark:text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-sm text-content-subtle">
          No {statusFilter === 'all' ? '' : statusFilter} appeals
          {classFilter ? ' for that class' : ''}.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((a) => (
            <div key={a.id} className="card">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="text-xs text-content-subtle">
                    {new Date(a.created_at).toLocaleString()}
                  </div>
                  <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
                    <span className="font-semibold">{a.student_name}</span>
                    <span className="text-xs text-content-subtle">({a.student_no ?? '—'})</span>
                    <span className="text-xs text-content-subtle">·</span>
                    <span className="font-mono text-xs uppercase text-content-subtle">
                      {a.subject_code}
                    </span>
                    <span className="text-xs text-content-subtle">{a.subject_title}</span>
                    <span className="text-xs text-content-subtle">·</span>
                    <span className="text-xs text-content-subtle">teacher: {a.teacher_name}</span>
                  </div>
                  <div className="mt-1 text-sm">
                    Disputing <strong>{a.item_title}</strong> — score:{' '}
                    <span className="font-mono">
                      {a.score_value ?? '—'} / {a.max_score}
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap rounded-md bg-surface-2 px-3 py-2 text-sm text-content-muted">
                    {a.reason}
                  </p>
                  {a.teacher_response && (
                    <p className="mt-2 rounded-xl bg-brand-500/10 px-4 py-3 text-sm font-medium text-brand-700 ring-1 ring-brand-500/30 dark:text-brand-300">
                      <strong>Response:</strong> {a.teacher_response}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <AppealStatusBadge status={a.status} />
                  {a.status === 'pending' && (
                    <button onClick={() => setResolving(a)} className="btn-primary text-xs">
                      Review
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {resolving && (
        <AdminResolveAppealModal
          appeal={resolving}
          onClose={() => setResolving(null)}
          onResolved={() => {
            setResolving(null);
            void refresh();
          }}
        />
      )}
    </div>
  );
}

function AppealStatusBadge({ status }: { status: AppealStatus }) {
  if (status === 'pending') return <span className="badge-warning">Pending</span>;
  if (status === 'approved') return <span className="badge-success">Approved</span>;
  return <span className="badge-danger">Rejected</span>;
}

function AdminResolveAppealModal({
  appeal,
  onClose,
  onResolved,
}: {
  appeal: AdminAppealRow;
  onClose: () => void;
  onResolved: () => void;
}) {
  const [decision, setDecision] = useState<'approved' | 'rejected'>('approved');
  const [response, setResponse] = useState('');
  const [updateScore, setUpdateScore] = useState(true);
  const [newScore, setNewScore] = useState<string>(
    appeal.score_value != null ? String(appeal.score_value) : '',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);

    if (decision === 'approved' && updateScore) {
      const n = Number(newScore);
      if (Number.isNaN(n) || n < 0 || n > Number(appeal.max_score)) {
        setError(`Score must be between 0 and ${appeal.max_score}.`);
        setBusy(false);
        return;
      }
      const { error: scoreErr } = await supabase
        .from('scores')
        .update({ score: n })
        .eq('id', appeal.score_id);
      if (scoreErr) {
        setError(humanizeError(scoreErr));
        setBusy(false);
        return;
      }
    }

    const { error: appealErr } = await supabase
      .from('appeals')
      .update({
        status: decision,
        teacher_response: response.trim() || null,
      })
      .eq('id', appeal.id);

    setBusy(false);
    if (appealErr) {
      setError(humanizeError(appealErr));
      return;
    }
    onResolved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in md:left-[var(--sidebar-w)]">
      <form onSubmit={onSubmit} className="card w-full max-w-md space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Resolve appeal (admin)</h3>
          <p className="text-xs text-content-subtle">
            {appeal.subject_code} — {appeal.subject_title} · teacher: {appeal.teacher_name}
          </p>
        </div>

        <div className="rounded-md border border-line p-3 text-sm">
          <div>
            <strong>{appeal.student_name}</strong> on <strong>{appeal.item_title}</strong>
          </div>
          <div className="mt-1 text-xs text-content-subtle">
            Current score: {appeal.score_value ?? '—'} / {appeal.max_score}
          </div>
        </div>

        <div>
          <div className="label">Student's reason</div>
          <div className="rounded-md bg-surface-2 px-3 py-2 text-sm text-content-muted">
            {appeal.reason}
          </div>
        </div>

        <div>
          <label className="label">Decision</label>
          <div className="flex gap-2">
            <label className="flex items-center gap-1 text-sm">
              <input
                type="radio"
                checked={decision === 'approved'}
                onChange={() => setDecision('approved')}
              />
              Approve
            </label>
            <label className="flex items-center gap-1 text-sm">
              <input
                type="radio"
                checked={decision === 'rejected'}
                onChange={() => setDecision('rejected')}
              />
              Reject
            </label>
          </div>
        </div>

        {decision === 'approved' && (
          <div className="rounded-md border border-emerald-200 bg-emerald-500/10 p-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={updateScore}
                onChange={(e) => setUpdateScore(e.target.checked)}
              />
              Update score
            </label>
            {updateScore && (
              <div className="mt-2">
                <label className="label">New score</label>
                <input
                  required
                  type="number"
                  min={0}
                  max={appeal.max_score}
                  step="0.5"
                  className="input"
                  value={newScore}
                  onChange={(e) => setNewScore(e.target.value)}
                />
                <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
                  Will update <strong>{appeal.student_name}</strong>'s score on{' '}
                  <strong>{appeal.item_title}</strong> in the same transaction.
                </p>
              </div>
            )}
          </div>
        )}

        <div>
          <label className="label">Response to student (optional)</label>
          <textarea
            rows={3}
            className="input"
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            placeholder="Brief explanation visible to the student."
          />
        </div>

        {error && (
          <div className="rounded-xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-600 ring-1 ring-red-500/30 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary" disabled={busy}>
            Cancel
          </button>
          <button disabled={busy} className="btn-primary">
            {busy ? 'Saving…' : 'Save resolution'}
          </button>
        </div>
      </form>
    </div>
  );
}
