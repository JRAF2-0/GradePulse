import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

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
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Parent Portal</h1>
        <p className="text-sm text-content-muted">
          Welcome, {profile?.full_name}. Below are the students linked to your account.
        </p>
      </header>

      {error && (
        <div className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300">{error}</div>
      )}

      {loading ? (
        <p className="text-sm text-content-subtle">Loading…</p>
      ) : children.length === 0 ? (
        <div className="card text-sm text-content-muted">
          No students are linked to your account yet. Please contact an admin.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {children.map((c) =>
            c.student ? (
              <Link
                key={c.id}
                to={`/parent/student/${c.student.id}`}
                className="card transition hover:shadow-md"
              >
                <div className="text-xs uppercase tracking-wide text-content-subtle">
                  {c.relationship ?? 'Linked student'}
                </div>
                <div className="mt-1 text-lg font-semibold">
                  {c.student.user?.full_name ?? 'Student'}
                </div>
                <div className="mt-1 text-sm text-content-muted">
                  {c.student.student_no && <span>{c.student.student_no} · </span>}
                  {c.student.course ?? '—'}
                  {c.student.year_level ? ` · Year ${c.student.year_level}` : ''}
                  {c.student.section ? ` · ${c.student.section}` : ''}
                </div>
                <div className="mt-2 text-xs font-medium text-brand-600">
                  View grades & attendance →
                </div>
              </Link>
            ) : null,
          )}
        </div>
      )}
    </div>
  );
}
