import { Link } from 'react-router-dom';
import { useTeacherClasses } from '@/hooks/useTeacherClasses';

export function TeacherClasses() {
  const { classes, loading, error } = useTeacherClasses();

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Classes</h1>
          <p className="text-sm text-content-muted">Classes you teach.</p>
        </div>
        <Link to="/teacher/classes/new" className="btn-primary">
          + Create Class
        </Link>
      </header>

      {error && (
        <div className="rounded-xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-600 ring-1 ring-red-500/30 dark:text-red-300">{error}</div>
      )}

      {loading ? (
        <div className="card text-center text-sm text-content-subtle">Loading…</div>
      ) : classes.length === 0 ? (
        <div className="card text-center text-sm text-content-subtle">
          No classes yet. Click <strong>Create Class</strong> to get started.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {classes.map((c) => (
            <Link
              key={c.id}
              to={`/teacher/classes/${c.id}`}
              className="card hover:shadow-md transition"
            >
              <div className="mb-2 flex items-start justify-between">
                <div>
                  <div className="font-mono text-xs uppercase text-content-subtle">
                    {c.subject.code}
                  </div>
                  <h3 className="text-lg font-semibold">{c.subject.title}</h3>
                </div>
                <span className="badge-neutral">{c.semester}</span>
              </div>
              <div className="mt-2 space-y-1 text-sm text-content-muted">
                <div>Section: {c.section ?? '—'}</div>
                <div>School year: {c.school_year}</div>
                <div>Students: {c.enrollment_count}</div>
              </div>
              <div className="mt-3 border-t border-line pt-2">
                <div className="text-xs text-content-subtle">Class code</div>
                <div className="font-mono text-lg font-bold tracking-widest text-brand-700">
                  {c.class_code}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
