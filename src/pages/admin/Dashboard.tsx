import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export function AdminDashboard() {
  const [counts, setCounts] = useState({
    students: 0,
    teachers: 0,
    classes: 0,
    pending: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const [students, teachers, classes, pending] = await Promise.all([
        supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'student'),
        supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'teacher'),
        supabase.from('classes').select('id', { count: 'exact', head: true }).eq('is_archived', false),
        supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'pending'),
      ]);
      setCounts({
        students: students.count ?? 0,
        teachers: teachers.count ?? 0,
        classes: classes.count ?? 0,
        pending: pending.count ?? 0,
      });
      setLoading(false);
    })();
  }, []);

  const cards = [
    { label: 'Students', value: counts.students, to: '/admin/users' },
    { label: 'Teachers', value: counts.teachers, to: '/admin/users' },
    { label: 'Active Classes', value: counts.classes, to: '/admin/classes' },
    { label: 'Pending Approvals', value: counts.pending, to: '/admin/users', highlight: true },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="text-sm text-slate-600">System overview and quick actions.</p>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        {cards.map((c) => (
          <Link
            key={c.label}
            to={c.to}
            className={`card transition hover:shadow-md ${
              c.highlight && c.value > 0 ? 'ring-amber-300 bg-amber-50' : ''
            }`}
          >
            <div className="text-xs uppercase tracking-wide text-slate-500">{c.label}</div>
            <div className="mt-1 text-3xl font-bold">{loading ? '…' : c.value}</div>
          </Link>
        ))}
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <Link to="/admin/users" className="card transition hover:shadow-md">
          <h3 className="font-semibold">Manage Users</h3>
          <p className="mt-1 text-sm text-slate-600">Approve signups, assign roles.</p>
        </Link>
        <Link to="/admin/subjects" className="card transition hover:shadow-md">
          <h3 className="font-semibold">Manage Subjects</h3>
          <p className="mt-1 text-sm text-slate-600">Maintain the subject catalog.</p>
        </Link>
        <Link to="/admin/audit" className="card transition hover:shadow-md">
          <h3 className="font-semibold">Audit Logs</h3>
          <p className="mt-1 text-sm text-slate-600">Inspect every grade change.</p>
        </Link>
      </section>
    </div>
  );
}
