import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

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
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Department Head</h1>
        <p className="text-sm text-content-muted">
          Welcome, {profile?.full_name}. {dept ? `You lead ${dept.name} (${dept.code}).` : ''}
        </p>
      </header>

      {loading ? (
        <p className="text-sm text-content-subtle">Loading…</p>
      ) : !dept ? (
        <div className="card text-sm text-content-muted">
          You are not currently assigned to a department. Please contact an admin.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <Link to="/department-head/approvals" className="card transition hover:bg-surface-3">
            <div className="text-xs uppercase tracking-wide text-content-subtle">
              Pending grade change requests
            </div>
            <div className="mt-1 text-3xl font-bold tracking-tight">{pendingApprovals}</div>
            <div className="text-xs text-brand-600">Review →</div>
          </Link>
          <StatCard label="Department" value={dept.code} />
          <Link to="/department-head/bias-signals" className="card transition hover:bg-surface-3">
            <div className="text-xs uppercase tracking-wide text-content-subtle">Bias signals</div>
            <div className="mt-1 text-3xl font-bold tracking-tight">View</div>
            <div className="text-xs text-brand-600">Department anomalies →</div>
          </Link>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <div className="card">
      <div className="text-xs uppercase tracking-wide text-content-subtle">{label}</div>
      <div className="mt-1 text-3xl font-bold tracking-tight">{value}</div>
      {hint && <div className="text-xs text-content-subtle">{hint}</div>}
    </div>
  );
}
