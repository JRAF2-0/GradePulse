import { Link } from 'react-router-dom';
import { useTeacherClasses } from '@/hooks/useTeacherClasses';

export function TeacherDashboard() {
  const { classes, loading } = useTeacherClasses();

  const totalStudents = classes.reduce((s, c) => s + c.enrollment_count, 0);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-content-muted">Overview of your classes.</p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="card">
          <div className="text-xs uppercase tracking-wide text-content-subtle">Active Classes</div>
          <div className="mt-1 text-3xl font-bold">{classes.length}</div>
        </div>
        <div className="card">
          <div className="text-xs uppercase tracking-wide text-content-subtle">Total Students</div>
          <div className="mt-1 text-3xl font-bold">{totalStudents}</div>
        </div>
        <div className="card">
          <div className="text-xs uppercase tracking-wide text-content-subtle">Quick Action</div>
          <Link to="/teacher/classes/new" className="btn-primary mt-2 inline-flex">
            + Create Class
          </Link>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Your Classes</h2>
        {loading ? (
          <div className="card text-sm text-content-subtle">Loading…</div>
        ) : classes.length === 0 ? (
          <div className="card text-sm text-content-subtle">
            No classes yet.{' '}
            <Link to="/teacher/classes/new" className="text-brand-600 underline">
              Create one
            </Link>
            .
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {classes.map((c) => (
              <Link
                key={c.id}
                to={`/teacher/classes/${c.id}`}
                className="card transition hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-mono text-xs uppercase text-content-subtle">
                      {c.subject.code}
                    </div>
                    <h3 className="font-semibold">{c.subject.title}</h3>
                    <div className="mt-1 text-sm text-content-muted">
                      {c.section ?? '—'} · {c.semester} · {c.school_year}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold tracking-tight">{c.enrollment_count}</div>
                    <div className="text-xs text-content-subtle">students</div>
                  </div>
                </div>
                <div className="mt-3 border-t border-line pt-2 text-xs">
                  Code:{' '}
                  <span className="font-mono font-bold tracking-widest text-brand-700">
                    {c.class_code}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
