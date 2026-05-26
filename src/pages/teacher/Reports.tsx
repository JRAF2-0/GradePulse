import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useTeacherClasses } from '@/hooks/useTeacherClasses';
import { useClassDetail, type ClassDetail } from '@/hooks/useClassDetail';
import { downloadCsv } from '@/utils/csvExport';
import { downloadPdf } from '@/utils/pdfExport';
import { formatNumeric } from '@/utils/conversionTable';
import type { Period } from '@/types/database';

interface ComputedRow {
  studentId: string;
  fullName: string;
  studentNo: string | null;
  midtermPct: number;
  midtermNum: number;
  finalsPct: number;
  finalsNum: number;
  finalPct: number;
  finalNum: number;
  remarks: string;
}

export function TeacherReports() {
  const { classes, loading: classesLoading } = useTeacherClasses();
  const [classId, setClassId] = useState<string>('');
  const { data, loading } = useClassDetail(classId || undefined);
  const [computed, setComputed] = useState<ComputedRow[]>([]);
  const [computing, setComputing] = useState(false);

  useEffect(() => {
    if (!data) {
      setComputed([]);
      return;
    }
    void (async () => {
      setComputing(true);
      const rows: ComputedRow[] = [];
      for (const r of data.roster) {
        const [mid, fin, final] = await Promise.all([
          supabase.rpc('compute_period_grade', {
            p_class_id: data.class.id,
            p_student_id: r.student_id,
            p_period: 'midterm',
          }),
          supabase.rpc('compute_period_grade', {
            p_class_id: data.class.id,
            p_student_id: r.student_id,
            p_period: 'finals',
          }),
          supabase.rpc('compute_final_grade', {
            p_class_id: data.class.id,
            p_student_id: r.student_id,
          }),
        ]);
        const m = pickRow(mid.data);
        const f = pickRow(fin.data);
        const fi = pickRow(final.data);
        rows.push({
          studentId: r.student_id,
          fullName: r.full_name,
          studentNo: r.student_no,
          midtermPct: m.percentage,
          midtermNum: m.numeric_grade,
          finalsPct: f.percentage,
          finalsNum: f.numeric_grade,
          finalPct: fi.percentage,
          finalNum: fi.numeric_grade,
          remarks: fi.remarks,
        });
      }
      setComputed(rows);
      setComputing(false);
    })();
  }, [data]);

  const klass = classes.find((c) => c.id === classId);

  const exportSummaryCsv = () => {
    if (!data || !klass) return;
    const rows: (string | number)[][] = [
      ['GradePulse Class Grade Summary'],
      ['Class', `${klass.subject.code} — ${klass.subject.title}`],
      ['Term', `${klass.semester} · ${klass.school_year}`],
      ['Section', klass.section ?? ''],
      [],
      ['Student #', 'Name', 'Midterm %', 'Midterm Eq.', 'Finals %', 'Finals Eq.', 'Final %', 'Final Eq.', 'Remarks'],
      ...computed.map((r) => [
        r.studentNo ?? '',
        r.fullName,
        r.midtermPct.toFixed(2),
        formatNumeric(r.midtermNum),
        r.finalsPct.toFixed(2),
        formatNumeric(r.finalsNum),
        r.finalPct.toFixed(2),
        formatNumeric(r.finalNum),
        r.remarks,
      ]),
    ];
    downloadCsv(`gradepulse_${klass.subject.code}_summary`, rows);
  };

  const exportDetailedCsv = () => {
    if (!data || !klass) return;
    const sortedItems = [...data.items].sort((a, b) => {
      const ca = data.categories.find((c) => c.id === a.category_id);
      const cb = data.categories.find((c) => c.id === b.category_id);
      const pa = ca?.period === 'midterm' ? 0 : 1;
      const pb = cb?.period === 'midterm' ? 0 : 1;
      if (pa !== pb) return pa - pb;
      return a.title.localeCompare(b.title);
    });
    const header: (string | number)[] = ['Student #', 'Name'];
    sortedItems.forEach((i) => {
      const cat = data.categories.find((c) => c.id === i.category_id);
      header.push(`[${cat?.period}] ${i.title} (/${i.max_score})`);
    });
    const rows: (string | number)[][] = [header];
    data.roster.forEach((r) => {
      const row: (string | number)[] = [r.student_no ?? '', r.full_name];
      sortedItems.forEach((i) => {
        const sc = data.scores.find(
          (s) => s.grade_item_id === i.id && s.student_id === r.student_id,
        );
        row.push(
          sc?.status === 'graded' && sc.score != null ? sc.score : sc?.status ?? '',
        );
      });
      rows.push(row);
    });
    downloadCsv(`gradepulse_${klass.subject.code}_detailed`, rows);
  };

  const exportPdf = () => {
    if (!data || !klass) return;
    downloadPdf({
      title: 'Class Grade Summary',
      subtitle: `${klass.subject.code} — ${klass.subject.title}`,
      meta: [
        { label: 'Section', value: klass.section ?? '—' },
        { label: 'Term', value: `${klass.semester} · ${klass.school_year}` },
        { label: 'Students', value: String(computed.length) },
        { label: 'Grade items', value: String(data.items.length) },
      ],
      sections: [
        {
          title: 'Student Grades',
          head: [
            ['Student #', 'Name', 'Midterm', 'Finals', 'Final', 'Equiv.', 'Remarks'],
          ],
          body: computed.map((r) => [
            r.studentNo ?? '—',
            r.fullName,
            `${r.midtermPct.toFixed(2)}%`,
            `${r.finalsPct.toFixed(2)}%`,
            `${r.finalPct.toFixed(2)}%`,
            formatNumeric(r.finalNum),
            r.remarks,
          ]),
        },
      ],
      filename: `gradepulse_${klass.subject.code}_class_report`,
    });
  };

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-sm text-slate-600">Export class grades as CSV or PDF.</p>
      </header>

      <div className="card space-y-3">
        <div>
          <label className="label">Pick a class</label>
          {classesLoading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : classes.length === 0 ? (
            <p className="text-sm text-slate-500">No classes yet.</p>
          ) : (
            <select
              className="input"
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
            >
              <option value="">— select —</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.subject.code} — {c.subject.title} ({c.semester} {c.school_year})
                </option>
              ))}
            </select>
          )}
        </div>

        {(loading || computing) && classId && (
          <p className="text-sm text-slate-500">Computing grades…</p>
        )}

        {data && !computing && klass && (
          <>
            <Preview data={data} computed={computed} />
            <div className="flex flex-wrap gap-2 pt-2">
              <button onClick={exportSummaryCsv} className="btn-secondary">
                Summary CSV
              </button>
              <button onClick={exportDetailedCsv} className="btn-secondary">
                Detailed CSV (per item)
              </button>
              <button onClick={exportPdf} className="btn-primary">
                Download PDF
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Preview({ data, computed }: { data: ClassDetail; computed: ComputedRow[] }) {
  return (
    <div className="overflow-x-auto rounded-md ring-1 ring-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-xs">
        <thead className="bg-slate-50 text-left uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2">Student</th>
            <th className="px-3 py-2 text-right">Midterm</th>
            <th className="px-3 py-2 text-right">Finals</th>
            <th className="px-3 py-2 text-right">Final</th>
            <th className="px-3 py-2 text-right">Equiv.</th>
            <th className="px-3 py-2">Remarks</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {computed.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-3 py-4 text-center text-slate-500">
                {data.roster.length === 0 ? 'No students enrolled.' : 'No grades yet.'}
              </td>
            </tr>
          ) : (
            computed.map((r) => (
              <tr key={r.studentId}>
                <td className="px-3 py-2">{r.fullName}</td>
                <td className="px-3 py-2 text-right">{r.midtermPct.toFixed(2)}%</td>
                <td className="px-3 py-2 text-right">{r.finalsPct.toFixed(2)}%</td>
                <td className="px-3 py-2 text-right font-semibold">
                  {r.finalPct.toFixed(2)}%
                </td>
                <td className="px-3 py-2 text-right font-mono">
                  {formatNumeric(r.finalNum)}
                </td>
                <td className="px-3 py-2">{r.remarks}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function pickRow(d: unknown): { percentage: number; numeric_grade: number; remarks: string } {
  if (!Array.isArray(d) || d.length === 0) {
    return { percentage: 0, numeric_grade: 5.0, remarks: 'No grades yet' };
  }
  const r = d[0] as { percentage: number; numeric_grade: number; remarks: string };
  return {
    percentage: Number(r.percentage),
    numeric_grade: Number(r.numeric_grade),
    remarks: r.remarks,
  };
}

export type { Period };
