import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useStudentClasses } from '@/hooks/useStudentClasses';
import { downloadCsv } from '@/utils/csvExport';
import { downloadPdf } from '@/utils/pdfExport';
import { formatNumeric } from '@/utils/conversionTable';
import { humanizeError } from '@/utils/errorMessage';
import type {
  DbFinalizedGrade,
  DbGradeCategory,
  DbGradeItem,
  DbScore,
  Period,
  Semester,
} from '@/types/database';

interface PeriodGradeRow {
  percentage: number;
  numeric_grade: number;
  remarks: string;
}

interface ReportData {
  className: string;
  subjectCode: string;
  schoolYear: string;
  semester: string;
  categories: DbGradeCategory[];
  items: DbGradeItem[];
  scores: DbScore[];
  midterm: PeriodGradeRow;
  finals: PeriodGradeRow;
  final: PeriodGradeRow;
}

export function StudentReports() {
  const { profile, user } = useAuth();
  const { classes, loading } = useStudentClasses();
  const [classId, setClassId] = useState<string>('');
  const [data, setData] = useState<ReportData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!classId) return;
    if (!user) return;
    void (async () => {
      setBusy(true);
      setError(null);

      const { data: studentRow } = await supabase
        .from('students')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!studentRow) {
        setError('Student profile not found');
        setBusy(false);
        return;
      }
      const studentId = studentRow.id;

      const klass = classes.find((c) => c.id === classId);
      if (!klass) {
        setError('Class not found');
        setBusy(false);
        return;
      }

      const categoriesRes = await supabase
        .from('grade_categories')
        .select('*')
        .eq('class_id', classId);
      if (categoriesRes.error) {
        setError(humanizeError(categoriesRes.error));
        setBusy(false);
        return;
      }
      const categories = categoriesRes.data ?? [];
      const categoryIds = categories.map((c) => c.id);

      let items: DbGradeItem[] = [];
      let scores: DbScore[] = [];
      if (categoryIds.length > 0) {
        const itemsRes = await supabase
          .from('grade_items')
          .select('*')
          .in('category_id', categoryIds)
          .eq('is_published', true);
        items = itemsRes.data ?? [];
        if (items.length > 0) {
          const scoresRes = await supabase
            .from('scores')
            .select('*')
            .in(
              'grade_item_id',
              items.map((i) => i.id),
            )
            .eq('student_id', studentId)
            .eq('is_draft', false);
          scores = scoresRes.data ?? [];
        }
      }

      const [mid, fin, final] = await Promise.all([
        callPeriod(classId, studentId, 'midterm'),
        callPeriod(classId, studentId, 'finals'),
        callFinal(classId, studentId),
      ]);

      setData({
        className: klass.subject.title,
        subjectCode: klass.subject.code,
        schoolYear: klass.school_year,
        semester: klass.semester,
        categories,
        items,
        scores,
        midterm: mid,
        finals: fin,
        final,
      });
      setBusy(false);
    })();
  }, [classId, user, classes]);

  const exportCsv = () => {
    if (!data || !profile) return;
    const rows: (string | number)[][] = [
      ['GradePulse Student Grade Report'],
      ['Student', profile.full_name],
      ['Subject', `${data.subjectCode} — ${data.className}`],
      ['Term', `${data.semester} · ${data.schoolYear}`],
      [],
      ['Period', 'Category', 'Weight %', 'Item', 'Max', 'Score', 'Status', 'Category %'],
    ];

    (['midterm', 'finals'] as Period[]).forEach((period) => {
      const periodCats = data.categories.filter((c) => c.period === period);
      periodCats.forEach((cat) => {
        const catItems = data.items.filter((i) => i.category_id === cat.id);
        const totalMax = catItems.reduce((s, i) => s + Number(i.max_score), 0);
        const earned = catItems.reduce((s, i) => {
          const sc = data.scores.find((x) => x.grade_item_id === i.id);
          return s + (sc?.status === 'graded' && sc.score != null ? Number(sc.score) : 0);
        }, 0);
        const catPct = totalMax > 0 ? (earned / totalMax) * 100 : 0;
        if (catItems.length === 0) {
          rows.push([period, cat.name, cat.weight, '(no items)', '', '', '', '']);
        }
        catItems.forEach((i, idx) => {
          const sc = data.scores.find((x) => x.grade_item_id === i.id);
          rows.push([
            period,
            cat.name,
            idx === 0 ? cat.weight : '',
            i.title,
            i.max_score,
            sc?.score ?? '',
            sc?.status ?? 'pending',
            idx === catItems.length - 1 ? catPct.toFixed(2) : '',
          ]);
        });
      });
    });

    rows.push([]);
    rows.push(['', '', '', '', '', '', '', '']);
    rows.push([
      'Midterm Grade',
      '',
      '',
      '',
      '',
      data.midterm.percentage.toFixed(2) + '%',
      formatNumeric(data.midterm.numeric_grade),
      data.midterm.remarks,
    ]);
    rows.push([
      'Finals Grade',
      '',
      '',
      '',
      '',
      data.finals.percentage.toFixed(2) + '%',
      formatNumeric(data.finals.numeric_grade),
      data.finals.remarks,
    ]);
    rows.push([
      'Final Grade',
      '',
      '',
      '',
      '',
      data.final.percentage.toFixed(2) + '%',
      formatNumeric(data.final.numeric_grade),
      data.final.remarks,
    ]);

    downloadCsv(`gradepulse_${data.subjectCode}_${profile.full_name.replace(/\s+/g, '_')}`, rows);
  };

  const exportPdf = () => {
    if (!data || !profile) return;

    const sections = [] as Parameters<typeof downloadPdf>[0]['sections'];

    (['midterm', 'finals'] as Period[]).forEach((period) => {
      const periodCats = data.categories.filter((c) => c.period === period);
      if (periodCats.length === 0) return;

      const body: (string | number)[][] = [];
      periodCats.forEach((cat) => {
        const catItems = data.items.filter((i) => i.category_id === cat.id);
        const totalMax = catItems.reduce((s, i) => s + Number(i.max_score), 0);
        const earned = catItems.reduce((s, i) => {
          const sc = data.scores.find((x) => x.grade_item_id === i.id);
          return s + (sc?.status === 'graded' && sc.score != null ? Number(sc.score) : 0);
        }, 0);
        const catPct = totalMax > 0 ? (earned / totalMax) * 100 : 0;
        body.push([`${cat.name} (${cat.weight}%)`, '', '', '', `${catPct.toFixed(2)}%`]);
        catItems.forEach((i) => {
          const sc = data.scores.find((x) => x.grade_item_id === i.id);
          body.push([
            `   ${i.title}`,
            String(i.max_score),
            sc?.score != null ? String(sc.score) : '—',
            sc?.status ?? 'pending',
            '',
          ]);
        });
      });

      const pg = period === 'midterm' ? data.midterm : data.finals;
      body.push([
        {
          content: `${period.toUpperCase()} TOTAL`,
          colSpan: 2,
          styles: { fontStyle: 'bold' },
        } as never,
        { content: `${pg.percentage.toFixed(2)}%`, styles: { fontStyle: 'bold' } } as never,
        { content: formatNumeric(pg.numeric_grade), styles: { fontStyle: 'bold' } } as never,
        { content: pg.remarks, styles: { fontStyle: 'bold' } } as never,
      ]);

      sections.push({
        title: period === 'midterm' ? 'Midterm Period' : 'Finals Period',
        head: [['Item', 'Max', 'Score', 'Status', 'Category %']],
        body,
      });
    });

    sections.push({
      title: 'Final Grade',
      head: [['', 'Percentage', '1.0–5.0 Equiv.', 'Remarks']],
      body: [
        [
          'Final',
          `${data.final.percentage.toFixed(2)}%`,
          formatNumeric(data.final.numeric_grade),
          data.final.remarks,
        ],
      ],
    });

    downloadPdf({
      title: 'Student Grade Report',
      subtitle: `${data.subjectCode} — ${data.className}`,
      meta: [
        { label: 'Student', value: profile.full_name },
        { label: 'Term', value: `${data.semester} · ${data.schoolYear}` },
      ],
      sections,
      filename: `gradepulse_${data.subjectCode}_${profile.full_name.replace(/\s+/g, '_')}`,
    });
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
        <p className="text-sm text-content-muted">
          Download a grade summary for one class, or a full semester transcript.
        </p>
      </header>

      <TranscriptSection />

      <div className="card space-y-3">
        <div>
          <label className="label">Pick a class</label>
          {loading ? (
            <p className="text-sm text-content-subtle">Loading…</p>
          ) : classes.length === 0 ? (
            <p className="text-sm text-content-subtle">You're not enrolled in any class yet.</p>
          ) : (
            <select className="input" value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">— select —</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.subject.code} — {c.subject.title} ({c.semester} {c.school_year})
                </option>
              ))}
            </select>
          )}
        </div>

        {error && (
          <div className="rounded-xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-600 ring-1 ring-red-500/30 dark:text-red-300">
            {error}
          </div>
        )}

        {busy && <p className="text-sm text-content-subtle">Loading report data…</p>}

        {data && !busy && (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <SummaryStat
                label="Midterm"
                pct={data.midterm.percentage}
                remarks={data.midterm.remarks}
              />
              <SummaryStat
                label="Finals"
                pct={data.finals.percentage}
                remarks={data.finals.remarks}
              />
              <SummaryStat
                label="Final"
                pct={data.final.percentage}
                remarks={data.final.remarks}
                primary
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={exportCsv} className="btn-secondary">
                Download CSV
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

function SummaryStat({
  label,
  pct,
  remarks,
  primary,
}: {
  label: string;
  pct: number;
  remarks: string;
  primary?: boolean;
}) {
  return (
    <div
      className={`rounded-md p-3 ring-1 ${primary ? 'bg-brand-500/10 ring-brand-500/30' : 'bg-surface-2 ring-line'}`}
    >
      <div className="text-xs uppercase tracking-wide text-content-subtle">{label}</div>
      <div className="mt-1 text-xl font-bold">{pct.toFixed(2)}%</div>
      <div className="text-xs text-content-muted">{remarks}</div>
    </div>
  );
}

interface TranscriptClass {
  classId: string;
  subjectCode: string;
  subjectTitle: string;
  units: number;
  finalPercentage: number;
  finalNumeric: number;
  remarks: string;
  finalized: boolean;
}

function TranscriptSection() {
  const { profile, user } = useAuth();
  const { classes, loading: classesLoading } = useStudentClasses();
  const [studentId, setStudentId] = useState<string | null>(null);
  const [studentNo, setStudentNo] = useState<string | null>(null);
  const [studentCourse, setStudentCourse] = useState<string | null>(null);
  const [termKey, setTermKey] = useState<string>('');
  const [rows, setRows] = useState<TranscriptClass[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deansList, setDeansList] = useState(false);

  // Build unique term options from the student's classes
  const termOptions = useMemo(() => {
    const seen = new Map<string, { year: string; sem: Semester }>();
    for (const c of classes) {
      const key = `${c.school_year}__${c.semester}`;
      if (!seen.has(key)) {
        seen.set(key, { year: c.school_year, sem: c.semester as Semester });
      }
    }
    return Array.from(seen.entries()).map(([key, v]) => ({
      key,
      ...v,
      label: `${v.sem} · ${v.year}`,
    }));
  }, [classes]);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data } = await supabase
        .from('students')
        .select('id, student_no, course')
        .eq('user_id', user.id)
        .maybeSingle();
      const row = data as { id: string; student_no: string | null; course: string | null } | null;
      setStudentId(row?.id ?? null);
      setStudentNo(row?.student_no ?? null);
      setStudentCourse(row?.course ?? null);
    })();
  }, [user]);

  useEffect(() => {
    if (!termKey || !studentId) {
      setRows([]);
      setDeansList(false);
      return;
    }
    const term = termOptions.find((t) => t.key === termKey);
    if (!term) return;

    void (async () => {
      setLoading(true);
      setError(null);
      // Pull all of the student's classes for this term
      const termClasses = classes.filter(
        (c) => c.school_year === term.year && c.semester === term.sem,
      );
      // For each class, get final percentage + numeric grade + units. Prefer
      // finalized_grades when available; otherwise fall back to live
      // compute_final_grade so the transcript is at least informative.
      const classIds = termClasses.map((c) => c.id);
      const { data: finalsRows } = await supabase
        .from('finalized_grades')
        .select('class_id, period, percentage, numeric_grade, remarks')
        .in('class_id', classIds.length ? classIds : ['00000000-0000-0000-0000-000000000000'])
        .eq('student_id', studentId)
        .eq('period', 'finals');
      const finalsByClass = new Map<string, DbFinalizedGrade>();
      for (const r of (finalsRows as DbFinalizedGrade[]) ?? []) {
        finalsByClass.set(r.class_id, r);
      }

      const out: TranscriptClass[] = [];
      for (const c of termClasses) {
        const fin = finalsByClass.get(c.id);
        if (fin) {
          out.push({
            classId: c.id,
            subjectCode: c.subject.code,
            subjectTitle: c.subject.title,
            units: Number(c.subject.units ?? 3),
            finalPercentage: Number(fin.percentage),
            finalNumeric: Number(fin.numeric_grade),
            remarks: fin.remarks,
            finalized: true,
          });
        } else {
          // fall back to live computation
          const { data } = await supabase.rpc('compute_final_grade', {
            p_class_id: c.id,
            p_student_id: studentId,
          });
          const row = Array.isArray(data) && data.length > 0 ? (data[0] as PeriodGradeRow) : null;
          out.push({
            classId: c.id,
            subjectCode: c.subject.code,
            subjectTitle: c.subject.title,
            units: Number(c.subject.units ?? 3),
            finalPercentage: row ? Number(row.percentage) : 0,
            finalNumeric: row ? Number(row.numeric_grade) : 5.0,
            remarks: row?.remarks ?? 'No grades yet',
            finalized: false,
          });
        }
      }
      setRows(out);

      const { data: ok } = await supabase.rpc('is_dean_list_eligible', {
        p_student_id: studentId,
        p_school_year: term.year,
        p_semester: term.sem,
      });
      setDeansList(Boolean(ok));
      setLoading(false);
    })();
  }, [termKey, studentId, termOptions, classes]);

  const totalUnits = rows.reduce((s, r) => s + r.units, 0);
  const weightedGpa =
    totalUnits > 0 ? rows.reduce((s, r) => s + r.finalNumeric * r.units, 0) / totalUnits : 0;

  const downloadTranscript = () => {
    if (!profile) return;
    const term = termOptions.find((t) => t.key === termKey);
    if (!term) return;

    const allFinalized = rows.every((r) => r.finalized);

    downloadPdf({
      title: 'Semester Transcript',
      subtitle: `${term.sem} · ${term.year}`,
      meta: [
        { label: 'Student', value: profile.full_name },
        { label: 'Student #', value: studentNo ?? '—' },
        { label: 'Course', value: studentCourse ?? '—' },
        {
          label: 'Status',
          value: deansList
            ? "🏅 Dean's List"
            : allFinalized
              ? 'Finalized'
              : 'In-progress (some classes not yet finalized)',
        },
      ],
      sections: [
        {
          title: 'Subjects',
          head: [['Code', 'Title', 'Units', 'Final %', 'Equiv.', 'Remarks']],
          body: rows.map((r) => [
            r.subjectCode,
            r.subjectTitle,
            r.units.toFixed(1),
            `${r.finalPercentage.toFixed(2)}%`,
            formatNumeric(r.finalNumeric),
            r.finalized ? r.remarks : `${r.remarks} (provisional)`,
          ]),
        },
        {
          title: 'Summary',
          head: [['Total Units', 'Weighted GPA', "Dean's List"]],
          body: [[totalUnits.toFixed(1), formatNumeric(weightedGpa), deansList ? 'Yes' : 'No']],
        },
      ],
      filename: `gradepulse_transcript_${term.year}_${term.sem}_${profile.full_name.replace(/\s+/g, '_')}`,
    });
  };

  return (
    <div className="card space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Semester Transcript</h2>
        <p className="text-xs text-content-subtle">
          A full grade summary for one term — every class, final grade, units, weighted GPA, and
          Dean's List eligibility.
        </p>
      </div>

      <div>
        <label className="label">Term</label>
        {classesLoading ? (
          <p className="text-sm text-content-subtle">Loading…</p>
        ) : termOptions.length === 0 ? (
          <p className="text-sm text-content-subtle">No classes joined yet.</p>
        ) : (
          <select className="input" value={termKey} onChange={(e) => setTermKey(e.target.value)}>
            <option value="">— select —</option>
            {termOptions.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        )}
      </div>

      {error && (
        <div className="rounded-xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-600 ring-1 ring-red-500/30 dark:text-red-300">
          {error}
        </div>
      )}

      {loading && <p className="text-sm text-content-subtle">Building transcript…</p>}

      {!loading && termKey && rows.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-md border border-line">
            <table className="min-w-full divide-y divide-line text-sm">
              <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-content-subtle">
                <tr>
                  <th className="px-3 py-2">Code</th>
                  <th className="px-3 py-2">Title</th>
                  <th className="px-3 py-2 text-right">Units</th>
                  <th className="px-3 py-2 text-right">Final %</th>
                  <th className="px-3 py-2 text-right">Equiv.</th>
                  <th className="px-3 py-2">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.classId}>
                    <td className="px-3 py-2 font-mono text-xs uppercase text-content-subtle">
                      {r.subjectCode}
                    </td>
                    <td className="px-3 py-2">{r.subjectTitle}</td>
                    <td className="px-3 py-2 text-right">{r.units.toFixed(1)}</td>
                    <td className="px-3 py-2 text-right">{r.finalPercentage.toFixed(2)}%</td>
                    <td className="px-3 py-2 text-right font-mono">
                      {formatNumeric(r.finalNumeric)}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {r.remarks}
                      {!r.finalized && <span className="ml-1 text-amber-700">(provisional)</span>}
                    </td>
                  </tr>
                ))}
                <tr className="bg-surface-2 font-semibold">
                  <td colSpan={2} className="px-3 py-2">
                    Total / Weighted GPA
                  </td>
                  <td className="px-3 py-2 text-right">{totalUnits.toFixed(1)}</td>
                  <td></td>
                  <td className="px-3 py-2 text-right font-mono">{formatNumeric(weightedGpa)}</td>
                  <td className="px-3 py-2 text-xs">
                    {deansList && <span className="badge-success">🏅 Dean's List</span>}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="flex justify-end">
            <button onClick={downloadTranscript} className="btn-primary">
              Download Transcript PDF
            </button>
          </div>
        </>
      )}

      {!loading && termKey && rows.length === 0 && (
        <p className="text-sm text-content-subtle">No classes found for this term.</p>
      )}
    </div>
  );
}

async function callPeriod(
  classId: string,
  studentId: string,
  period: Period,
): Promise<PeriodGradeRow> {
  const { data } = await supabase.rpc('compute_period_grade', {
    p_class_id: classId,
    p_student_id: studentId,
    p_period: period,
  });
  if (!Array.isArray(data) || data.length === 0) {
    return { percentage: 0, numeric_grade: 5.0, remarks: 'No grades yet' };
  }
  const r = data[0] as PeriodGradeRow;
  return {
    percentage: Number(r.percentage),
    numeric_grade: Number(r.numeric_grade),
    remarks: r.remarks,
  };
}

async function callFinal(classId: string, studentId: string): Promise<PeriodGradeRow> {
  const { data } = await supabase.rpc('compute_final_grade', {
    p_class_id: classId,
    p_student_id: studentId,
  });
  if (!Array.isArray(data) || data.length === 0) {
    return { percentage: 0, numeric_grade: 5.0, remarks: 'No grades yet' };
  }
  const r = data[0] as PeriodGradeRow;
  return {
    percentage: Number(r.percentage),
    numeric_grade: Number(r.numeric_grade),
    remarks: r.remarks,
  };
}
