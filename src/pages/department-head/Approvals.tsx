import { FormEvent, useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { humanizeError } from '@/utils/errorMessage';
import { SkeletonTableRows } from '@/components/Skeleton';

interface PendingRequest {
  id: string;
  score_id: string;
  requested_by: string;
  old_score: number | null;
  new_score: number | null;
  reason: string;
  status: string;
  created_at: string;
  reviewed_by: string | null;
  review_note: string | null;
  reviewed_at: string | null;
  requester: { full_name: string; email: string } | null;
  reviewer: { full_name: string } | null;
  score: {
    id: string;
    student: { user: { full_name: string } | null } | null;
    grade_item: {
      id: string;
      title: string;
      max_score: number;
      category: {
        id: string;
        name: string;
        period: string;
        class: {
          id: string;
          section: string | null;
          school_year: string;
          subject: { code: string; title: string } | null;
        } | null;
      } | null;
    } | null;
  } | null;
}

type Tab = 'pending' | 'history';

export function DepartmentHeadApprovals() {
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [tab, setTab] = useState<Tab>('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<PendingRequest | null>(null);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('grade_change_requests')
      .select(
        `id, score_id, requested_by, old_score, new_score, reason, status, created_at,
         reviewed_by, review_note, reviewed_at,
         requester:users!requested_by(full_name, email),
         reviewer:users!reviewed_by(full_name),
         score:scores(
           id,
           student:students(user:users(full_name)),
           grade_item:grade_items(id, title, max_score,
             category:grade_categories(id, name, period,
               class:classes(id, section, school_year, subject:subjects(code, title))
             )
           )
         )`,
      )
      .order('created_at', { ascending: false });
    setLoading(false);
    if (err) {
      setError(humanizeError(err));
      return;
    }
    setRequests((data as unknown as PendingRequest[]) ?? []);
  }, []);

  useEffect(() => {
    void fetchRequests();
  }, [fetchRequests]);

  const pending = requests.filter((r) => r.status === 'pending');
  const history = requests.filter((r) => r.status !== 'pending');
  const visible = tab === 'pending' ? pending : history;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Grade change approvals</h1>
        <p className="text-sm text-content-muted">
          Teachers submit a request to change a score after a period has been finalized. Approving
          applies the new score immediately; rejecting keeps the original score.
        </p>
      </header>

      {error && (
        <div className="rounded-xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-600 ring-1 ring-red-500/30 dark:text-red-300">
          {error}
        </div>
      )}

      <nav className="flex gap-1 border-b border-line">
        <TabButton active={tab === 'pending'} onClick={() => setTab('pending')}>
          Pending ({pending.length})
        </TabButton>
        <TabButton active={tab === 'history'} onClick={() => setTab('history')}>
          History ({history.length})
        </TabButton>
      </nav>

      <div className="card overflow-x-auto p-0">
        <table className="min-w-full divide-y divide-line text-sm">
          <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-content-subtle">
            <tr>
              <th className="px-4 py-2">Filed</th>
              <th className="px-4 py-2">Class / Item</th>
              <th className="px-4 py-2">Student</th>
              <th className="px-4 py-2">Change</th>
              <th className="px-4 py-2">Reason</th>
              <th className="px-4 py-2">Requested by</th>
              {tab === 'history' && <th className="px-4 py-2">Status</th>}
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {loading ? (
              <SkeletonTableRows rows={4} cols={8} />
            ) : visible.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-content-subtle">
                  {tab === 'pending' ? 'No pending requests.' : 'No reviewed requests yet.'}
                </td>
              </tr>
            ) : (
              visible.map((r) => {
                const cls = r.score?.grade_item?.category?.class;
                const subj = cls?.subject;
                return (
                  <tr key={r.id}>
                    <td className="px-4 py-2 text-xs text-content-subtle">
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-2">
                      <div className="font-medium">
                        {subj ? `${subj.code} — ${subj.title}` : '—'}
                      </div>
                      <div className="text-xs text-content-subtle">
                        {r.score?.grade_item?.title}
                        {r.score?.grade_item?.category &&
                          ` · ${r.score.grade_item.category.name} · ${r.score.grade_item.category.period}`}
                      </div>
                    </td>
                    <td className="px-4 py-2 font-medium">
                      {r.score?.student?.user?.full_name ?? '—'}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <span className="text-content-subtle">{r.old_score ?? '—'}</span> →{' '}
                      <strong>{r.new_score ?? '—'}</strong>
                      {r.score?.grade_item?.max_score && (
                        <span className="text-xs text-content-subtle">
                          {' '}
                          / {r.score.grade_item.max_score}
                        </span>
                      )}
                    </td>
                    <td className="max-w-xs px-4 py-2 text-content-muted">
                      <div className="line-clamp-2">{r.reason}</div>
                    </td>
                    <td className="px-4 py-2 text-content-muted">
                      {r.requester?.full_name ?? '—'}
                    </td>
                    {tab === 'history' && (
                      <td className="px-4 py-2">
                        <StatusBadge status={r.status} />
                      </td>
                    )}
                    <td className="px-4 py-2 text-right">
                      {r.status === 'pending' ? (
                        <button onClick={() => setReviewing(r)} className="btn-secondary text-xs">
                          Review
                        </button>
                      ) : (
                        <button
                          onClick={() => setReviewing(r)}
                          className="text-xs text-brand-600 hover:underline"
                        >
                          Details
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {reviewing && (
        <ReviewModal
          request={reviewing}
          onClose={() => setReviewing(null)}
          onSaved={() => {
            setReviewing(null);
            void fetchRequests();
          }}
        />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`whitespace-nowrap px-4 py-2 text-sm font-medium transition ${
        active
          ? 'border-b-2 border-brand-600 text-brand-700'
          : 'text-content-subtle hover:text-content'
      }`}
    >
      {children}
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'approved'
      ? 'badge-success'
      : status === 'rejected'
        ? 'badge-danger'
        : 'badge-warning';
  return <span className={cls}>{status}</span>;
}

function ReviewModal({
  request,
  onClose,
  onSaved,
}: {
  request: PendingRequest;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [reviewNote, setReviewNote] = useState(request.review_note ?? '');
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const readOnly = request.status !== 'pending';

  const submit = async (decision: 'approve' | 'reject', e?: FormEvent) => {
    e?.preventDefault();
    setBusy(decision);
    setError(null);
    const { error: err } = await supabase.rpc('review_grade_change', {
      p_request_id: request.id,
      p_decision: decision,
      p_review_note: reviewNote.trim() || null,
    });
    setBusy(null);
    if (err) {
      setError(humanizeError(err));
      return;
    }
    onSaved();
  };

  const subj = request.score?.grade_item?.category?.class?.subject;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in md:left-[var(--sidebar-w)]">
      <div className="card w-full max-w-lg space-y-4">
        <div>
          <h3 className="text-lg font-semibold">
            {readOnly ? 'Request details' : 'Review grade change'}
          </h3>
          <p className="text-xs text-content-subtle">
            Filed {new Date(request.created_at).toLocaleString()}
            {request.reviewed_at && ` · Reviewed ${new Date(request.reviewed_at).toLocaleString()}`}
          </p>
        </div>

        <div className="rounded-md border border-line p-3 text-sm">
          <div className="font-medium">{subj ? `${subj.code} — ${subj.title}` : 'Class'}</div>
          <div className="text-xs text-content-subtle">
            {request.score?.grade_item?.title}
            {request.score?.grade_item?.category &&
              ` · ${request.score.grade_item.category.name} · ${request.score.grade_item.category.period}`}
          </div>
          <div className="mt-2">
            Student: <strong>{request.score?.student?.user?.full_name ?? '—'}</strong>
          </div>
          <div className="mt-1">
            Score: <span className="text-content-subtle">{request.old_score ?? '—'}</span> →{' '}
            <strong>{request.new_score ?? '—'}</strong>
            {request.score?.grade_item?.max_score && (
              <span className="text-xs text-content-subtle">
                {' '}
                / {request.score.grade_item.max_score}
              </span>
            )}
          </div>
          <div className="mt-1 text-xs text-content-subtle">
            Requested by {request.requester?.full_name ?? '—'} ({request.requester?.email})
          </div>
        </div>

        <div>
          <div className="label">Teacher's reason</div>
          <div className="rounded-md bg-surface-2 px-3 py-2 text-sm text-content-muted">
            {request.reason}
          </div>
        </div>

        <div>
          <label className="label">Review note (optional)</label>
          <textarea
            rows={3}
            className="input"
            value={reviewNote}
            onChange={(e) => setReviewNote(e.target.value)}
            placeholder="Add a note explaining your decision (visible in the audit log)."
            disabled={readOnly}
          />
        </div>

        {readOnly && (
          <div className="text-xs text-content-subtle">
            Status: <StatusBadge status={request.status} /> by {request.reviewer?.full_name ?? '—'}
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-600 ring-1 ring-red-500/30 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            Close
          </button>
          {!readOnly && (
            <>
              <button
                onClick={() => void submit('reject')}
                disabled={busy !== null}
                className="btn-secondary text-red-600"
              >
                {busy === 'reject' ? 'Rejecting…' : 'Reject'}
              </button>
              <button
                onClick={() => void submit('approve')}
                disabled={busy !== null}
                className="btn-primary"
              >
                {busy === 'approve' ? 'Approving…' : 'Approve & apply'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
