import { Fragment, FormEvent, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useStudentClassDetail, type PeriodGrade } from '@/hooks/useStudentClassDetail';
import { useStudentAppeals } from '@/hooks/useAppeals';
import { supabase } from '@/lib/supabase';
import { formatNumeric } from '@/utils/conversionTable';
import { humanizeError } from '@/utils/errorMessage';
import type { AttendanceSummary } from '@/types/database';
import type {
  AppealStatus,
  DbAppeal,
  DbGradeCategory,
  DbGradeItem,
  DbScore,
  DbScoreComment,
  Period,
} from '@/types/database';

export function StudentClassDetails() {
  const { classId } = useParams();
  const { data, loading, error } = useStudentClassDetail(classId);
  const { appeals, refresh: refreshAppeals } = useStudentAppeals(classId);
  const [period, setPeriod] = useState<Period>('midterm');

  if (loading) return <div className="card text-sm text-content-subtle">Loading…</div>;
  if (error || !data)
    return (
      <div className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300">
        {error ?? 'Class not found'}
      </div>
    );

  return (
    <div className="space-y-6">
      <header>
        <div className="font-mono text-xs uppercase text-content-subtle">
          {data.class.subject.code}
        </div>
        <h1 className="text-3xl font-bold tracking-tight">{data.class.subject.title}</h1>
        <div className="mt-1 text-sm text-content-muted">
          {data.class.semester} · {data.class.school_year}
          {data.class.section && <> · Section {data.class.section}</>}
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <GradeCard label="Midterm" grade={data.midterm} />
        <GradeCard label="Finals" grade={data.finals} />
        <GradeCard label="Final Grade" grade={data.final} primary />
      </section>

      <AttendanceSummaryCard classId={data.class.id} studentId={data.studentId} />

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Grade Breakdown</h2>
          <div className="flex gap-1 rounded-md bg-surface-3 p-1 text-sm">
            {(['midterm', 'finals'] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`rounded px-3 py-1 capitalize ${
                  period === p ? 'bg-surface shadow-sm font-medium' : 'text-content-muted'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <Breakdown
          period={period}
          categories={data.categories}
          items={data.items}
          scores={data.scores}
          comments={data.comments}
          appeals={appeals}
          onAppealFiled={refreshAppeals}
        />
      </section>
    </div>
  );
}

function GradeCard({
  label,
  grade,
  primary,
}: {
  label: string;
  grade: PeriodGrade;
  primary?: boolean;
}) {
  const remarkClass =
    grade.remarks === 'Passed'
      ? 'badge-success'
      : grade.remarks === 'At Risk'
        ? 'badge-warning'
        : grade.remarks === 'Failed'
          ? 'badge-danger'
          : 'badge-neutral';

  return (
    <div className={`card ${primary ? 'bg-brand-500/10 ring-brand-500/30' : ''}`}>
      <div className="text-xs uppercase tracking-wide text-content-subtle">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-3xl font-bold">{grade.percentage.toFixed(2)}%</span>
        <span className="text-sm text-content-subtle">
          ≈ {formatNumeric(grade.numeric_grade)}
        </span>
      </div>
      <div className="mt-2">
        <span className={remarkClass}>{grade.remarks}</span>
      </div>
    </div>
  );
}

function AttendanceSummaryCard({
  classId,
  studentId,
}: {
  classId: string;
  studentId: string;
}) {
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase.rpc('get_attendance_summary', {
        p_class_id: classId,
        p_student_id: studentId,
      });
      if (cancelled) return;
      setSummary((data as AttendanceSummary[] | null)?.[0] ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [classId, studentId]);

  if (loading) {
    return (
      <div className="card text-sm text-content-subtle">Loading attendance…</div>
    );
  }
  if (!summary || summary.total === 0) {
    return (
      <div className="card text-sm text-content-subtle">
        Your teacher hasn't recorded any attendance yet.
      </div>
    );
  }

  const pct = Number(summary.attendance_pct);
  const pctColor =
    pct >= 90
      ? 'text-emerald-600'
      : pct >= 75
        ? 'text-amber-600'
        : 'text-red-600';

  return (
    <section className="card">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Attendance</h2>
        <div className={`text-3xl font-bold tracking-tight ${pctColor}`}>{pct.toFixed(1)}%</div>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <AttendanceStat label="Present" value={summary.present} color="text-emerald-600 dark:text-emerald-300" />
        <AttendanceStat label="Late" value={summary.late} color="text-amber-700" />
        <AttendanceStat label="Absent" value={summary.absent} color="text-red-600 dark:text-red-300" />
        <AttendanceStat label="Excused" value={summary.excused} color="text-content-muted" />
      </div>
      <p className="mt-3 text-xs text-content-subtle">
        Total class days recorded: {summary.total}. Attendance % counts late as attended and
        excludes excused days from the denominator.
      </p>
    </section>
  );
}

function AttendanceStat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-md border border-line bg-surface-2 px-3 py-2 text-center">
      <div className="text-xs uppercase tracking-wide text-content-subtle">{label}</div>
      <div className={`text-xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

function Breakdown({
  period,
  categories,
  items,
  scores,
  comments,
  appeals,
  onAppealFiled,
}: {
  period: Period;
  categories: DbGradeCategory[];
  items: DbGradeItem[];
  scores: DbScore[];
  comments: DbScoreComment[];
  appeals: DbAppeal[];
  onAppealFiled: () => void;
}) {
  const [appealing, setAppealing] = useState<DbScore | null>(null);
  const periodCats = useMemo(
    () => categories.filter((c) => c.period === period),
    [categories, period],
  );

  if (periodCats.length === 0) {
    return (
      <div className="card text-sm text-content-subtle">
        Your teacher hasn't set up {period} categories yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {periodCats.map((cat) => {
        const catItems = items.filter((i) => i.category_id === cat.id);
        const totalMax = catItems.reduce((s, i) => s + Number(i.max_score), 0);
        const earned = catItems.reduce((s, i) => {
          const sc = scores.find((x) => x.grade_item_id === i.id);
          return (
            s +
            (sc && sc.status === 'graded' && sc.score != null ? Number(sc.score) : 0)
          );
        }, 0);
        const catPct = totalMax > 0 ? (earned / totalMax) * 100 : 0;
        const contribution = (catPct * Number(cat.weight)) / 100;

        return (
          <div key={cat.id} className="card">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="font-semibold">{cat.name}</h3>
                <div className="text-xs text-content-subtle">Weight: {cat.weight}%</div>
              </div>
              <div className="text-right">
                <div className="font-mono text-sm">
                  {earned} / {totalMax}
                </div>
                <div className="text-xs text-content-subtle">
                  {catPct.toFixed(1)}% · contributes {contribution.toFixed(2)} pts
                </div>
              </div>
            </div>
            {catItems.length === 0 ? (
              <p className="text-xs text-content-subtle">No items yet.</p>
            ) : (
              <table className="min-w-full text-sm">
                <tbody className="divide-y divide-line">
                  {catItems.map((i) => {
                    const sc = scores.find((s) => s.grade_item_id === i.id);
                    const appeal = sc ? appeals.find((a) => a.score_id === sc.id) : undefined;
                    const itemComments = comments.filter(
                      (c) =>
                        c.grade_item_id === i.id ||
                        (sc && c.score_id === sc.id),
                    );
                    return (
                      <Fragment key={i.id}>
                        <tr>
                          <td className="py-2">{i.title}</td>
                          <td className="py-2 text-right">
                            {sc?.status === 'graded' && sc.score != null ? (
                              <span>
                                <span className="font-mono">
                                  {sc.score} / {i.max_score}
                                </span>
                                <span className="ml-2 text-xs text-content-subtle">
                                  ({((Number(sc.score) / Number(i.max_score)) * 100).toFixed(0)}%)
                                </span>
                              </span>
                            ) : sc?.status === 'missing' ? (
                              <span className="badge-danger">missing</span>
                            ) : sc?.status === 'late' ? (
                              <span className="badge-warning">late</span>
                            ) : sc?.status === 'excused' ? (
                              <span className="badge-neutral">excused</span>
                            ) : (
                              <span className="text-content-subtle">pending</span>
                            )}
                          </td>
                          <td className="py-2 pl-3 text-right">
                            {appeal ? (
                              <AppealBadge status={appeal.status} />
                            ) : sc ? (
                              <button
                                onClick={() => setAppealing(sc)}
                                className="text-xs font-medium text-brand-600 hover:underline"
                              >
                                Appeal
                              </button>
                            ) : null}
                          </td>
                        </tr>
                        {itemComments.length > 0 && (
                          <tr>
                            <td colSpan={3} className="pb-2 pl-4">
                              <div className="space-y-1">
                                {itemComments
                                  .sort((a, b) => a.created_at.localeCompare(b.created_at))
                                  .map((c) => (
                                    <div
                                      key={c.id}
                                      className="rounded-md border border-line bg-surface-2 px-3 py-1.5 text-xs"
                                    >
                                      <div className="text-xs uppercase tracking-wide text-content-subtle">
                                        💬 {c.grade_item_id ? 'Note to class' : 'From your teacher'} ·{' '}
                                        {new Date(c.created_at).toLocaleDateString()}
                                      </div>
                                      <div className="whitespace-pre-wrap text-content-muted">
                                        {c.body}
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        );
      })}

      {appealing && (
        <AppealModal
          score={appealing}
          itemTitle={items.find((i) => i.id === appealing.grade_item_id)?.title ?? ''}
          onClose={() => setAppealing(null)}
          onFiled={() => {
            setAppealing(null);
            onAppealFiled();
          }}
        />
      )}
    </div>
  );
}

function AppealBadge({ status }: { status: AppealStatus }) {
  if (status === 'pending') return <span className="badge-warning">Appeal pending</span>;
  if (status === 'approved') return <span className="badge-success">Appeal approved</span>;
  return <span className="badge-neutral">Appeal rejected</span>;
}

function AppealModal({
  score,
  itemTitle,
  onClose,
  onFiled,
}: {
  score: DbScore;
  itemTitle: string;
  onClose: () => void;
  onFiled: () => void;
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;
    setBusy(true);
    setError(null);
    const { data: studentRow } = await supabase
      .from('students')
      .select('id')
      .eq('user_id', (await supabase.auth.getUser()).data.user?.id ?? '')
      .maybeSingle();
    if (!studentRow) {
      setError('Student profile not found.');
      setBusy(false);
      return;
    }
    const { error: err } = await supabase.from('appeals').insert({
      score_id: score.id,
      student_id: studentRow.id,
      reason: reason.trim(),
    });
    setBusy(false);
    if (err) {
      setError(humanizeError(err));
      return;
    }
    onFiled();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <form onSubmit={onSubmit} className="card w-full max-w-md space-y-4">
        <h3 className="text-lg font-semibold">File an Appeal</h3>
        <div className="rounded-md bg-surface-2 px-3 py-2 text-sm">
          <div>
            Item: <strong>{itemTitle}</strong>
          </div>
          <div>
            Your score:{' '}
            <strong>
              {score.score ?? '—'} ({score.status})
            </strong>
          </div>
        </div>
        {error && (
          <div className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300">{error}</div>
        )}
        <div>
          <label className="label">Reason</label>
          <textarea
            required
            rows={5}
            className="input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain why you think this grade should be reviewed..."
          />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button disabled={busy || !reason.trim()} className="btn-primary">
            {busy ? 'Submitting…' : 'Submit Appeal'}
          </button>
        </div>
      </form>
    </div>
  );
}
