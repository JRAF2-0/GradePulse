import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useClassDetail, categoriesForPeriod, weightTotal } from '@/hooks/useClassDetail';
import { useClassAppeals, type AppealRow } from '@/hooks/useAppeals';
import { humanizeError } from '@/utils/errorMessage';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { RiskBadge } from '@/components/RiskBadge';
import { PageSkeleton, SkeletonCard, SkeletonTableRows } from '@/components/Skeleton';
import type {
  AppealStatus,
  AttendanceStatus,
  DbAttendance,
  DbFinalizedGrade,
  DbGradeCategory,
  DbGradeChangeRequest,
  DbGradeItem,
  DbScore,
  DbScoreComment,
  Period,
  RiskLevel,
  ScoreStatus,
} from '@/types/database';

type Tab = 'roster' | 'categories' | 'items' | 'grades' | 'attendance' | 'finalize' | 'appeals';

export function TeacherClassDetails() {
  const { classId } = useParams();
  const navigate = useNavigate();
  const { data, loading, error, refresh } = useClassDetail(classId);
  const [tab, setTab] = useState<Tab>('roster');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  if (loading) return <PageSkeleton />;
  if (error || !data)
    return (
      <div className="rounded-xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-600 ring-1 ring-red-500/30 dark:text-red-300">
        {error ?? 'Class not found'}
      </div>
    );

  const handleDelete = async () => {
    if (!classId) return;
    setDeleting(true);
    setDeleteError(null);
    const { error: err } = await supabase.from('classes').delete().eq('id', classId);
    setDeleting(false);
    if (err) {
      setDeleteError(humanizeError(err));
      return;
    }
    navigate('/teacher/classes', { replace: true });
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'roster', label: 'Roster' },
    { key: 'categories', label: 'Categories' },
    { key: 'items', label: 'Grade Items' },
    { key: 'grades', label: 'Grade Entry' },
    { key: 'attendance', label: 'Attendance' },
    { key: 'appeals', label: 'Appeals' },
    { key: 'finalize', label: 'Finalize' },
  ];

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="font-mono text-xs uppercase text-content-subtle">
            {data.class.subject.code}
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{data.class.subject.title}</h1>
          <div className="mt-1 flex flex-wrap gap-3 text-sm text-content-muted">
            <span>Section: {data.class.section ?? '—'}</span>
            <span>Semester: {data.class.semester}</span>
            <span>SY: {data.class.school_year}</span>
            <span>
              Code:{' '}
              <span className="font-mono font-bold tracking-widest text-brand-700">
                {data.class.class_code}
              </span>
            </span>
          </div>
        </div>
        <button
          onClick={() => setShowDeleteModal(true)}
          className="btn-secondary text-xs text-red-600 hover:bg-red-500/10"
        >
          Delete class
        </button>
      </header>

      <nav className="flex gap-1 overflow-x-auto border-b border-line">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`whitespace-nowrap px-4 py-2 text-sm font-medium transition ${
              tab === t.key
                ? 'border-b-2 border-brand-600 text-brand-700'
                : 'text-content-subtle hover:text-content'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'roster' && <RosterTab classId={data.class.id} roster={data.roster} />}
      {tab === 'categories' && (
        <CategoriesTab classId={data.class.id} categories={data.categories} onChange={refresh} />
      )}
      {tab === 'items' && (
        <ItemsTab categories={data.categories} items={data.items} onChange={refresh} />
      )}
      {tab === 'grades' && (
        <GradesTab
          roster={data.roster}
          categories={data.categories}
          items={data.items}
          scores={data.scores}
          finalized={data.finalized}
          pendingRequests={data.pendingChangeRequests}
          comments={data.comments}
          onChange={refresh}
        />
      )}
      {tab === 'attendance' && <AttendanceTab classId={data.class.id} roster={data.roster} />}
      {tab === 'appeals' && <AppealsTab classId={data.class.id} />}
      {tab === 'finalize' && <FinalizeTab classId={data.class.id} onChange={refresh} />}

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in md:left-[var(--sidebar-w)]">
          <div className="card w-full max-w-md space-y-4">
            <h3 className="text-lg font-semibold text-red-600 dark:text-red-300">
              Delete this class?
            </h3>
            <div className="space-y-2 text-sm text-content-muted">
              <p>
                You're about to permanently delete{' '}
                <strong>
                  {data.class.subject.code} — {data.class.subject.title}
                </strong>
                {data.class.section && <> (Section {data.class.section})</>}.
              </p>
              <p>This will also delete:</p>
              <ul className="list-inside list-disc text-content-muted">
                <li>{data.roster.length} student enrollment(s)</li>
                <li>{data.categories.length} grade categor(y/ies)</li>
                <li>{data.items.length} grade item(s)</li>
                <li>{data.scores.length} score record(s)</li>
                <li>Any finalized grades and appeals for this class</li>
              </ul>
              <p className="text-xs text-content-subtle">
                Audit log entries are preserved. This cannot be undone.
              </p>
            </div>
            {deleteError && (
              <div className="rounded-xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-600 ring-1 ring-red-500/30 dark:text-red-300">
                {deleteError}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteError(null);
                }}
                className="btn-secondary"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={() => void handleDelete()}
                className="btn-danger"
                disabled={deleting}
              >
                {deleting ? 'Deleting…' : 'Delete permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RosterTab({
  classId,
  roster,
}: {
  classId: string;
  roster: { student_id: string; full_name: string; student_no: string | null }[];
}) {
  const [risk, setRisk] = useState<Record<string, RiskLevel | null>>({});

  useEffect(() => {
    if (roster.length === 0) return;
    let cancelled = false;
    void (async () => {
      const entries = await Promise.all(
        roster.map(async (r) => {
          const { data } = await supabase.rpc('compute_risk_level', {
            p_student_id: r.student_id,
            p_class_id: classId,
          });
          return [r.student_id, (data as RiskLevel | null) ?? null] as const;
        }),
      );
      if (cancelled) return;
      setRisk(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, [classId, roster]);

  return (
    <div className="card overflow-x-auto p-0">
      <table className="min-w-full divide-y divide-line text-sm">
        <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-content-subtle">
          <tr>
            <th className="px-4 py-2">Student #</th>
            <th className="px-4 py-2">Name</th>
            <th className="px-4 py-2">Risk</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {roster.length === 0 ? (
            <tr>
              <td colSpan={3} className="px-4 py-6 text-center text-content-subtle">
                No students enrolled yet. Share the class code so students can join.
              </td>
            </tr>
          ) : (
            roster.map((r) => (
              <tr key={r.student_id}>
                <td className="px-4 py-2 font-mono text-content-muted">{r.student_no ?? '—'}</td>
                <td className="px-4 py-2 font-medium">{r.full_name}</td>
                <td className="px-4 py-2">
                  <RiskBadge level={risk[r.student_id]} size="sm" />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function CategoriesTab({
  classId,
  categories,
  onChange,
}: {
  classId: string;
  categories: DbGradeCategory[];
  onChange: () => void;
}) {
  const [period, setPeriod] = useState<Period>('midterm');
  const [name, setName] = useState('');
  const [weight, setWeight] = useState('');
  const [error, setError] = useState<string | null>(null);

  const list = categoriesForPeriod(categories, period);
  const total = weightTotal(categories, period);

  const onAdd = async () => {
    setError(null);
    const w = Number(weight);
    if (!name || !w) return;
    if (total + w > 100) {
      setError(`Adding ${w}% would exceed 100% for ${period} (currently ${total}%).`);
      return;
    }
    const { error: err } = await supabase
      .from('grade_categories')
      .insert({ class_id: classId, name, weight: w, period });
    if (err) {
      setError(humanizeError(err));
      return;
    }
    setName('');
    setWeight('');
    onChange();
  };

  const onDelete = async (id: string) => {
    if (!confirm('Delete category and all its grade items?')) return;
    const { error: err } = await supabase.from('grade_categories').delete().eq('id', id);
    if (err) {
      setError(humanizeError(err));
      return;
    }
    onChange();
  };

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Categories</h2>
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
        <p className="mb-2 text-sm text-content-muted">
          Total weight for <span className="capitalize">{period}</span>:{' '}
          <strong
            className={
              total === 100 ? 'text-emerald-600' : total > 100 ? 'text-red-600' : 'text-amber-600'
            }
          >
            {total}%
          </strong>{' '}
          (must equal 100% before entering scores)
        </p>
        {error && (
          <div className="mb-3 rounded-xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-600 ring-1 ring-red-500/30 dark:text-red-300">
            {error}
          </div>
        )}
        <div className="grid gap-2 sm:grid-cols-[1fr,120px,auto]">
          <input
            className="input"
            placeholder="Category name (e.g., Quizzes)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            type="number"
            min="0"
            max="100"
            className="input"
            placeholder="Weight %"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
          <button onClick={() => void onAdd()} className="btn-primary">
            Add
          </button>
        </div>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="min-w-full divide-y divide-line text-sm">
          <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-content-subtle">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Weight</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {list.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-content-subtle">
                  No categories for {period} yet.
                </td>
              </tr>
            ) : (
              list.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-2 font-medium">{c.name}</td>
                  <td className="px-4 py-2">{c.weight}%</td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => void onDelete(c.id)} className="btn-danger text-xs">
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ItemsTab({
  categories,
  items,
  onChange,
}: {
  categories: DbGradeCategory[];
  items: DbGradeItem[];
  onChange: () => void;
}) {
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [maxScore, setMaxScore] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onAdd = async () => {
    setError(null);
    if (!categoryId || !title || !maxScore) return;
    const { error: err } = await supabase.from('grade_items').insert({
      category_id: categoryId,
      title,
      max_score: Number(maxScore),
      is_published: false,
    });
    if (err) {
      setError(humanizeError(err));
      return;
    }
    setTitle('');
    setMaxScore('');
    onChange();
  };

  const togglePublish = async (item: DbGradeItem) => {
    const { error: err } = await supabase
      .from('grade_items')
      .update({ is_published: !item.is_published })
      .eq('id', item.id);
    if (err) setError(humanizeError(err));
    else onChange();
  };

  const onDelete = async (id: string) => {
    if (!confirm('Delete this grade item and all its scores?')) return;
    const { error: err } = await supabase.from('grade_items').delete().eq('id', id);
    if (err) setError(humanizeError(err));
    else onChange();
  };

  if (categories.length === 0) {
    return (
      <div className="card text-sm text-content-subtle">
        Define at least one category first in the <strong>Categories</strong> tab.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <h2 className="mb-3 text-lg font-semibold">Add Grade Item</h2>
        {error && (
          <div className="mb-3 rounded-xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-600 ring-1 ring-red-500/30 dark:text-red-300">
            {error}
          </div>
        )}
        <div className="grid gap-2 sm:grid-cols-[1fr,1fr,120px,auto]">
          <select
            className="input"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                [{c.period}] {c.name} ({c.weight}%)
              </option>
            ))}
          </select>
          <input
            className="input"
            placeholder="Item title (e.g., Quiz 1)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <input
            type="number"
            min="0"
            step="0.5"
            className="input"
            placeholder="Max score"
            value={maxScore}
            onChange={(e) => setMaxScore(e.target.value)}
          />
          <button onClick={() => void onAdd()} className="btn-primary">
            Add
          </button>
        </div>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="min-w-full divide-y divide-line text-sm">
          <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-content-subtle">
            <tr>
              <th className="px-4 py-2">Category</th>
              <th className="px-4 py-2">Title</th>
              <th className="px-4 py-2">Max</th>
              <th className="px-4 py-2">Published</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-content-subtle">
                  No grade items yet.
                </td>
              </tr>
            ) : (
              items.map((i) => {
                const cat = categories.find((c) => c.id === i.category_id);
                return (
                  <tr key={i.id}>
                    <td className="px-4 py-2 text-content-muted">
                      {cat ? `[${cat.period}] ${cat.name}` : '—'}
                    </td>
                    <td className="px-4 py-2 font-medium">{i.title}</td>
                    <td className="px-4 py-2">{i.max_score}</td>
                    <td className="px-4 py-2">
                      <button
                        onClick={() => void togglePublish(i)}
                        className={i.is_published ? 'badge-success' : 'badge-warning'}
                      >
                        {i.is_published ? 'Published' : 'Hidden'}
                      </button>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button onClick={() => void onDelete(i.id)} className="btn-danger text-xs">
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface CellState {
  score: string;
  status: ScoreStatus;
  remarks: string;
  dirty: boolean;
  saving?: boolean;
  saved?: boolean;
  error?: string;
}

function GradesTab({
  roster,
  categories,
  items,
  scores,
  finalized,
  pendingRequests,
  comments,
  onChange,
}: {
  roster: { student_id: string; full_name: string; student_no: string | null }[];
  categories: DbGradeCategory[];
  items: DbGradeItem[];
  scores: DbScore[];
  finalized: DbFinalizedGrade[];
  pendingRequests: DbGradeChangeRequest[];
  comments: DbScoreComment[];
  onChange: () => void;
}) {
  const toast = useToast();
  const [commentModal, setCommentModal] = useState<{
    studentId: string;
    itemId: string;
    studentName: string;
    itemTitle: string;
    scoreId: string | null;
  } | null>(null);
  const [requestModal, setRequestModal] = useState<{
    studentId: string;
    itemId: string;
    itemTitle: string;
    studentName: string;
    maxScore: number;
    oldScore: number | null;
    proposedScore: string;
    scoreId: string;
  } | null>(null);

  const periodForItem = (itemId: string): Period | null => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return null;
    const cat = categories.find((c) => c.id === item.category_id);
    return cat?.period ?? null;
  };

  const isLocked = (studentId: string, itemId: string): boolean => {
    const period = periodForItem(itemId);
    if (!period) return false;
    return finalized.some((f) => f.student_id === studentId && f.period === period);
  };

  const findScoreId = (studentId: string, itemId: string): string | undefined =>
    scores.find((s) => s.student_id === studentId && s.grade_item_id === itemId)?.id;

  const findPendingRequest = (studentId: string, itemId: string) => {
    const scoreId = findScoreId(studentId, itemId);
    if (!scoreId) return undefined;
    return pendingRequests.find((r) => r.score_id === scoreId);
  };

  const cellCommentCount = (studentId: string, itemId: string): number => {
    const scoreId = findScoreId(studentId, itemId);
    let n = 0;
    if (scoreId) n += comments.filter((c) => c.score_id === scoreId).length;
    n += comments.filter((c) => c.grade_item_id === itemId).length;
    return n;
  };
  const initial = useMemo(() => {
    const map: Record<string, CellState> = {};
    for (const r of roster) {
      for (const i of items) {
        const key = `${r.student_id}|${i.id}`;
        const s = scores.find((sc) => sc.student_id === r.student_id && sc.grade_item_id === i.id);
        map[key] = {
          score: s?.score?.toString() ?? '',
          status: s?.status ?? 'graded',
          remarks: s?.remarks ?? '',
          dirty: false,
        };
      }
    }
    return map;
  }, [roster, items, scores]);

  const [cells, setCells] = useState<Record<string, CellState>>(initial);
  useEffect(() => {
    setCells(initial);
  }, [initial]);

  if (categories.length === 0 || items.length === 0) {
    return (
      <div className="card text-sm text-content-subtle">
        Create categories and grade items first.
      </div>
    );
  }
  if (roster.length === 0) {
    return (
      <div className="card text-sm text-content-subtle">
        No students enrolled yet. Share the class code.
      </div>
    );
  }

  const update = (key: string, patch: Partial<CellState>) => {
    setCells((c) => {
      const prev = c[key];
      const next: CellState = { ...prev, ...patch, dirty: true };
      if (patch.score !== undefined) {
        const itemId = key.split('|')[1];
        const item = items.find((i) => i.id === itemId);
        const max = Number(item?.max_score ?? 0);
        const trimmed = String(patch.score).trim();
        if (trimmed === '') {
          next.error = undefined;
        } else {
          const num = Number(trimmed);
          if (Number.isNaN(num)) next.error = 'Not a number';
          else if (num < 0) next.error = 'Must be ≥ 0';
          else if (num > max) next.error = `Max is ${max}`;
          else next.error = undefined;
        }
      }
      return { ...c, [key]: next };
    });
  };

  const saveCell = async (studentId: string, itemId: string, cell: CellState, asDraft: boolean) => {
    const key = `${studentId}|${itemId}`;
    // If the period is finalized, route this through the approval workflow
    // instead of attempting a direct write (which the lock trigger would
    // reject anyway).
    if (isLocked(studentId, itemId)) {
      const scoreId = findScoreId(studentId, itemId);
      if (!scoreId) {
        setCells((c) => ({
          ...c,
          [key]: {
            ...c[key],
            saving: false,
            error: 'Cannot create a new score for a finalized period.',
          },
        }));
        return;
      }
      const item = items.find((i) => i.id === itemId);
      const roster_entry = roster.find((r) => r.student_id === studentId);
      const oldScore = scores.find((s) => s.student_id === studentId && s.grade_item_id === itemId);
      setRequestModal({
        studentId,
        itemId,
        scoreId,
        itemTitle: item?.title ?? 'this item',
        studentName: roster_entry?.full_name ?? 'student',
        maxScore: Number(item?.max_score ?? 0),
        oldScore: oldScore?.score ?? null,
        proposedScore: cell.score,
      });
      // revert the cell flag so it's no longer dirty until the request resolves
      setCells((c) => ({ ...c, [key]: { ...c[key], saving: false, dirty: false } }));
      return;
    }
    const item = items.find((i) => i.id === itemId);
    const maxScore = Number(item?.max_score ?? 0);
    if (cell.status === 'graded' && String(cell.score).trim() !== '') {
      const num = Number(cell.score);
      if (Number.isNaN(num) || num < 0 || num > maxScore) {
        setCells((c) => ({
          ...c,
          [key]: { ...c[key], saving: false, error: `Score must be between 0 and ${maxScore}` },
        }));
        toast.error(`Score must be between 0 and ${maxScore}.`, 'Invalid score');
        return false;
      }
    }
    setCells((c) => ({ ...c, [key]: { ...c[key], saving: true, error: undefined } }));
    const scoreVal = cell.status === 'graded' ? Number(cell.score) || 0 : null;
    const { error: err } = await supabase.from('scores').upsert(
      {
        student_id: studentId,
        grade_item_id: itemId,
        score: scoreVal,
        status: cell.status,
        remarks: cell.remarks || null,
        is_draft: asDraft,
      },
      { onConflict: 'grade_item_id,student_id' },
    );
    if (err) {
      setCells((c) => ({
        ...c,
        [key]: { ...c[key], saving: false, error: humanizeError(err) },
      }));
      return false;
    }
    setCells((c) => ({
      ...c,
      [key]: { ...c[key], saving: false, dirty: false, saved: true, error: undefined },
    }));
    onChange();
    // Auto-clear the "Saved" flash after 2.5s
    setTimeout(() => {
      setCells((c) => (c[key] ? { ...c, [key]: { ...c[key], saved: false } } : c));
    }, 2500);
    return true;
  };

  const saveAll = async (asDraft: boolean) => {
    let saved = 0;
    let invalid = 0;
    let skipped = 0;
    let failed = 0;
    for (const r of roster) {
      for (const i of items) {
        const key = `${r.student_id}|${i.id}`;
        const cell = cells[key];
        if (!cell?.dirty) continue;
        if (isLocked(r.student_id, i.id)) {
          skipped++;
          continue;
        }
        if (cell.status === 'graded' && String(cell.score).trim() !== '') {
          const num = Number(cell.score);
          const max = Number(i.max_score);
          if (Number.isNaN(num) || num < 0 || num > max) {
            invalid++;
            setCells((c) => ({
              ...c,
              [key]: { ...c[key], error: `Score must be between 0 and ${max}` },
            }));
            continue;
          }
        }
        const ok = await saveCell(r.student_id, i.id, cell, asDraft);
        if (ok) saved++;
        else failed++;
      }
    }
    if (saved + invalid + failed + skipped === 0) {
      toast.info('No unsaved changes.');
      return;
    }
    if (invalid > 0 || failed > 0) {
      const parts: string[] = [];
      if (saved > 0) parts.push(`${saved} ${asDraft ? 'saved as draft' : 'published'}`);
      if (invalid > 0) parts.push(`${invalid} blocked (over max)`);
      if (failed > 0) parts.push(`${failed} failed`);
      if (skipped > 0) parts.push(`${skipped} locked`);
      toast.error(parts.join(' · '), 'Some scores not saved');
    } else {
      const verb = asDraft ? 'saved as draft' : 'published';
      const suffix = skipped > 0 ? ` (${skipped} locked, skipped)` : '';
      toast.success(`${saved} score${saved === 1 ? '' : 's'} ${verb}${suffix}.`);
    }
  };

  const unpublishedItems = items.filter((i) => !i.is_published);

  return (
    <div className="space-y-3">
      {unpublishedItems.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-500/10 px-3 py-3 text-sm text-amber-700 dark:text-amber-300 dark:text-amber-200">
          <strong>{unpublishedItems.length}</strong> grade item
          {unpublishedItems.length === 1 ? ' is' : 's are'} still hidden from students (
          {unpublishedItems.map((i) => i.title).join(', ')}). Scores you save here are stored, but
          students won't see them until you publish each item in the <strong>Grade Items</strong>{' '}
          tab.
        </div>
      )}
      <div className="flex justify-end gap-2">
        <button onClick={() => void saveAll(true)} className="btn-secondary text-xs">
          Save all as Draft
        </button>
        <button onClick={() => void saveAll(false)} className="btn-primary text-xs">
          Save & Publish all
        </button>
      </div>
      <div className="card overflow-x-auto p-0">
        <table className="min-w-full divide-y divide-line text-sm">
          <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-content-subtle">
            <tr>
              <th className="sticky left-0 bg-surface-2 px-4 py-2">Student</th>
              {items.map((i) => {
                const cat = categories.find((c) => c.id === i.category_id);
                return (
                  <th key={i.id} className="px-3 py-2 text-center">
                    <div className="font-semibold normal-case">{i.title}</div>
                    <div className="text-xs text-content-subtle">
                      {cat?.name} · /{i.max_score} · {i.is_published ? 'pub' : 'draft'}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {roster.map((r) => (
              <tr key={r.student_id}>
                <td className="sticky left-0 bg-surface px-4 py-2 font-medium">{r.full_name}</td>
                {items.map((i) => {
                  const key = `${r.student_id}|${i.id}`;
                  const cell = cells[key];
                  const locked = isLocked(r.student_id, i.id);
                  const pending = findPendingRequest(r.student_id, i.id);
                  const commentCount = cellCommentCount(r.student_id, i.id);
                  return (
                    <td key={i.id} className="px-2 py-2">
                      <div className="flex flex-col gap-1">
                        <input
                          type="number"
                          min={0}
                          max={i.max_score}
                          step="0.5"
                          disabled={cell?.status !== 'graded'}
                          className={`input h-8 text-center ${
                            cell?.error
                              ? 'ring-2 ring-red-500/60'
                              : cell?.dirty
                                ? 'ring-2 ring-amber-500/30'
                                : ''
                          } ${locked ? 'border-amber-300 bg-amber-500/10' : ''}`}
                          value={cell?.score ?? ''}
                          onChange={(e) => update(key, { score: e.target.value })}
                          onBlur={() =>
                            cell?.dirty && !cell?.error
                              ? void saveCell(r.student_id, i.id, cell, false)
                              : undefined
                          }
                          title={
                            cell?.error
                              ? cell.error
                              : locked
                                ? 'Period finalized — changes require approval'
                                : undefined
                          }
                        />
                        <select
                          className="input h-7 text-xs"
                          value={cell?.status ?? 'graded'}
                          onChange={(e) => update(key, { status: e.target.value as ScoreStatus })}
                          disabled={locked}
                        >
                          <option value="graded">graded</option>
                          <option value="missing">missing</option>
                          <option value="late">late</option>
                          <option value="excused">excused</option>
                        </select>
                        <button
                          type="button"
                          onClick={() =>
                            setCommentModal({
                              studentId: r.student_id,
                              itemId: i.id,
                              studentName: r.full_name,
                              itemTitle: i.title,
                              scoreId: findScoreId(r.student_id, i.id) ?? null,
                            })
                          }
                          className={`flex items-center justify-center gap-1 rounded px-1 text-xs transition ${
                            commentCount > 0
                              ? 'text-brand-700 hover:bg-brand-500/10'
                              : 'text-content-subtle hover:bg-surface-3'
                          }`}
                          title={
                            commentCount > 0
                              ? `${commentCount} comment${commentCount === 1 ? '' : 's'}`
                              : 'Add a comment'
                          }
                        >
                          💬 {commentCount > 0 ? commentCount : ''}
                        </button>
                        {pending ? (
                          <div
                            className="text-xs font-medium text-amber-700"
                            title={`Pending change to ${pending.new_score} — ${pending.reason}`}
                          >
                            ⏳ Pending review
                          </div>
                        ) : cell?.error ? (
                          <div className="text-xs text-red-600">{cell.error}</div>
                        ) : cell?.saving ? (
                          <div className="text-xs text-content-subtle">Saving…</div>
                        ) : cell?.saved ? (
                          <div className="text-xs font-medium text-emerald-600">✓ Saved</div>
                        ) : locked ? (
                          <div className="text-xs font-medium text-amber-700">🔒 Locked</div>
                        ) : null}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-content-subtle">
        Tip: cells with amber border are unsaved. Score saves on blur. Use the buttons at the top to
        bulk save as draft or publish. Cells in a finalized period are locked — editing them opens a
        request-change dialog that goes to the Department Head for approval.
      </p>

      {requestModal && (
        <RequestChangeModal
          {...requestModal}
          onClose={() => setRequestModal(null)}
          onSubmitted={() => {
            setRequestModal(null);
            onChange();
          }}
        />
      )}

      {commentModal && (
        <CommentsModal
          {...commentModal}
          comments={comments.filter(
            (c) =>
              (commentModal.scoreId && c.score_id === commentModal.scoreId) ||
              c.grade_item_id === commentModal.itemId,
          )}
          onClose={() => setCommentModal(null)}
          onChanged={() => {
            onChange();
          }}
        />
      )}
    </div>
  );
}

function CommentsModal({
  studentName,
  itemTitle,
  scoreId,
  itemId,
  comments,
  onClose,
  onChanged,
}: {
  studentId: string;
  itemId: string;
  studentName: string;
  itemTitle: string;
  scoreId: string | null;
  comments: DbScoreComment[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const { user } = useAuth();
  const [body, setBody] = useState('');
  const [target, setTarget] = useState<'score' | 'item'>(scoreId ? 'score' : 'item');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<DbScoreComment | null>(null);
  const [editBody, setEditBody] = useState('');

  const sorted = [...comments].sort((a, b) => a.created_at.localeCompare(b.created_at));

  const onAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!body.trim() || !user) return;
    setBusy(true);
    setError(null);
    const payload: {
      author_id: string;
      body: string;
      score_id?: string;
      grade_item_id?: string;
    } = { author_id: user.id, body: body.trim() };
    if (target === 'score' && scoreId) {
      payload.score_id = scoreId;
    } else {
      payload.grade_item_id = itemId;
    }
    const { error: err } = await supabase.from('score_comments').insert(payload);
    setBusy(false);
    if (err) {
      setError(humanizeError(err));
      return;
    }
    setBody('');
    onChanged();
  };

  const onSaveEdit = async (c: DbScoreComment) => {
    if (!editBody.trim()) return;
    const { error: err } = await supabase
      .from('score_comments')
      .update({ body: editBody.trim() })
      .eq('id', c.id);
    if (err) {
      setError(humanizeError(err));
      return;
    }
    setEditing(null);
    onChanged();
  };

  const onDelete = async (c: DbScoreComment) => {
    if (!confirm('Delete this comment?')) return;
    const { error: err } = await supabase.from('score_comments').delete().eq('id', c.id);
    if (err) {
      setError(humanizeError(err));
      return;
    }
    onChanged();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in md:left-[var(--sidebar-w)]">
      <div className="card w-full max-w-md space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Comments</h3>
          <p className="text-xs text-content-subtle">
            {studentName} — {itemTitle}
          </p>
        </div>

        {error && (
          <div className="rounded-xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-600 ring-1 ring-red-500/30 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="max-h-64 space-y-2 overflow-y-auto">
          {sorted.length === 0 ? (
            <p className="text-sm text-content-subtle">No comments yet.</p>
          ) : (
            sorted.map((c) => {
              const mine = c.author_id === user?.id;
              const isEditing = editing?.id === c.id;
              return (
                <div
                  key={c.id}
                  className="rounded-md border border-line bg-surface-2 px-3 py-2 text-sm"
                >
                  <div className="mb-1 flex items-center justify-between text-xs text-content-subtle">
                    <span>
                      {c.grade_item_id ? 'Class-wide' : 'For this student'} ·{' '}
                      {new Date(c.created_at).toLocaleString()}
                      {c.updated_at !== c.created_at && ' · edited'}
                    </span>
                    {mine && !isEditing && (
                      <span className="flex gap-2">
                        <button
                          onClick={() => {
                            setEditing(c);
                            setEditBody(c.body);
                          }}
                          className="text-brand-600 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => void onDelete(c)}
                          className="text-red-600 hover:underline"
                        >
                          Delete
                        </button>
                      </span>
                    )}
                  </div>
                  {isEditing ? (
                    <div className="space-y-2">
                      <textarea
                        rows={2}
                        className="input"
                        value={editBody}
                        onChange={(e) => setEditBody(e.target.value)}
                      />
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setEditing(null)} className="btn-secondary text-xs">
                          Cancel
                        </button>
                        <button onClick={() => void onSaveEdit(c)} className="btn-primary text-xs">
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap text-content-muted">{c.body}</div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <form onSubmit={onAdd} className="space-y-2">
          {scoreId && (
            <div className="flex gap-3 text-xs">
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  name="target"
                  value="score"
                  checked={target === 'score'}
                  onChange={() => setTarget('score')}
                />
                For this student
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  name="target"
                  value="item"
                  checked={target === 'item'}
                  onChange={() => setTarget('item')}
                />
                Class-wide
              </label>
            </div>
          )}
          {!scoreId && (
            <p className="text-xs text-amber-700">
              No score saved yet for this cell — any comment will be visible to the whole class.
            </p>
          )}
          <textarea
            rows={3}
            className="input"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add a comment…"
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn-secondary">
              Close
            </button>
            <button disabled={busy || !body.trim()} className="btn-primary">
              {busy ? 'Posting…' : 'Post'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RequestChangeModal({
  scoreId,
  itemTitle,
  studentName,
  maxScore,
  oldScore,
  proposedScore,
  onClose,
  onSubmitted,
}: {
  studentId: string;
  itemId: string;
  scoreId: string;
  itemTitle: string;
  studentName: string;
  maxScore: number;
  oldScore: number | null;
  proposedScore: string;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [newScore, setNewScore] = useState(proposedScore || (oldScore?.toString() ?? ''));
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('A reason is required.');
      return;
    }
    const n = Number(newScore);
    if (Number.isNaN(n) || n < 0 || n > maxScore) {
      setError(`Score must be between 0 and ${maxScore}.`);
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.rpc('request_grade_change', {
      p_score_id: scoreId,
      p_new_score: n,
      p_reason: reason.trim(),
    });
    setBusy(false);
    if (err) {
      setError(humanizeError(err));
      return;
    }
    onSubmitted();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in md:left-[var(--sidebar-w)]">
      <form onSubmit={onSubmit} className="card w-full max-w-md space-y-4">
        <h3 className="text-lg font-semibold">Request grade change</h3>
        <div className="rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300 dark:text-amber-200">
          This period is finalized. Your change will be sent to the Department Head for approval.
          The student's grade won't update until the request is approved.
        </div>
        <div className="text-sm text-content-muted">
          <div>
            <strong>{studentName}</strong> — {itemTitle}
          </div>
          <div className="text-xs text-content-subtle">
            Current score: {oldScore ?? '—'} / {maxScore}
          </div>
        </div>
        {error && (
          <div className="rounded-xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-600 ring-1 ring-red-500/30 dark:text-red-300">
            {error}
          </div>
        )}
        <div>
          <label className="label">New score</label>
          <input
            required
            type="number"
            min={0}
            max={maxScore}
            step="0.5"
            className="input"
            value={newScore}
            onChange={(e) => setNewScore(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Reason for change *</label>
          <textarea
            required
            rows={3}
            className="input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain why the original score should be changed."
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary" disabled={busy}>
            Cancel
          </button>
          <button disabled={busy} className="btn-primary">
            {busy ? 'Submitting…' : 'Submit request'}
          </button>
        </div>
      </form>
    </div>
  );
}

function AttendanceTab({
  classId,
  roster,
}: {
  classId: string;
  roster: { student_id: string; full_name: string; student_no: string | null }[];
}) {
  const { user } = useAuth();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [records, setRecords] = useState<DbAttendance[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchForDate = useCallback(
    async (d: string) => {
      setLoading(true);
      setError(null);
      const { data, error: err } = await supabase
        .from('attendance')
        .select('*')
        .eq('class_id', classId)
        .eq('attended_at', d);
      setLoading(false);
      if (err) {
        setError(humanizeError(err));
        return;
      }
      setRecords((data as DbAttendance[]) ?? []);
    },
    [classId],
  );

  useEffect(() => {
    void fetchForDate(date);
  }, [date, fetchForDate]);

  const mark = async (studentId: string, status: AttendanceStatus) => {
    if (!user) return;
    setSavingId(studentId);
    setError(null);
    const existing = records.find((r) => r.student_id === studentId);
    if (existing) {
      const { error: err } = await supabase
        .from('attendance')
        .update({ status, recorded_by: user.id })
        .eq('id', existing.id);
      if (err) setError(humanizeError(err));
    } else {
      const { error: err } = await supabase.from('attendance').insert({
        class_id: classId,
        student_id: studentId,
        attended_at: date,
        status,
        recorded_by: user.id,
      });
      if (err) setError(humanizeError(err));
    }
    setSavingId(null);
    await fetchForDate(date);
  };

  const bulkMark = async (status: AttendanceStatus) => {
    if (!user) return;
    if (!confirm(`Mark all ${roster.length} students as ${status} for ${date}?`)) return;
    setLoading(true);
    setError(null);
    // Upsert one row per student
    const payload = roster.map((r) => ({
      class_id: classId,
      student_id: r.student_id,
      attended_at: date,
      status,
      recorded_by: user.id,
    }));
    const { error: err } = await supabase
      .from('attendance')
      .upsert(payload, { onConflict: 'class_id,student_id,attended_at' });
    if (err) setError(humanizeError(err));
    await fetchForDate(date);
  };

  const statusFor = (studentId: string) => records.find((r) => r.student_id === studentId)?.status;

  if (roster.length === 0) {
    return (
      <div className="card text-sm text-content-subtle">
        No students enrolled yet. Share the class code.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-end gap-3">
        <div>
          <label className="label">Date</label>
          <input
            type="date"
            className="input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            max={new Date().toISOString().slice(0, 10)}
          />
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <button onClick={() => void bulkMark('present')} className="btn-secondary text-xs">
            Mark all Present
          </button>
          <button onClick={() => void bulkMark('absent')} className="btn-secondary text-xs">
            Mark all Absent
          </button>
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
              <th className="px-4 py-2">Student #</th>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {loading ? (
              <SkeletonTableRows rows={4} cols={3} />
            ) : (
              roster.map((r) => {
                const status = statusFor(r.student_id);
                const saving = savingId === r.student_id;
                return (
                  <tr key={r.student_id}>
                    <td className="px-4 py-2 font-mono text-content-muted">
                      {r.student_no ?? '—'}
                    </td>
                    <td className="px-4 py-2 font-medium">{r.full_name}</td>
                    <td className="px-4 py-2">
                      <div className="flex justify-center gap-1">
                        {(['present', 'late', 'absent', 'excused'] as AttendanceStatus[]).map(
                          (s) => (
                            <button
                              key={s}
                              onClick={() => void mark(r.student_id, s)}
                              disabled={saving}
                              className={`rounded px-2 py-1 text-xs font-medium transition ${
                                status === s
                                  ? statusButtonClass(s, true)
                                  : statusButtonClass(s, false)
                              }`}
                            >
                              {s}
                            </button>
                          ),
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-content-subtle">
        Tip: pick a date, then click a status per student. Use the bulk buttons to mark the whole
        class quickly.
      </p>
    </div>
  );
}

function statusButtonClass(status: AttendanceStatus, active: boolean): string {
  if (!active) return 'bg-surface-3 text-content-muted hover:bg-surface-3';
  if (status === 'present')
    return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/30';
  if (status === 'late')
    return 'bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/30';
  if (status === 'absent')
    return 'bg-red-500/15 text-red-700 dark:text-red-300 ring-1 ring-red-500/30';
  return 'bg-surface-3 text-content ring-1 ring-line';
}

function FinalizeTab({ classId, onChange }: { classId: string; onChange: () => void }) {
  const [busy, setBusy] = useState<Period | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const finalize = async (period: Period) => {
    if (
      !confirm(
        `Finalize ${period}? This locks all scores for ${period} and cannot be undone (except by an admin).`,
      )
    )
      return;
    setBusy(period);
    setError(null);
    setResult(null);
    const { data, error: err } = await supabase.rpc('finalize_period', {
      p_class_id: classId,
      p_period: period,
    });
    setBusy(null);
    if (err) {
      setError(humanizeError(err));
      return;
    }
    setResult(`Locked grades for ${data ?? 0} students.`);
    onChange();
  };

  return (
    <div className="card space-y-3">
      <h2 className="text-lg font-semibold">Finalize Grades</h2>
      <p className="text-sm text-content-muted">
        Locking a period takes a snapshot of every enrolled student's computed grade and prevents
        further edits to scores in that period.
      </p>
      {error && (
        <div className="rounded-xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-600 ring-1 ring-red-500/30 dark:text-red-300">
          {error}
        </div>
      )}
      {result && (
        <div className="rounded-xl bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-600 ring-1 ring-emerald-500/30 dark:text-emerald-300">
          {result}
        </div>
      )}
      <div className="flex gap-2">
        <button
          disabled={busy !== null}
          onClick={() => void finalize('midterm')}
          className="btn-primary"
        >
          {busy === 'midterm' ? 'Locking…' : 'Finalize Midterm'}
        </button>
        <button
          disabled={busy !== null}
          onClick={() => void finalize('finals')}
          className="btn-primary"
        >
          {busy === 'finals' ? 'Locking…' : 'Finalize Finals'}
        </button>
      </div>
    </div>
  );
}

function AppealsTab({ classId }: { classId: string }) {
  const { appeals, loading, error, refresh } = useClassAppeals(classId);
  const [filter, setFilter] = useState<AppealStatus | 'all'>('pending');
  const [resolving, setResolving] = useState<AppealRow | null>(null);

  const filtered = appeals.filter((a) => filter === 'all' || a.status === filter);
  const counts = {
    pending: appeals.filter((a) => a.status === 'pending').length,
    approved: appeals.filter((a) => a.status === 'approved').length,
    rejected: appeals.filter((a) => a.status === 'rejected').length,
  };

  return (
    <div className="space-y-3">
      <div className="card flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">Filter:</span>
        {(['pending', 'approved', 'rejected', 'all'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-md px-3 py-1 text-xs capitalize ${
              filter === s ? 'bg-brand-600 text-white' : 'bg-surface-3 text-content-muted'
            }`}
          >
            {s} {s !== 'all' && `(${counts[s as keyof typeof counts]})`}
          </button>
        ))}
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
          No {filter === 'all' ? '' : filter} appeals.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((a) => (
            <div key={a.id} className="card">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="text-sm text-content-subtle">
                    {new Date(a.created_at).toLocaleString()}
                  </div>
                  <div className="mt-1 font-semibold">
                    {a.student_name}{' '}
                    <span className="text-xs font-normal text-content-subtle">
                      ({a.student_no ?? '—'})
                    </span>
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
                      <strong>Your response:</strong> {a.teacher_response}
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
        <ResolveAppealModal
          appeal={resolving}
          onClose={() => setResolving(null)}
          onResolved={() => {
            setResolving(null);
            refresh();
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

function ResolveAppealModal({
  appeal,
  onClose,
  onResolved,
}: {
  appeal: AppealRow;
  onClose: () => void;
  onResolved: () => void;
}) {
  const [response, setResponse] = useState('');
  const [newScore, setNewScore] = useState<string>(
    appeal.score_value !== null ? String(appeal.score_value) : '',
  );
  const [updateScore, setUpdateScore] = useState(true);
  const [busy, setBusy] = useState<'approved' | 'rejected' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resolve = async (e: FormEvent, status: 'approved' | 'rejected') => {
    e.preventDefault();
    setBusy(status);
    setError(null);

    // If approving with a new score: update the score first, then mark appeal resolved
    if (status === 'approved' && updateScore && newScore !== '') {
      const parsedScore = Number(newScore);
      if (Number.isNaN(parsedScore) || parsedScore < 0 || parsedScore > appeal.max_score) {
        setError(`Score must be between 0 and ${appeal.max_score}.`);
        setBusy(null);
        return;
      }
      const { error: scoreErr } = await supabase
        .from('scores')
        .update({ score: parsedScore })
        .eq('id', appeal.score_id);
      if (scoreErr) {
        setError(humanizeError(scoreErr));
        setBusy(null);
        return;
      }
    }

    const { error: err } = await supabase
      .from('appeals')
      .update({
        status,
        teacher_response: response.trim() || null,
      })
      .eq('id', appeal.id);
    setBusy(null);
    if (err) {
      setError(humanizeError(err));
      return;
    }
    onResolved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in md:left-[var(--sidebar-w)]">
      <form className="card w-full max-w-md space-y-4" onSubmit={(e) => e.preventDefault()}>
        <h3 className="text-lg font-semibold">Review Appeal</h3>
        <div className="rounded-md bg-surface-2 px-3 py-2 text-sm">
          <div>
            Student: <strong>{appeal.student_name}</strong>
          </div>
          <div>
            Item: <strong>{appeal.item_title}</strong> — current score:{' '}
            <strong>
              {appeal.score_value ?? '—'} / {appeal.max_score}
            </strong>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-content-muted">{appeal.reason}</p>
        </div>

        {error && (
          <div className="rounded-xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-600 ring-1 ring-red-500/30 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="rounded-md border border-amber-200 bg-amber-500/10 px-3 py-3">
          <label className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-300 dark:text-amber-200">
            <input
              type="checkbox"
              checked={updateScore}
              onChange={(e) => setUpdateScore(e.target.checked)}
            />
            Also update the score (applies only when approving)
          </label>
          {updateScore && (
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={appeal.max_score}
                step="0.5"
                className="input w-24 text-right"
                value={newScore}
                onChange={(e) => setNewScore(e.target.value)}
                placeholder="0"
              />
              <span className="text-sm text-content-muted">/ {appeal.max_score}</span>
            </div>
          )}
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
            The audit log will record both the score change and the appeal resolution.
          </p>
        </div>

        <div>
          <label className="label">Your response (optional)</label>
          <textarea
            rows={3}
            className="input"
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            placeholder="Tell the student why you approved/rejected..."
          />
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={(e) => void resolve(e, 'rejected')}
            className="btn-danger"
          >
            {busy === 'rejected' ? 'Rejecting…' : 'Reject'}
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={(e) => void resolve(e, 'approved')}
            className="btn-primary"
          >
            {busy === 'approved' ? 'Approving…' : 'Approve'}
          </button>
        </div>
      </form>
    </div>
  );
}
