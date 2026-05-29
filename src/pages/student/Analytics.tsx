import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useStudentClasses } from '@/hooks/useStudentClasses';
import type {
  DbGradeCategory,
  DbGradeItem,
  DbScore,
  Period,
} from '@/types/database';

interface ClassOption {
  id: string;
  label: string;
  school_year: string;
  semester: string;
}

interface TrendPoint {
  label: string;
  date: string;
  percent: number;
}

interface CategoryRow {
  name: string;
  period: Period;
  avgPct: number;
  contribution: number;
  weight: number;
}

const PIE_COLORS = [
  '#0ea5e9',
  '#22c55e',
  '#f59e0b',
  '#a855f7',
  '#ef4444',
  '#06b6d4',
  '#84cc16',
  '#f97316',
];

export function StudentAnalytics() {
  const { user } = useAuth();
  const { classes, loading: classesLoading } = useStudentClasses();
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [period, setPeriod] = useState<Period>('midterm');
  const [studentId, setStudentId] = useState<string | null>(null);
  const [categories, setCategories] = useState<DbGradeCategory[]>([]);
  const [items, setItems] = useState<DbGradeItem[]>([]);
  const [scores, setScores] = useState<DbScore[]>([]);
  const [loading, setLoading] = useState(false);

  const classOptions: ClassOption[] = useMemo(
    () =>
      classes.map((c) => ({
        id: c.id,
        label: `${c.subject.code} — ${c.subject.title}${c.section ? ` (${c.section})` : ''}`,
        school_year: c.school_year,
        semester: c.semester,
      })),
    [classes],
  );

  useEffect(() => {
    if (!selectedClassId && classOptions.length > 0) {
      setSelectedClassId(classOptions[0].id);
    }
  }, [classOptions, selectedClassId]);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data } = await supabase
        .from('students')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      setStudentId((data as { id: string } | null)?.id ?? null);
    })();
  }, [user]);

  useEffect(() => {
    if (!selectedClassId || !studentId) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const { data: cats } = await supabase
        .from('grade_categories')
        .select('*')
        .eq('class_id', selectedClassId);
      const catList = (cats as DbGradeCategory[]) ?? [];
      let itemList: DbGradeItem[] = [];
      let scoreList: DbScore[] = [];
      if (catList.length > 0) {
        const { data: itm } = await supabase
          .from('grade_items')
          .select('*')
          .in(
            'category_id',
            catList.map((c) => c.id),
          )
          .eq('is_published', true);
        itemList = (itm as DbGradeItem[]) ?? [];
        if (itemList.length > 0) {
          const { data: scs } = await supabase
            .from('scores')
            .select('*')
            .in(
              'grade_item_id',
              itemList.map((i) => i.id),
            )
            .eq('student_id', studentId)
            .eq('is_draft', false);
          scoreList = (scs as DbScore[]) ?? [];
        }
      }
      if (cancelled) return;
      setCategories(catList);
      setItems(itemList);
      setScores(scoreList);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedClassId, studentId]);

  const trendData: TrendPoint[] = useMemo(() => {
    const periodCatIds = new Set(
      categories.filter((c) => c.period === period).map((c) => c.id),
    );
    return items
      .filter((i) => periodCatIds.has(i.category_id))
      .map((i) => {
        const sc = scores.find((s) => s.grade_item_id === i.id);
        if (!sc || sc.score == null || sc.status !== 'graded') return null;
        const pct = (Number(sc.score) / Number(i.max_score)) * 100;
        const when = sc.updated_at ?? new Date().toISOString();
        return {
          label: i.title,
          date: when,
          percent: Number(pct.toFixed(2)),
        };
      })
      .filter((x): x is TrendPoint => x !== null)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [items, scores, categories, period]);

  const categoryRows: CategoryRow[] = useMemo(() => {
    return categories
      .filter((c) => c.period === period)
      .map((c) => {
        const catItems = items.filter((i) => i.category_id === c.id);
        const totalMax = catItems.reduce((s, i) => s + Number(i.max_score), 0);
        const earned = catItems.reduce((s, i) => {
          const sc = scores.find((x) => x.grade_item_id === i.id);
          return (
            s +
            (sc && sc.status === 'graded' && sc.score != null
              ? Number(sc.score)
              : 0)
          );
        }, 0);
        const pct = totalMax > 0 ? (earned / totalMax) * 100 : 0;
        return {
          name: c.name,
          period: c.period,
          avgPct: Number(pct.toFixed(2)),
          contribution: Number(((pct * Number(c.weight)) / 100).toFixed(2)),
          weight: Number(c.weight),
        };
      });
  }, [categories, items, scores, period]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-sm text-content-muted">
          Track your grade trend over time and see where your points are coming from.
        </p>
      </header>

      <section className="card flex flex-wrap items-end gap-3">
        <div className="grow">
          <label className="label">Class</label>
          <select
            className="input"
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            disabled={classesLoading}
          >
            {classOptions.length === 0 && <option value="">No classes joined yet</option>}
            {classOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Period</label>
          <div className="flex gap-1 rounded-md bg-surface-3 p-1 text-sm">
            {(['midterm', 'finals'] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`rounded px-3 py-1 capitalize ${
                  period === p ? 'bg-surface shadow-sm font-medium' : 'text-content-muted'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </section>

      {loading ? (
        <div className="card text-sm text-content-subtle">Loading…</div>
      ) : !selectedClassId || items.length === 0 ? (
        <div className="card text-sm text-content-subtle">
          No published grades to chart yet for this {period}.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="Grade trend over time" subtitle="% per item, in order recorded">
            {trendData.length === 0 ? (
              <EmptyState text="No graded items yet for this period." />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart
                  data={trendData}
                  margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10 }}
                    interval={0}
                    angle={-25}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Tooltip
                    formatter={(v: number) => `${v}%`}
                    labelFormatter={(l) => `Item: ${l}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="percent"
                    stroke="#0ea5e9"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="Performance by category" subtitle="Average % score per category">
            {categoryRows.length === 0 ? (
              <EmptyState text="No categories set up for this period." />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={categoryRows}
                  margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => `${v}%`} />
                  <Bar dataKey="avgPct" fill="#22c55e" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard
            title="Contribution to grade"
            subtitle="How each category contributes (weighted) to this period's total"
          >
            {categoryRows.every((r) => r.contribution === 0) ? (
              <EmptyState text="No graded items to contribute yet." />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={categoryRows.filter((r) => r.contribution > 0)}
                    dataKey="contribution"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={(entry) => `${entry.name} (${entry.contribution} pts)`}
                  >
                    {categoryRows.map((_, idx) => (
                      <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${v} pts`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard
            title="Summary"
            subtitle={`Period: ${period[0].toUpperCase() + period.slice(1)}`}
          >
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-content-subtle">
                <tr>
                  <th className="py-1">Category</th>
                  <th className="py-1 text-right">Weight</th>
                  <th className="py-1 text-right">Avg %</th>
                  <th className="py-1 text-right">Contribution</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {categoryRows.map((r) => (
                  <tr key={r.name}>
                    <td className="py-1">{r.name}</td>
                    <td className="py-1 text-right">{r.weight}%</td>
                    <td className="py-1 text-right">{r.avgPct}%</td>
                    <td className="py-1 text-right font-semibold">{r.contribution} pts</td>
                  </tr>
                ))}
                {categoryRows.length > 0 && (
                  <tr className="font-semibold">
                    <td className="py-1">Total</td>
                    <td className="py-1 text-right">
                      {categoryRows.reduce((s, r) => s + r.weight, 0)}%
                    </td>
                    <td></td>
                    <td className="py-1 text-right">
                      {categoryRows
                        .reduce((s, r) => s + r.contribution, 0)
                        .toFixed(2)}{' '}
                      pts
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </ChartCard>
        </div>
      )}
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card">
      <div className="mb-2">
        <h3 className="font-semibold">{title}</h3>
        {subtitle && <p className="text-xs text-content-subtle">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex h-[260px] items-center justify-center text-sm text-content-subtle">
      {text}
    </div>
  );
}
