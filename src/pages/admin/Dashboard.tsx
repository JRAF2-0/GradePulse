import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export function AdminDashboard() {
  const [counts, setCounts] = useState({
    students: 0,
    teachers: 0,
    classes: 0,
    pending: 0,
    highRisk: 0,
    deansList: 0,
    pendingApprovals: 0,
    pendingAppeals: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const [students, teachers, classes, pending, highRisk, deansList, approvals, pendingAppeals] =
        await Promise.all([
          supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'student'),
          supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'teacher'),
          supabase
            .from('classes')
            .select('id', { count: 'exact', head: true })
            .eq('is_archived', false),
          supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'pending'),
          supabase.rpc('count_high_risk_students'),
          supabase.rpc('count_deans_list_current_term'),
          supabase
            .from('grade_change_requests')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'pending'),
          supabase
            .from('appeals')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'pending'),
        ]);
      setCounts({
        students: students.count ?? 0,
        teachers: teachers.count ?? 0,
        classes: classes.count ?? 0,
        pending: pending.count ?? 0,
        highRisk: Number(highRisk.data ?? 0),
        deansList: Number(deansList.data ?? 0),
        pendingApprovals: approvals.count ?? 0,
        pendingAppeals: pendingAppeals.count ?? 0,
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

  const insightCards = [
    {
      label: 'High-risk students',
      value: counts.highRisk,
      tone: counts.highRisk > 0 ? 'danger' : 'neutral',
      hint: 'Grades < 70% or attendance < 60%',
    },
    {
      label: "Dean's List (current term)",
      value: counts.deansList,
      tone: 'success',
      hint: 'GPA ≤ 1.50 · No grade > 2.50',
    },
    {
      label: 'Pending grade changes',
      value: counts.pendingApprovals,
      tone: counts.pendingApprovals > 0 ? 'warning' : 'neutral',
      hint: 'Filed by teachers after finalize',
    },
    {
      label: 'Open appeals',
      value: counts.pendingAppeals,
      tone: counts.pendingAppeals > 0 ? 'warning' : 'neutral',
      hint: 'Filed by students',
      to: '/admin/appeals',
    },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-sm text-content-muted">System overview and quick actions.</p>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        {cards.map((c) => (
          <Link
            key={c.label}
            to={c.to}
            className={`card transition hover:shadow-md ${
              c.highlight && c.value > 0 ? 'ring-amber-500/30 bg-amber-500/10' : ''
            }`}
          >
            <div className="text-xs uppercase tracking-wide text-content-subtle">{c.label}</div>
            <div className="mt-1 text-3xl font-bold">{loading ? '…' : c.value}</div>
          </Link>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        {insightCards.map((c) => {
          const cls = `card ${
            c.tone === 'danger' && c.value > 0
              ? 'ring-red-500/30 bg-red-500/10'
              : c.tone === 'warning' && c.value > 0
                ? 'ring-amber-500/30 bg-amber-500/10'
                : c.tone === 'success' && c.value > 0
                  ? 'ring-emerald-500/30 bg-emerald-500/10'
                  : ''
          }`;
          const inner = (
            <>
              <div className="text-xs uppercase tracking-wide text-content-subtle">{c.label}</div>
              <div className="mt-1 text-3xl font-bold">{loading ? '…' : c.value}</div>
              <div className="mt-1 text-xs text-content-subtle">{c.hint}</div>
            </>
          );
          if ('to' in c && c.to) {
            return (
              <Link key={c.label} to={c.to} className={`${cls} transition hover:shadow-md`}>
                {inner}
              </Link>
            );
          }
          return (
            <div key={c.label} className={cls}>
              {inner}
            </div>
          );
        })}
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <Link to="/admin/users" className="card transition hover:shadow-md">
          <h3 className="font-semibold">Manage Users</h3>
          <p className="mt-1 text-sm text-content-muted">Approve signups, assign roles.</p>
        </Link>
        <Link to="/admin/subjects" className="card transition hover:shadow-md">
          <h3 className="font-semibold">Manage Subjects</h3>
          <p className="mt-1 text-sm text-content-muted">Maintain the subject catalog.</p>
        </Link>
        <Link to="/admin/audit" className="card transition hover:shadow-md">
          <h3 className="font-semibold">Audit Logs</h3>
          <p className="mt-1 text-sm text-content-muted">Inspect every grade change.</p>
        </Link>
      </section>
    </div>
  );
}
