import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { humanizeError } from '@/utils/errorMessage';
import type { DbClass } from '@/types/database';

interface ClassRow extends DbClass {
  subject_code: string;
  subject_title: string;
  teacher_name: string;
  enrollment_count: number;
}

export function AdminClasses() {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('classes')
      .select(
        `*,
        subject:subjects(code, title),
        teacher:teachers(user:users(full_name)),
        enrollments(count)`,
      )
      .order('created_at', { ascending: false });
    setLoading(false);
    if (err) {
      setError(humanizeError(err));
      return;
    }
    type Row = DbClass & {
      subject: { code: string; title: string } | null;
      teacher: { user: { full_name: string } | null } | null;
      enrollments: { count: number }[] | null;
    };
    setClasses(
      ((data as Row[] | null) ?? []).map<ClassRow>((c) => ({
        ...c,
        subject_code: c.subject?.code ?? '—',
        subject_title: c.subject?.title ?? '—',
        teacher_name: c.teacher?.user?.full_name ?? 'Unknown',
        enrollment_count: c.enrollments?.[0]?.count ?? 0,
      })),
    );
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const filtered = classes.filter((c) => showArchived || !c.is_archived);
  const activeCount = classes.filter((c) => !c.is_archived).length;
  const archivedCount = classes.filter((c) => c.is_archived).length;

  const onDelete = async (cls: ClassRow) => {
    if (
      !confirm(
        `Delete class "${cls.subject_code}"? This permanently removes all enrollments, categories, grade items, scores, finalized grades, and appeals for this class. Audit log entries are preserved. This cannot be undone.`,
      )
    ) {
      return;
    }
    const { error: err } = await supabase.from('classes').delete().eq('id', cls.id);
    if (err) {
      setError(humanizeError(err));
      return;
    }
    void fetchAll();
  };

  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Classes</h1>
          <p className="text-sm text-content-muted">
            All classes across the system. {activeCount} active
            {archivedCount > 0 && ` · ${archivedCount} archived`}.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-content-muted">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          Show archived
        </label>
      </header>

      {error && (
        <div className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300">{error}</div>
      )}

      <div className="card overflow-x-auto p-0">
        <table className="min-w-full divide-y divide-line text-sm">
          <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-content-subtle">
            <tr>
              <th className="px-4 py-2">Code / Subject</th>
              <th className="px-4 py-2">Teacher</th>
              <th className="px-4 py-2">Section</th>
              <th className="px-4 py-2">Term</th>
              <th className="px-4 py-2">Students</th>
              <th className="px-4 py-2">Join Code</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-content-subtle">
                  Loading…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-content-subtle">
                  No classes {showArchived ? '' : '(toggle "Show archived" to see archived ones)'}.
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id} className={c.is_archived ? 'opacity-60' : ''}>
                  <td className="px-4 py-2">
                    <div className="font-mono text-xs uppercase text-content-subtle">
                      {c.subject_code}
                    </div>
                    <div className="font-medium">{c.subject_title}</div>
                  </td>
                  <td className="px-4 py-2 text-content-muted">{c.teacher_name}</td>
                  <td className="px-4 py-2 text-content-muted">{c.section ?? '—'}</td>
                  <td className="px-4 py-2 text-content-muted">
                    {c.semester} · {c.school_year}
                  </td>
                  <td className="px-4 py-2 text-content-muted">{c.enrollment_count}</td>
                  <td className="px-4 py-2 font-mono text-xs tracking-widest text-brand-700">
                    {c.class_code}
                  </td>
                  <td className="px-4 py-2">
                    {c.is_archived ? (
                      <span className="badge-neutral">Archived</span>
                    ) : (
                      <span className="badge-success">Active</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => void onDelete(c)} className="btn-danger text-xs">
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
