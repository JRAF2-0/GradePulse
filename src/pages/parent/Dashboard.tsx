import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { StatTile } from '@/components/StatTile';

interface LinkedChild {
  id: string;
  relationship: string | null;
  student: {
    id: string;
    student_no: string | null;
    course: string | null;
    year_level: number | null;
    section: string | null;
    user: { full_name: string } | null;
  } | null;
}

export function ParentDashboard() {
  const { profile } = useAuth();
  const [children, setChildren] = useState<LinkedChild[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error: err } = await supabase
        .from('parent_students')
        .select(
          `id, relationship,
           student:students(id, student_no, course, year_level, section, user:users(full_name))`,
        )
        .eq('parent_id', profile.id);
      if (cancelled) return;
      if (err) {
        setError(err.message);
      } else {
        setChildren((data as unknown as LinkedChild[]) ?? []);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Parent Portal</h1>
        <p className="mt-1 text-content-muted">
          Welcome, {profile?.full_name}. Below are the students linked to your account.
        </p>
      </header>

      {error && (
        <div className="rounded-xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-600 ring-1 ring-red-500/30 dark:text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="skeleton h-32" />
          <div className="skeleton h-32" />
        </div>
      ) : children.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 py-12 text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-500">
            <Users className="h-6 w-6" strokeWidth={1.8} />
          </span>
          <p className="text-content-muted">
            No students are linked to your account yet. Please contact an admin.
          </p>
        </div>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-4 sm:max-w-xs">
            <StatTile icon={Users} label="Linked Students" value={children.length} tone="brand" />
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-content">Your students</h2>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {children.map((c) =>
                c.student ? (
                  <Link
                    key={c.id}
                    to={`/parent/student/${c.student.id}`}
                    className="card card-hover group flex flex-col"
                  >
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-sm font-bold text-white">
                        {(c.student.user?.full_name ?? '?')
                          .split(' ')
                          .map((s) => s[0])
                          .slice(0, 2)
                          .join('')
                          .toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs uppercase tracking-wide text-content-subtle">
                          {c.relationship ?? 'Linked student'}
                        </div>
                        <div className="truncate font-semibold text-content">
                          {c.student.user?.full_name ?? 'Student'}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 text-sm text-content-muted">
                      {c.student.student_no && <span>{c.student.student_no} · </span>}
                      {c.student.course ?? '—'}
                      {c.student.year_level ? ` · Year ${c.student.year_level}` : ''}
                      {c.student.section ? ` · ${c.student.section}` : ''}
                    </div>
                    <div className="mt-4 flex items-center gap-1 border-t border-line pt-3 text-xs font-medium text-brand-500">
                      View grades & attendance
                      <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                    </div>
                  </Link>
                ) : null,
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
