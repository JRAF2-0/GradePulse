import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { humanizeError } from '@/utils/errorMessage';
import type { BiasSignal, BiasSignalType } from '@/types/database';

const SIGNAL_META: Record<
  BiasSignalType,
  { label: string; blurb: string; tone: string }
> = {
  below_dept_avg: {
    label: 'Below department average',
    blurb: 'Class mean is more than 1 SD under the department mean',
    tone: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-amber-500/30',
  },
  section_divergence: {
    label: 'Section divergence',
    blurb: 'One section trails sibling sections of the same subject + teacher',
    tone: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 ring-purple-500/30',
  },
  high_fail_rate: {
    label: 'High failing rate',
    blurb: '≥30% of the class has a failing final grade',
    tone: 'bg-red-500/15 text-red-700 dark:text-red-300 ring-red-500/30',
  },
  entry_burst: {
    label: 'Grade entry burst',
    blurb: '>50 score changes recorded in a single day',
    tone: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 ring-sky-500/30',
  },
};

export function BiasSignals() {
  const [signals, setSignals] = useState<BiasSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<BiasSignalType | 'all'>('all');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      const { data, error: err } = await supabase.rpc('compute_bias_signals');
      if (cancelled) return;
      if (err) {
        setError(humanizeError(err));
        setLoading(false);
        return;
      }
      setSignals((data as BiasSignal[]) ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const s of signals) c[s.signal_type] = (c[s.signal_type] ?? 0) + 1;
    return c;
  }, [signals]);

  const filtered = signals.filter(
    (s) => typeFilter === 'all' || s.signal_type === typeFilter,
  );

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Bias &amp; anomaly signals</h1>
        <p className="text-sm text-content-muted">
          Statistical flags worth a closer look across finalized classes.
        </p>
      </header>

      <div className="rounded-md border border-amber-200 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300 dark:text-amber-200">
        <strong>These are signals, not accusations.</strong> Each flag is a statistical
        pattern that may have a perfectly valid explanation (a genuinely hard section, a small
        class, a legitimate bulk correction). Use them as a starting point for a conversation,
        never as a verdict. Only <strong>finalized</strong> classes are analyzed.
      </div>

      {error && (
        <div className="rounded-xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-600 ring-1 ring-red-500/30 dark:text-red-300">{error}</div>
      )}

      <div className="card flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">Filter:</span>
        <button
          onClick={() => setTypeFilter('all')}
          className={`rounded-md px-3 py-1 text-xs ${
            typeFilter === 'all' ? 'bg-brand-600 text-white' : 'bg-surface-3 text-content-muted'
          }`}
        >
          All ({signals.length})
        </button>
        {(Object.keys(SIGNAL_META) as BiasSignalType[]).map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`rounded-md px-3 py-1 text-xs ${
              typeFilter === t ? 'bg-brand-600 text-white' : 'bg-surface-3 text-content-muted'
            }`}
          >
            {SIGNAL_META[t].label} ({counts[t] ?? 0})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card text-sm text-content-subtle">Analyzing…</div>
      ) : filtered.length === 0 ? (
        <div className="card text-sm text-content-subtle">
          {signals.length === 0
            ? 'No anomalies detected in finalized classes. 🎉'
            : 'No signals of this type.'}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((s, idx) => {
            const meta = SIGNAL_META[s.signal_type];
            return (
              <div key={`${s.class_id}-${s.signal_type}-${idx}`} className="card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex-1">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium uppercase tracking-wide ring-1 ${meta.tone}`}
                    >
                      {meta.label}
                    </span>
                    <div className="mt-1 font-semibold">
                      <span className="font-mono text-xs uppercase text-content-subtle">
                        {s.subject_code}
                      </span>{' '}
                      {s.subject_title}
                      {s.section ? (
                        <span className="text-sm font-normal text-content-subtle">
                          {' '}
                          · Section {s.section}
                        </span>
                      ) : null}
                    </div>
                    <div className="text-xs text-content-subtle">
                      Teacher: {s.teacher_name ?? '—'}
                      {s.department_name ? ` · ${s.department_name}` : ''}
                    </div>
                    <p className="mt-2 text-sm text-content-muted">{s.detail}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-xs uppercase tracking-wide text-content-subtle">
                      Metric
                    </div>
                    <div className="text-3xl font-bold tracking-tight">{Number(s.metric)}</div>
                    <div className="text-xs text-content-subtle">
                      benchmark: {Number(s.benchmark)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
