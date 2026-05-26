import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useStudentClasses } from '@/hooks/useStudentClasses';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { formatNumeric } from '@/utils/conversionTable';
import type { PeriodGrade } from '@/hooks/useStudentClassDetail';

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
      setComputing(false);
    })();
  }, [user, classes]);

  const overallAverage =
    rows.length > 0
      ? rows.reduce((s, r) => s + r.final.percentage, 0) / rows.length
      : 0;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-slate-600">Your grade overview across all classes.</p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="card">
          <div className="text-xs uppercase tracking-wide text-slate-500">Classes</div>
          <div className="mt-1 text-3xl font-bold">{classes.length}</div>
        </div>
        <div className="card">
          <div className="text-xs uppercase tracking-wide text-slate-500">Overall Average</div>
          <div className="mt-1 text-3xl font-bold">{overallAverage.toFixed(2)}%</div>
        </div>
        <div className="card">
          <div className="text-xs uppercase tracking-wide text-slate-500">Status</div>
          <div className="mt-1">
            <span
              className={
                overallAverage >= 75
                  ? 'badge-success'
                  : overallAverage >= 70
                    ? 'badge-warning'
                    : 'badge-danger'
              }
            >
              {overallAverage >= 75
                ? 'Passing'
                : overallAverage >= 70
                  ? 'At Risk'
                  : overallAverage > 0
                    ? 'Failing'
                    : 'No grades yet'}
            </span>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">My Classes</h2>
        {loading || computing ? (
          <div className="card text-sm text-slate-500">Loading…</div>
        ) : classes.length === 0 ? (
          <div className="card text-sm text-slate-500">
            You haven't joined any class. Go to <Link className="text-brand-600 underline" to="/student/join">Join Class</Link>.
          </div>
        ) : (
          <div className="card overflow-x-auto p-0">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2">Subject</th>
                  <th className="px-4 py-2 text-right">Midterm</th>
                  <th className="px-4 py-2 text-right">Finals</th>
                  <th className="px-4 py-2 text-right">Final</th>
                  <th className="px-4 py-2 text-right">Equiv.</th>
                  <th className="px-4 py-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.classId} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link
                        to={`/student/classes/${r.classId}`}
                        className="block font-medium hover:text-brand-700"
                      >
                        <div className="font-mono text-xs uppercase text-slate-500">
                          {r.code}
                        </div>
                        {r.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right">{r.midterm.percentage.toFixed(2)}%</td>
                    <td className="px-4 py-3 text-right">{r.finals.percentage.toFixed(2)}%</td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {r.final.percentage.toFixed(2)}%
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
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
