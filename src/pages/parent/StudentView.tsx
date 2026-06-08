import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { formatNumeric } from '@/utils/conversionTable';
import { humanizeError } from '@/utils/errorMessage';
import { RiskBadge } from '@/components/RiskBadge';
import { PageSkeleton } from '@/components/Skeleton';
import type { AttendanceSummary, RiskLevel } from '@/types/database';

interface ChildInfo {
  id: string;
  student_no: string | null;
  course: string | null;
  year_level: number | null;
  section: string | null;
  full_name: string;
}

interface ClassGrade {
  classId: string;
  code: string;
  title: string;
  semester: string;
  schoolYear: string;
  section: string | null;
  finalPct: number;
  finalNumeric: number;
  remarks: string;
  attendancePct: number | null;
}

export function ParentStudentView() {
  const { studentId } = useParams();
  const [child, setChild] = useState<ChildInfo | null>(null);
  const [classes, setClasses] = useState<ClassGrade[]>([]);
  const [cgpa, setCgpa] = useState<number | null>(null);
  const [risk, setRisk] = useState<RiskLevel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!studentId) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);

      // Child profile (RLS only returns rows for linked students)
      const { data: studentRow, error: sErr } = await supabase
        .from('students')
        .select('id, student_no, course, year_level, section, user:users(full_name)')
        .eq('id', studentId)
        .maybeSingle();
      if (cancelled) return;
      if (sErr) {
        setError(humanizeError(sErr));
        setLoading(false);
        return;
      }
      if (!studentRow) {
        setError('You do not have access to this student, or they do not exist.');
        setLoading(false);
        return;
      }
      const sr = studentRow as unknown as {
        id: string;
        student_no: string | null;
        course: string | null;
        year_level: number | null;
        section: string | null;
        user: { full_name: string } | null;
      };
      setChild({
        id: sr.id,
        student_no: sr.student_no,
        course: sr.course,
        year_level: sr.year_level,
        section: sr.section,
        full_name: sr.user?.full_name ?? 'Student',
      });

      // The child's enrollments → classes
      const { data: enrollRows } = await supabase
        .from('enrollments')
        .select(
          'class_id, class:classes(id, semester, school_year, section, subject:subjects(code, title))',
        )
        .eq('student_id', studentId);
      const enrollments =
        (enrollRows as unknown as {
          class_id: string;
          class: {
            id: string;
            semester: string;
            school_year: string;
            section: string | null;
            subject: { code: string; title: string } | null;
          } | null;
        }[]) ?? [];

      const out: ClassGrade[] = [];
      for (const e of enrollments) {
        if (!e.class) continue;
        const [finalRes, attRes] = await Promise.all([
          supabase.rpc('compute_final_grade', {
            p_class_id: e.class.id,
            p_student_id: studentId,
          }),
          supabase.rpc('get_attendance_summary', {
            p_class_id: e.class.id,
            p_student_id: studentId,
          }),
        ]);
        const fg =
          Array.isArray(finalRes.data) && finalRes.data.length > 0
            ? (finalRes.data[0] as {
                percentage: number;
                numeric_grade: number;
                remarks: string;
              })
            : null;
        const att =
          Array.isArray(attRes.data) && attRes.data.length > 0
            ? (attRes.data[0] as AttendanceSummary)
            : null;
        out.push({
          classId: e.class.id,
          code: e.class.subject?.code ?? '—',
          title: e.class.subject?.title ?? '—',
          semester: e.class.semester,
          schoolYear: e.class.school_year,
          section: e.class.section,
          finalPct: fg ? Number(fg.percentage) : 0,
          finalNumeric: fg ? Number(fg.numeric_grade) : 5.0,
          remarks: fg?.remarks ?? 'No grades yet',
          attendancePct: att && att.total > 0 ? Number(att.attendance_pct) : null,
        });
      }
      if (cancelled) return;
      setClasses(out);

      const [cgpaRes, riskRes] = await Promise.all([
        supabase.rpc('compute_cgpa', { p_student_id: studentId }),
        supabase.rpc('compute_risk_level', { p_student_id: studentId }),
      ]);
      if (cancelled) return;
      setCgpa(cgpaRes.data != null ? Number(cgpaRes.data) : null);
      setRisk((riskRes.data as RiskLevel | null) ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  if (loading) return <PageSkeleton />;
  if (error)
    return (
      <div className="space-y-3">
        <Link to="/parent" className="text-sm text-brand-600 hover:underline">
          ← Back to children
        </Link>
        <div className="rounded-xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-600 ring-1 ring-red-500/30 dark:text-red-300">
          {error}
        </div>
      </div>
    );
  if (!child) return null;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/parent" className="text-sm text-brand-600 hover:underline">
          ← Back to children
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{child.full_name}</h1>
          <div className="mt-1 text-sm text-content-muted">
            {child.student_no && <span>{child.student_no} · </span>}
            {child.course ?? '—'}
            {child.year_level ? ` · Year ${child.year_level}` : ''}
            {child.section ? ` · ${child.section}` : ''}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-xs uppercase tracking-wide text-content-subtle">CGPA</div>
            <div className="text-3xl font-bold tracking-tight">
              {cgpa != null && cgpa > 0 ? cgpa.toFixed(2) : '—'}
            </div>
          </div>
          {risk && <RiskBadge level={risk} />}
        </div>
      </header>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Classes</h2>
        {classes.length === 0 ? (
          <div className="card text-sm text-content-subtle">
            This student isn't enrolled in any classes yet.
          </div>
        ) : (
          <div className="card overflow-x-auto p-0">
            <table className="min-w-full divide-y divide-line text-sm">
              <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-content-subtle">
                <tr>
                  <th className="px-4 py-2">Subject</th>
                  <th className="px-4 py-2">Term</th>
                  <th className="px-4 py-2 text-right">Final %</th>
                  <th className="px-4 py-2 text-right">Equiv.</th>
                  <th className="px-4 py-2 text-right">Attendance</th>
                  <th className="px-4 py-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {classes.map((c) => (
                  <tr key={c.classId}>
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs uppercase text-content-subtle">
                        {c.code}
                      </div>
                      <div className="font-medium">{c.title}</div>
                    </td>
                    <td className="px-4 py-3 text-content-muted">
                      {c.semester} · {c.schoolYear}
                      {c.section ? ` · ${c.section}` : ''}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{c.finalPct.toFixed(2)}%</td>
                    <td className="px-4 py-3 text-right font-mono">
                      {formatNumeric(c.finalNumeric)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {c.attendancePct != null ? (
                        <span
                          className={
                            c.attendancePct >= 90
                              ? 'text-emerald-600'
                              : c.attendancePct >= 75
                                ? 'text-amber-600'
                                : 'text-red-600'
                          }
                        >
                          {c.attendancePct.toFixed(0)}%
                        </span>
                      ) : (
                        <span className="text-content-subtle">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={
                          c.remarks === 'Passed'
                            ? 'badge-success'
                            : c.remarks === 'At Risk'
                              ? 'badge-warning'
                              : c.remarks === 'Failed'
                                ? 'badge-danger'
                                : 'badge-neutral'
                        }
                      >
                        {c.remarks}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-xs text-content-subtle">
        You're viewing read-only data for your linked student. Final grades reflect published
        scores; attendance % counts late as attended and excludes excused days.
      </p>
    </div>
  );
}
