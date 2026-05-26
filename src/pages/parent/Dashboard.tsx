import { useEffect, useState } from 'react';
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
        <h1 className="text-2xl font-bold">Parent Portal</h1>
        <p className="text-sm text-slate-600">
          Welcome, {profile?.full_name}. Below are the students linked to your account.
        </p>
      </header>

      {error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : children.length === 0 ? (
        <div className="card text-sm text-slate-600">
          No students are linked to your account yet. Please contact an admin.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {children.map((c) => (
            <div key={c.id} className="card">
              <div className="text-xs uppercase tracking-wide text-slate-500">
                {c.relationship ?? 'Linked student'}
              </div>
              <div className="mt-1 text-lg font-semibold">
                {c.student?.user?.full_name ?? 'Student'}
              </div>
              <div className="mt-1 text-sm text-slate-600">
                {c.student?.student_no && <span>{c.student.student_no} · </span>}
                {c.student?.course ?? '—'}
                {c.student?.year_level ? ` · Year ${c.student.year_level}` : ''}
                {c.student?.section ? ` · ${c.student.section}` : ''}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card text-sm text-slate-600">
        Per-student grade, attendance, and transcript views are coming in the next phase.
      </div>
    </div>
  );
}
