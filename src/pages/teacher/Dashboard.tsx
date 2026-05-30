import { Link } from 'react-router-dom';
import { BookOpen, Users, BarChart3, Plus, ArrowRight } from 'lucide-react';
import { useTeacherClasses } from '@/hooks/useTeacherClasses';
import { StatTile } from '@/components/StatTile';
import { RoleProfileBanner } from '@/components/RoleProfileBanner';

export function TeacherDashboard() {
  const { classes, loading } = useTeacherClasses();

  const totalStudents = classes.reduce((s, c) => s + c.enrollment_count, 0);
  const avgClassSize = classes.length > 0 ? Math.round(totalStudents / classes.length) : 0;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-content-muted">Overview of your classes.</p>
        </div>
        <Link to="/teacher/classes/new" className="btn-primary">
          <Plus className="h-4 w-4" /> Create Class
        </Link>
      </header>

      <RoleProfileBanner />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile icon={BookOpen} label="Active Classes" value={loading ? '…' : classes.length} tone="brand" />
        <StatTile icon={Users} label="Total Students" value={loading ? '…' : totalStudents} tone="brand" />
        <StatTile
          icon={BarChart3}
          label="Avg. Class Size"
          value={loading ? '…' : avgClassSize}
          tone="neutral"
          hint="Students per class"
        />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-content">Your Classes</h2>
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="skeleton h-32" />
            <div className="skeleton h-32" />
          </div>
        ) : classes.length === 0 ? (
          <div className="card flex flex-col items-center gap-3 py-12 text-center">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-500">
              <BookOpen className="h-6 w-6" strokeWidth={1.8} />
            </span>
            <p className="text-content-muted">No classes yet.</p>
            <Link to="/teacher/classes/new" className="btn-primary">
              <Plus className="h-4 w-4" /> Create your first class
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {classes.map((c) => (
              <Link
                key={c.id}
                to={`/teacher/classes/${c.id}`}
                className="card card-hover group flex flex-col"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-mono text-xs uppercase text-content-subtle">
                      {c.subject.code}
                    </div>
                    <h3 className="mt-0.5 truncate font-semibold text-content">{c.subject.title}</h3>
                    <div className="mt-1 text-sm text-content-muted">
                      {c.section ?? '—'} · {c.semester} · {c.school_year}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-3xl font-bold leading-none tracking-tight text-content">
                      {c.enrollment_count}
                    </div>
                    <div className="mt-1 text-xs text-content-subtle">students</div>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-xs">
                  <span className="text-content-subtle">
                    Code:{' '}
                    <span className="font-mono font-bold tracking-widest text-brand-500">
                      {c.class_code}
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 text-content-subtle transition group-hover:translate-x-0.5 group-hover:text-brand-500" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
