import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  GraduationCap,
  Users,
  BookOpen,
  UserPlus,
  AlertTriangle,
  Award,
  ClipboardCheck,
  Gavel,
  Settings,
  Library,
  ScrollText,
  ArrowRight,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { StatTile } from '@/components/StatTile';

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

  const v = (n: number) => (loading ? '…' : n);

  const quickActions = [
    {
      to: '/admin/users',
      icon: Settings,
      title: 'Manage Users',
      desc: 'Approve signups, assign roles.',
    },
    {
      to: '/admin/subjects',
      icon: Library,
      title: 'Manage Subjects',
      desc: 'Maintain the subject catalog.',
    },
    {
      to: '/admin/audit',
      icon: ScrollText,
      title: 'Audit Logs',
      desc: 'Inspect every grade change.',
    },
  ];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="mt-1 text-content-muted">System overview and quick actions.</p>
      </header>

      {/* Primary counts */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          icon={GraduationCap}
          label="Students"
          value={v(counts.students)}
          to="/admin/users"
          tone="brand"
        />
        <StatTile
          icon={Users}
          label="Teachers"
          value={v(counts.teachers)}
          to="/admin/users"
          tone="brand"
        />
        <StatTile
          icon={BookOpen}
          label="Active Classes"
          value={v(counts.classes)}
          to="/admin/classes"
          tone="brand"
        />
        <StatTile
          icon={UserPlus}
          label="Pending Approvals"
          value={v(counts.pending)}
          to="/admin/users"
          tone="warning"
          active={counts.pending > 0}
          hint="Awaiting role assignment"
        />
      </section>

      {/* Insights */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-content">Insights</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            icon={AlertTriangle}
            label="High-risk students"
            value={v(counts.highRisk)}
            tone="danger"
            active={counts.highRisk > 0}
            hint="Grades < 70% or attendance < 60%"
          />
          <StatTile
            icon={Award}
            label="Dean's List"
            value={v(counts.deansList)}
            tone="success"
            active={counts.deansList > 0}
            hint="GPA ≤ 1.50 · No grade > 2.50"
          />
          <StatTile
            icon={ClipboardCheck}
            label="Pending grade changes"
            value={v(counts.pendingApprovals)}
            tone="warning"
            active={counts.pendingApprovals > 0}
            hint="Filed by teachers after finalize"
          />
          <StatTile
            icon={Gavel}
            label="Open appeals"
            value={v(counts.pendingAppeals)}
            to="/admin/appeals"
            tone="warning"
            active={counts.pendingAppeals > 0}
            hint="Filed by students"
          />
        </div>
      </section>

      {/* Quick actions */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-content">Quick actions</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {quickActions.map((a) => {
            const Icon = a.icon;
            return (
              <Link key={a.to} to={a.to} className="card card-hover group flex items-center gap-4">
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-500/15 text-brand-500">
                  <Icon className="h-5 w-5" strokeWidth={1.9} />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-content">{a.title}</h3>
                  <p className="text-sm text-content-muted">{a.desc}</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-content-subtle transition group-hover:translate-x-0.5 group-hover:text-brand-500" />
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
