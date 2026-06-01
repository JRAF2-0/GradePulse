import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { BookOpen, TrendingUp, Award, ShieldCheck, ArrowRight } from 'lucide-react';
import { useStudentClasses } from '@/hooks/useStudentClasses';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { formatNumeric } from '@/utils/conversionTable';
import { RiskBadge } from '@/components/RiskBadge';
import { StatTile, type Tone } from '@/components/StatTile';
import { RoleProfileBanner } from '@/components/RoleProfileBanner';
import type { PeriodGrade } from '@/hooks/useStudentClassDetail';
import type { RiskLevel } from '@/types/database';

interface Row {
  classId: string;
  code: string;
  title: string;
  midterm: PeriodGrade;
  finals: PeriodGrade;
  final: PeriodGrade;
}

export function StudentDashboard() {
  const { user } = useAuth();
  const { classes, loading } = useStudentClasses();
  const [rows, setRows] = useState<Row[]>([]);
  const [computing, setComputing] = useState(false);
  const [cgpa, setCgpa] = useState<number | null>(null);
  const [risk, setRisk] = useState<RiskLevel | null>(null);
  const [deansList, setDeansList] = useState<{ year: string; sem: string } | null>(null);

  useEffect(() => {
    if (!user || classes.length === 0) return;
    void (async () => {
      setComputing(true);
      const { data: studentRow } = await supabase
        .from('students')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!studentRow) {
        setComputing(false);
        return;
      }
      const studentId = studentRow.id;
      const out: Row[] = [];
      for (const c of classes) {
        const [mid, fin, final] = await Promise.all([
          supabase.rpc('compute_period_grade', {
            p_class_id: c.id,
            p_student_id: studentId,
            p_period: 'midterm',
          }),
          supabase.rpc('compute_period_grade', {
            p_class_id: c.id,
            p_student_id: studentId,
            p_period: 'finals',
          }),
          supabase.rpc('compute_final_grade', {
            p_class_id: c.id,
            p_student_id: studentId,
          }),
        ]);
        out.push({
          classId: c.id,
          code: c.subject.code,
          title: c.subject.title,
          midterm: pickRow(mid.data),
          finals: pickRow(fin.data),
          final: pickRow(final.data),
        });
      }
      setRows(out);

      // CGPA + Risk (overall, across all classes)
      const [cgpaRes, riskRes] = await Promise.all([
        supabase.rpc('compute_cgpa', { p_student_id: studentId }),
        supabase.rpc('compute_risk_level', { p_student_id: studentId }),
      ]);
      setCgpa(cgpaRes.data != null ? Number(cgpaRes.data) : null);
      setRisk((riskRes.data as RiskLevel | null) ?? null);

      // Dean's List: most recent term the student is in (by school_year/semester)
      const termPairs = classes.map((c) => ({
        year: c.school_year,
        sem: c.semester,
      }));
      const uniqueTerms = Array.from(new Set(termPairs.map((t) => `${t.year}__${t.sem}`))).map(
        (k) => {
          const [year, sem] = k.split('__');
          return { year, sem };
        },
      );
      // Try each term — set on first eligibility hit
      let found: { year: string; sem: string } | null = null;
      for (const term of uniqueTerms) {
        const { data: ok } = await supabase.rpc('is_dean_list_eligible', {
          p_student_id: studentId,
          p_school_year: term.year,
          p_semester: term.sem as 'midterm' | 'finals' | '1st' | '2nd' | 'summer',
        });
        if (ok) {
          found = term;
          break;
        }
      }
      setDeansList(found);

      setComputing(false);
    })();
  }, [user, classes]);

  const overallAverage =
    rows.length > 0 ? rows.reduce((s, r) => s + r.final.percentage, 0) / rows.length : 0;

  const avgTone: Tone =
    overallAverage >= 75
      ? 'success'
      : overallAverage >= 70
        ? 'warning'
        : overallAverage > 0
          ? 'danger'
          : 'neutral';
  const statusLabel =
    overallAverage >= 75
      ? 'Passing'
      : overallAverage >= 70
        ? 'At Risk'
        : overallAverage > 0
          ? 'Failing'
          : 'No grades yet';
  const riskTone: Tone =
    risk === 'high'
      ? 'danger'
      : risk === 'medium'
        ? 'warning'
        : risk === 'low'
          ? 'success'
          : 'neutral';
  const barColor =
    avgTone === 'success'
      ? 'bg-emerald-500'
      : avgTone === 'warning'
        ? 'bg-amber-500'
        : avgTone === 'danger'
          ? 'bg-red-500'
          : 'bg-surface-3';

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-content-muted">Your grade overview across all classes.</p>
      </header>

      <RoleProfileBanner />

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile icon={BookOpen} label="Classes" value={classes.length} tone="brand" />
        <StatTile
          icon={TrendingUp}
          label="Overall Average"
          value={`${overallAverage.toFixed(1)}%`}
          tone={avgTone}
          active={overallAverage > 0}
          hint={statusLabel}
        />
        <StatTile
          icon={Award}
          label="CGPA"
          value={cgpa != null && cgpa > 0 ? cgpa.toFixed(2) : '—'}
          tone="brand"
          hint={
            deansList ? (
              <span className="badge-success">
                🏅 Dean's List · {deansList.sem} {deansList.year}
              </span>
            ) : (
              'PH scale (1.00 best)'
            )
          }
        />
        <StatTile
          icon={ShieldCheck}
          label="Risk Level"
          value={
            risk ? (
              <RiskBadge level={risk} />
            ) : (
              <span className="text-base text-content-subtle">
                {computing ? 'Calculating…' : '—'}
              </span>
            )
          }
          tone={riskTone}
          hint="Based on grades + attendance"
        />
      </section>

      {/* Overall progress */}
      <section className="card">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-content-muted">Overall progress</h2>
          <Link
            to="/student/analytics"
            className="inline-flex items-center gap-1 text-sm font-medium text-brand-500 hover:text-brand-400"
          >
            View Analytics <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-surface-3">
            <div
              className={`h-full rounded-full transition-all ${barColor}`}
              style={{ width: `${Math.min(Math.max(overallAverage, 0), 100)}%` }}
            />
          </div>
          <span className="w-28 text-right text-sm font-semibold text-content">
            {overallAverage.toFixed(1)}% · {statusLabel}
          </span>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-content">My Classes</h2>
        {loading || computing ? (
          <div className="space-y-2">
            <div className="skeleton h-12" />
            <div className="skeleton h-12" />
            <div className="skeleton h-12" />
          </div>
        ) : classes.length === 0 ? (
          <div className="card flex flex-col items-center gap-3 py-12 text-center">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-500">
              <BookOpen className="h-6 w-6" strokeWidth={1.8} />
            </span>
            <p className="text-content-muted">You haven't joined any class yet.</p>
            <Link className="btn-primary" to="/student/join">
              Join a Class
            </Link>
          </div>
        ) : (
          <div className="card overflow-x-auto p-0">
            <table className="min-w-full divide-y divide-line text-sm">
              <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-content-subtle">
                <tr>
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3 text-right">Midterm</th>
                  <th className="px-4 py-3 text-right">Finals</th>
                  <th className="px-4 py-3 text-right">Final</th>
                  <th className="px-4 py-3 text-right">Equiv.</th>
                  <th className="px-4 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.classId} className="transition hover:bg-surface-3">
                    <td className="px-4 py-3">
                      <Link
                        to={`/student/classes/${r.classId}`}
                        className="block font-medium text-content hover:text-brand-500"
                      >
                        <div className="font-mono text-xs uppercase text-content-subtle">
                          {r.code}
                        </div>
                        {r.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right text-content-muted">
                      {r.midterm.percentage.toFixed(2)}%
                    </td>
                    <td className="px-4 py-3 text-right text-content-muted">
                      {r.finals.percentage.toFixed(2)}%
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-content">
                      {r.final.percentage.toFixed(2)}%
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-content">
                      {formatNumeric(r.final.numeric_grade)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={
                          r.final.remarks === 'Passed'
                            ? 'badge-success'
                            : r.final.remarks === 'At Risk'
                              ? 'badge-warning'
                              : r.final.remarks === 'Failed'
                                ? 'badge-danger'
                                : 'badge-neutral'
                        }
                      >
                        {r.final.remarks}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function pickRow(data: unknown): PeriodGrade {
  if (!Array.isArray(data) || data.length === 0) {
    return { percentage: 0, numeric_grade: 5.0, remarks: 'No grades yet' };
  }
  const row = data[0] as { percentage: number; numeric_grade: number; remarks: string };
  return {
    percentage: Number(row.percentage),
    numeric_grade: Number(row.numeric_grade),
    remarks: row.remarks,
  };
}
