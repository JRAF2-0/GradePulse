import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useStudentClasses } from '@/hooks/useStudentClasses';
import { downloadCsv } from '@/utils/csvExport';
import { downloadPdf } from '@/utils/pdfExport';
import { formatNumeric } from '@/utils/conversionTable';
import { humanizeError } from '@/utils/errorMessage';
import type {
  DbGradeCategory,
  DbGradeItem,
  DbScore,
  Period,
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
            .in('grade_item_id', items.map((i) => i.id))
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
          return (
            s + (sc?.status === 'graded' && sc.score != null ? Number(sc.score) : 0)
          );
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
    rows.push(['Midterm Grade', '', '', '', '', data.midterm.percentage.toFixed(2) + '%',
      formatNumeric(data.midterm.numeric_grade), data.midterm.remarks]);
    rows.push(['Finals Grade', '', '', '', '', data.finals.percentage.toFixed(2) + '%',
      formatNumeric(data.finals.numeric_grade), data.finals.remarks]);
    rows.push(['Final Grade', '', '', '', '', data.final.percentage.toFixed(2) + '%',
      formatNumeric(data.final.numeric_grade), data.final.remarks]);

    downloadCsv(
      `gradepulse_${data.subjectCode}_${profile.full_name.replace(/\s+/g, '_')}`,
      rows,
    );
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
          return (
            s + (sc?.status === 'graded' && sc.score != null ? Number(sc.score) : 0)
          );
        }, 0);
        const catPct = totalMax > 0 ? (earned / totalMax) * 100 : 0;
        body.push([
          `${cat.name} (${cat.weight}%)`,
          '',
          '',
          '',
          `${catPct.toFixed(2)}%`,
        ]);
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
        { content: `${period.toUpperCase()} TOTAL`, colSpan: 2, styles: { fontStyle: 'bold' } } as never,
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
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-sm text-slate-600">
          Download your grade summary as CSV or PDF.
        </p>
      </header>

      <div className="card space-y-3">
        <div>
          <label className="label">Pick a class</label>
          {loading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : classes.length === 0 ? (
            <p className="text-sm text-slate-500">You're not enrolled in any class yet.</p>
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

        {error && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}

        {busy && <p className="text-sm text-slate-500">Loading report data…</p>}

        {data && !busy && (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <SummaryStat label="Midterm" pct={data.midterm.percentage} remarks={data.midterm.remarks} />
              <SummaryStat label="Finals" pct={data.finals.percentage} remarks={data.finals.remarks} />
              <SummaryStat label="Final" pct={data.final.percentage} remarks={data.final.remarks} primary />
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
    <div className={`rounded-md p-3 ring-1 ${primary ? 'bg-brand-50 ring-brand-200' : 'bg-slate-50 ring-slate-200'}`}>
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-bold">{pct.toFixed(2)}%</div>
      <div className="text-xs text-slate-600">{remarks}</div>
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
