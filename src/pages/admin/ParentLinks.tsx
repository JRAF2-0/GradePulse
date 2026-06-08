import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { humanizeError } from '@/utils/errorMessage';
import { SkeletonTableRows } from '@/components/Skeleton';

interface UserRow {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

interface StudentRow {
  id: string;
  student_no: string | null;
  course: string | null;
  year_level: number | null;
  section: string | null;
  user: { id: string; full_name: string; email: string } | null;
}

interface LinkRow {
  id: string;
  parent_id: string;
  student_id: string;
  relationship: string | null;
  created_at: string;
  parent: { full_name: string; email: string } | null;
  student: { id: string; user: { full_name: string } | null } | null;
}

export function AdminParentLinks() {
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [parents, setParents] = useState<UserRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [linksRes, parentsRes, studentsRes] = await Promise.all([
      supabase
        .from('parent_students')
        .select(
          `id, parent_id, student_id, relationship, created_at,
           parent:users!parent_id(full_name, email),
           student:students(id, user:users(full_name))`,
        )
        .order('created_at', { ascending: false }),
      supabase.from('users').select('id, full_name, email, role').eq('role', 'parent'),
      supabase
        .from('students')
        .select('id, student_no, course, year_level, section, user:users(id, full_name, email)'),
    ]);
    setLoading(false);
    if (linksRes.error) {
      setError(humanizeError(linksRes.error));
      return;
    }
    setLinks((linksRes.data as unknown as LinkRow[]) ?? []);
    setParents((parentsRes.data as UserRow[]) ?? []);
    setStudents((studentsRes.data as unknown as StudentRow[]) ?? []);
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const onUnlink = async (row: LinkRow) => {
    if (
      !confirm(
        `Remove link between ${row.parent?.full_name ?? 'parent'} and ${row.student?.user?.full_name ?? 'student'}?`,
      )
    )
      return;
    const { error: err } = await supabase.from('parent_students').delete().eq('id', row.id);
    if (err) {
      setError(humanizeError(err));
      return;
    }
    await fetchAll();
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Parent ↔ Student Links</h1>
          <p className="text-sm text-content-muted">
            Link a parent account to one or more students so they can view their children's grades.
          </p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="btn-primary"
          disabled={parents.length === 0 || students.length === 0}
          title={
            parents.length === 0
              ? 'No users with role "parent" yet'
              : students.length === 0
                ? 'No students yet'
                : ''
          }
        >
          New link
        </button>
      </header>

      {error && (
        <div className="rounded-xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-600 ring-1 ring-red-500/30 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="card overflow-x-auto p-0">
        <table className="min-w-full divide-y divide-line text-sm">
          <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-content-subtle">
            <tr>
              <th className="px-4 py-2">Parent</th>
              <th className="px-4 py-2">Student</th>
              <th className="px-4 py-2">Relationship</th>
              <th className="px-4 py-2">Linked</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {loading ? (
              <SkeletonTableRows rows={4} cols={5} />
            ) : links.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-content-subtle">
                  No parent links yet.
                </td>
              </tr>
            ) : (
              links.map((l) => (
                <tr key={l.id}>
                  <td className="px-4 py-2">
                    <div className="font-medium">{l.parent?.full_name}</div>
                    <div className="text-xs text-content-subtle">{l.parent?.email}</div>
                  </td>
                  <td className="px-4 py-2 font-medium">{l.student?.user?.full_name ?? '—'}</td>
                  <td className="px-4 py-2 text-content-muted">{l.relationship ?? '—'}</td>
                  <td className="px-4 py-2 text-content-subtle">
                    {new Date(l.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => void onUnlink(l)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Unlink
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {adding && (
        <NewLinkModal
          parents={parents}
          students={students}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            void fetchAll();
          }}
        />
      )}
    </div>
  );
}

function NewLinkModal({
  parents,
  students,
  onClose,
  onSaved,
}: {
  parents: UserRow[];
  students: StudentRow[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [parentId, setParentId] = useState<string>(parents[0]?.id ?? '');
  const [studentId, setStudentId] = useState<string>(students[0]?.id ?? '');
  const [relationship, setRelationship] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sortedStudents = useMemo(
    () =>
      [...students].sort((a, b) =>
        (a.user?.full_name ?? '').localeCompare(b.user?.full_name ?? ''),
      ),
    [students],
  );

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.from('parent_students').insert({
      parent_id: parentId,
      student_id: studentId,
      relationship: relationship || null,
    });
    setBusy(false);
    if (err) {
      setError(humanizeError(err));
      return;
    }
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in md:left-[var(--sidebar-w)]">
      <form onSubmit={onSubmit} className="card w-full max-w-md space-y-4">
        <h3 className="text-lg font-semibold">Link parent to student</h3>
        {error && (
          <div className="rounded-xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-600 ring-1 ring-red-500/30 dark:text-red-300">
            {error}
          </div>
        )}
        <div>
          <label className="label">Parent</label>
          <select
            required
            className="input"
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
          >
            {parents.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name} — {p.email}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Student</label>
          <select
            required
            className="input"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
          >
            {sortedStudents.map((s) => (
              <option key={s.id} value={s.id}>
                {s.user?.full_name ?? 'Unnamed'}
                {s.student_no ? ` (${s.student_no})` : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Relationship (optional)</label>
          <input
            className="input"
            value={relationship}
            onChange={(e) => setRelationship(e.target.value)}
            placeholder="mother, father, guardian"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button disabled={busy} className="btn-primary">
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}
