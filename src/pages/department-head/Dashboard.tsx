import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardCheck, Building2, ShieldAlert, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { StatTile } from '@/components/StatTile';
import { RoleProfileBanner } from '@/components/RoleProfileBanner';

interface DeptInfo {
  id: string;
  code: string;
  name: string;
}

export function DepartmentHeadDashboard() {
  const { profile } = useAuth();
  const [dept, setDept] = useState<DeptInfo | null>(null);
  const [pendingApprovals, setPendingApprovals] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: deptRow } = await supabase
        .from('departments')
        .select('id, code, name')
        .eq('head_id', profile.id)
        .maybeSingle();
      const { count } = await supabase
        .from('grade_change_requests')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');
      if (cancelled) return;
      setDept(deptRow ?? null);
      setPendingApprovals(count ?? 0);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Department Head</h1>
        <p className="mt-1 text-content-muted">
          Welcome, {profile?.full_name}. {dept ? `You lead ${dept.name} (${dept.code}).` : ''}
        </p>
      </header>

      <RoleProfileBanner />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="skeleton h-32" />
          <div className="skeleton h-32" />
          <div className="skeleton h-32" />
        </div>
      ) : !dept ? (
        <div className="card flex flex-col items-center gap-3 py-12 text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-500">
            <Building2 className="h-6 w-6" strokeWidth={1.8} />
          </span>
          <p className="text-content-muted">
            You are not currently assigned to a department. Please contact an admin.
          </p>
        </div>
      ) : (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatTile
            icon={ClipboardCheck}
            label="Pending grade changes"
            value={pendingApprovals}
            to="/department-head/approvals"
            tone="warning"
            active={pendingApprovals > 0}
            hint="Tap to review →"
          />
          <StatTile icon={Building2} label="Department" value={dept.code} tone="brand" hint={dept.name} />
          <Link
            to="/department-head/bias-signals"
            className="card card-hover group flex flex-col"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="text-sm font-semibold text-content-muted">Bias signals</div>
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/15 text-brand-500">
                <ShieldAlert className="h-5 w-5" strokeWidth={1.9} />
              </span>
            </div>
            <div className="mt-3 text-2xl font-bold tracking-tight text-content">View anomalies</div>
            <div className="mt-2 flex items-center gap-1 text-xs font-medium text-brand-500">
              Department analytics
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </div>
          </Link>
        </section>
      )}
    </div>
  );
}
