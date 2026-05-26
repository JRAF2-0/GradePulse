import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import {
  useClassDetail,
  categoriesForPeriod,
  weightTotal,
} from '@/hooks/useClassDetail';
import { useClassAppeals, type AppealRow } from '@/hooks/useAppeals';
import { humanizeError } from '@/utils/errorMessage';
import type {
  AppealStatus,
  DbGradeCategory,
  DbGradeItem,
  DbScore,
  Period,
  ScoreStatus,
} from '@/types/database';

type Tab = 'roster' | 'categories' | 'items' | 'grades' | 'finalize' | 'appeals';

export function TeacherClassDetails() {
  const { classId } = useParams();
  const navigate = useNavigate();
  const { data, loading, error, refresh } = useClassDetail(classId);
  const [tab, setTab] = useState<Tab>('roster');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  if (loading) return <div className="card text-sm text-slate-500">Loading…</div>;
  if (error || !data)
    return (
      <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
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
    { key: 'appeals', label: 'Appeals' },
    { key: 'finalize', label: 'Finalize' },
  ];

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="font-mono text-xs uppercase text-slate-500">
            {data.class.subject.code}
          </div>
          <h1 className="text-2xl font-bold">{data.class.subject.title}</h1>
          <div className="mt-1 flex flex-wrap gap-3 text-sm text-slate-600">
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
          className="btn-secondary text-xs text-red-600 hover:bg-red-50"
        >
          Delete class
        </button>
      </header>

      <nav className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`whitespace-nowrap px-4 py-2 text-sm font-medium transition ${
              tab === t.key
                ? 'border-b-2 border-brand-600 text-brand-700'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'roster' && <RosterTab roster={data.roster} />}
      {tab === 'categories' && (
        <CategoriesTab classId={data.class.id} categories={data.categories} onChange={refresh} />
      )}
      {tab === 'items' && (
        <ItemsTab
          categories={data.categories}
          items={data.items}
          onChange={refresh}
        />
      )}
      {tab === 'grades' && (
        <GradesTab
          roster={data.roster}
          categories={data.categories}
          items={data.items}
          scores={data.scores}
          onChange={refresh}
        />
      )}
      {tab === 'appeals' && <AppealsTab classId={data.class.id} />}
      {tab === 'finalize' && (
        <FinalizeTab classId={data.class.id} onChange={refresh} />
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="card w-full max-w-md space-y-4">
            <h3 className="text-lg font-semibold text-red-700">Delete this class?</h3>
            <div className="space-y-2 text-sm text-slate-700">
              <p>
                You're about to permanently delete{' '}
                <strong>
                  {data.class.subject.code} — {data.class.subject.title}
                </strong>
                {data.class.section && <> (Section {data.class.section})</>}.
              </p>
              <p>This will also delete:</p>
              <ul className="list-inside list-disc text-slate-600">
                <li>{data.roster.length} student enrollment(s)</li>
                <li>{data.categories.length} grade categor(y/ies)</li>
                <li>{data.items.length} grade item(s)</li>
                <li>{data.scores.length} score record(s)</li>
                <li>Any finalized grades and appeals for this class</li>
              </ul>
              <p className="text-xs text-slate-500">
                Audit log entries are preserved. This cannot be undone.
              </p>
            </div>
            {deleteError && (
              <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
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

function RosterTab({ roster }: { roster: { student_id: string; full_name: string; student_no: string | null }[] }) {
  return (
    <div className="card overflow-x-auto p-0">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-2">Student #</th>
            <th className="px-4 py-2">Name</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {roster.length === 0 ? (
            <tr>
              <td colSpan={2} className="px-4 py-6 text-center text-slate-500">
                No students enrolled yet. Share the class code so students can join.
              </td>
            </tr>
          ) : (
            roster.map((r) => (
              <tr key={r.student_id}>
                <td className="px-4 py-2 font-mono text-slate-600">{r.student_no ?? '—'}</td>
                <td className="px-4 py-2 font-medium">{r.full_name}</td>
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
          <div className="flex gap-1 rounded-md bg-slate-100 p-1 text-sm">
            {(['midterm', 'finals'] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`rounded px-3 py-1 capitalize ${
                  period === p ? 'bg-white shadow-sm font-medium' : 'text-slate-600'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <p className="mb-2 text-sm text-slate-600">
          Total weight for <span className="capitalize">{period}</span>:{' '}
          <strong
            className={
              total === 100
                ? 'text-emerald-600'
                : total > 100
                  ? 'text-red-600'
                  : 'text-amber-600'
            }
          >
            {total}%
          </strong>{' '}
          (must equal 100% before entering scores)
        </p>
        {error && (
          <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
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
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Weight</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-slate-500">
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
      <div className="card text-sm text-slate-500">
        Define at least one category first in the <strong>Categories</strong> tab.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <h2 className="mb-3 text-lg font-semibold">Add Grade Item</h2>
        {error && (
          <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
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
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2">Category</th>
              <th className="px-4 py-2">Title</th>
              <th className="px-4 py-2">Max</th>
              <th className="px-4 py-2">Published</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  No grade items yet.
                </td>
              </tr>
            ) : (
              items.map((i) => {
                const cat = categories.find((c) => c.id === i.category_id);
                return (
                  <tr key={i.id}>
                    <td className="px-4 py-2 text-slate-600">
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
  onChange,
}: {
  roster: { student_id: string; full_name: string; student_no: string | null }[];
  categories: DbGradeCategory[];
  items: DbGradeItem[];
  scores: DbScore[];
  onChange: () => void;
}) {
  const initial = useMemo(() => {
    const map: Record<string, CellState> = {};
    for (const r of roster) {
      for (const i of items) {
        const key = `${r.student_id}|${i.id}`;
        const s = scores.find(
          (sc) => sc.student_id === r.student_id && sc.grade_item_id === i.id,
        );
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
      <div className="card text-sm text-slate-500">
        Create categories and grade items first.
      </div>
    );
  }
  if (roster.length === 0) {
    return (
      <div className="card text-sm text-slate-500">
        No students enrolled yet. Share the class code.
      </div>
    );
  }

  const update = (key: string, patch: Partial<CellState>) => {
    setCells((c) => ({ ...c, [key]: { ...c[key], ...patch, dirty: true } }));
  };

  const saveCell = async (
    studentId: string,
    itemId: string,
    cell: CellState,
    asDraft: boolean,
  ) => {
    const key = `${studentId}|${itemId}`;
    setCells((c) => ({ ...c, [key]: { ...c[key], saving: true, error: undefined } }));
    const scoreVal = cell.status === 'graded' ? Number(cell.score) || 0 : null;
    const { error: err } = await supabase
      .from('scores')
      .upsert(
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
      return;
    }
    setCells((c) => ({
      ...c,
      [key]: { ...c[key], saving: false, dirty: false, saved: true, error: undefined },
    }));
    onChange();
    // Auto-clear the "Saved" flash after 2.5s
    setTimeout(() => {
      setCells((c) =>
        c[key] ? { ...c, [key]: { ...c[key], saved: false } } : c,
      );
    }, 2500);
  };

  const saveAll = async (asDraft: boolean) => {
    for (const r of roster) {
      for (const i of items) {
        const key = `${r.student_id}|${i.id}`;
        const cell = cells[key];
        if (cell?.dirty) {
          await saveCell(r.student_id, i.id, cell, asDraft);
        }
      }
    }
  };

  const unpublishedItems = items.filter((i) => !i.is_published);

  return (
    <div className="space-y-3">
      {unpublishedItems.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
          <strong>{unpublishedItems.length}</strong> grade item
          {unpublishedItems.length === 1 ? ' is' : 's are'} still hidden from students (
          {unpublishedItems.map((i) => i.title).join(', ')}). Scores you save here are stored,
          but students won't see them until you publish each item in the{' '}
          <strong>Grade Items</strong> tab.
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
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="sticky left-0 bg-slate-50 px-4 py-2">Student</th>
              {items.map((i) => {
                const cat = categories.find((c) => c.id === i.category_id);
                return (
                  <th key={i.id} className="px-3 py-2 text-center">
                    <div className="font-semibold normal-case">{i.title}</div>
                    <div className="text-[10px] text-slate-400">
                      {cat?.name} · /{i.max_score} · {i.is_published ? 'pub' : 'draft'}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {roster.map((r) => (
              <tr key={r.student_id}>
                <td className="sticky left-0 bg-white px-4 py-2 font-medium">
                  {r.full_name}
                </td>
                {items.map((i) => {
                  const key = `${r.student_id}|${i.id}`;
                  const cell = cells[key];
                  return (
                    <td key={i.id} className="px-2 py-2">
                      <div className="flex flex-col gap-1">
                        <input
                          type="number"
                          min={0}
                          max={i.max_score}
                          step="0.5"
                          disabled={cell?.status !== 'graded'}
                          className={`input h-8 text-center ${cell?.dirty ? 'ring-2 ring-amber-300' : ''}`}
                          value={cell?.score ?? ''}
                          onChange={(e) => update(key, { score: e.target.value })}
                          onBlur={() => cell?.dirty && void saveCell(r.student_id, i.id, cell, false)}
                        />
                        <select
                          className="input h-7 text-xs"
                          value={cell?.status ?? 'graded'}
                          onChange={(e) =>
                            update(key, { status: e.target.value as ScoreStatus })
                          }
                        >
                          <option value="graded">graded</option>
                          <option value="missing">missing</option>
                          <option value="late">late</option>
                          <option value="excused">excused</option>
                        </select>
                        {cell?.error ? (
                          <div className="text-[10px] text-red-600">{cell.error}</div>
                        ) : cell?.saving ? (
                          <div className="text-[10px] text-slate-400">Saving…</div>
                        ) : cell?.saved ? (
                          <div className="text-[10px] font-medium text-emerald-600">
                            ✓ Saved
                          </div>
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
      <p className="text-xs text-slate-500">
        Tip: cells with amber border are unsaved. Score saves on blur. Use the buttons at the
        top to bulk save as draft or publish.
      </p>
    </div>
  );
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
      <p className="text-sm text-slate-600">
        Locking a period takes a snapshot of every enrolled student's computed grade and
        prevents further edits to scores in that period.
      </p>
      {error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}
      {result && (
        <div className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
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
              filter === s ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-700'
            }`}
          >
            {s} {s !== 'all' && `(${counts[s as keyof typeof counts]})`}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="card text-sm text-slate-500">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="card text-sm text-slate-500">
          No {filter === 'all' ? '' : filter} appeals.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((a) => (
            <div key={a.id} className="card">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="text-sm text-slate-500">
                    {new Date(a.created_at).toLocaleString()}
                  </div>
                  <div className="mt-1 font-semibold">
                    {a.student_name}{' '}
                    <span className="text-xs font-normal text-slate-500">
                      ({a.student_no ?? '—'})
                    </span>
                  </div>
                  <div className="mt-1 text-sm">
                    Disputing <strong>{a.item_title}</strong> — score:{' '}
                    <span className="font-mono">
                      {a.score_value ?? '—'} / {a.max_score}
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    {a.reason}
                  </p>
                  {a.teacher_response && (
                    <p className="mt-2 rounded-md bg-brand-50 px-3 py-2 text-sm text-brand-900">
                      <strong>Your response:</strong> {a.teacher_response}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <AppealStatusBadge status={a.status} />
                  {a.status === 'pending' && (
                    <button
                      onClick={() => setResolving(a)}
                      className="btn-primary text-xs"
                    >
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <form className="card w-full max-w-md space-y-4" onSubmit={(e) => e.preventDefault()}>
        <h3 className="text-lg font-semibold">Review Appeal</h3>
        <div className="rounded-md bg-slate-50 px-3 py-2 text-sm">
          <div>
            Student: <strong>{appeal.student_name}</strong>
          </div>
          <div>
            Item: <strong>{appeal.item_title}</strong> — current score:{' '}
            <strong>
              {appeal.score_value ?? '—'} / {appeal.max_score}
            </strong>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-slate-700">{appeal.reason}</p>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}

        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-3">
          <label className="flex items-center gap-2 text-sm font-medium text-amber-900">
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
              <span className="text-sm text-slate-700">/ {appeal.max_score}</span>
            </div>
          )}
          <p className="mt-2 text-xs text-amber-800">
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
