import { MouseEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStudentClasses, type EnrolledClass } from '@/hooks/useStudentClasses';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { humanizeError } from '@/utils/errorMessage';

export function StudentClasses() {
  const { classes, loading, error, refresh } = useStudentClasses();
  const { user } = useAuth();
  const [leaving, setLeaving] = useState<EnrolledClass | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const confirmLeave = async () => {
    if (!leaving || !user) return;
    setBusy(true);
    setActionError(null);

    const { data: studentRow } = await supabase
      .from('students')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (!studentRow) {
      setBusy(false);
      setActionError('Student profile not found.');
      return;
    }
    const { error: err } = await supabase
      .from('enrollments')
      .delete()
      .eq('class_id', leaving.id)
      .eq('student_id', (studentRow as { id: string }).id);
    setBusy(false);
    if (err) {
      setActionError(humanizeError(err));
      return;
    }
    setLeaving(null);
    refresh();
  };

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Classes</h1>
          <p className="text-sm text-content-muted">Classes you're enrolled in.</p>
        </div>
        <Link to="/student/join" className="btn-primary">
          + Join Class
        </Link>
      </header>

      {error && (
        <div className="rounded-xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-600 ring-1 ring-red-500/30 dark:text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="card text-center text-sm text-content-subtle">Loading…</div>
      ) : classes.length === 0 ? (
        <div className="card text-center text-sm text-content-subtle">
          You haven't joined any class yet.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {classes.map((c) => (
            <div key={c.id} className="card relative transition hover:shadow-md">
              <Link to={`/student/classes/${c.id}`} className="block">
                <div className="font-mono text-xs uppercase text-content-subtle">
                  {c.subject.code}
                </div>
                <h3 className="text-lg font-semibold">{c.subject.title}</h3>
                <div className="mt-2 space-y-1 text-sm text-content-muted">
                  <div>Teacher: {c.teacher_name}</div>
                  <div>Section: {c.section ?? '—'}</div>
                  <div>
                    {c.semester} · {c.school_year}
                  </div>
                </div>
              </Link>
              <div className="mt-3 border-t border-line pt-3 text-right">
                <button
                  onClick={(e: MouseEvent) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setLeaving(c);
                  }}
                  className="text-xs font-medium text-red-600 hover:underline"
                >
                  Leave class
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {leaving && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 px-4 animate-fade-in">
          <div className="card w-full max-w-md space-y-4">
            <h3 className="text-lg font-semibold">Leave class?</h3>
            <p className="text-sm text-content-muted">
              You'll be removed from{' '}
              <strong>
                {leaving.subject.code} — {leaving.subject.title}
              </strong>
              . Your existing grade records stay in the audit log, but you'll lose access to this
              class's grades. You can rejoin if you still have the class code.
            </p>
            {actionError && (
              <div className="rounded-xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-600 ring-1 ring-red-500/30 dark:text-red-300">
                {actionError}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setLeaving(null);
                  setActionError(null);
                }}
                className="btn-secondary"
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmLeave()}
                className="btn-danger"
                disabled={busy}
              >
                {busy ? 'Leaving…' : 'Leave class'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
