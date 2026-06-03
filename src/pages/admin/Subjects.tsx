import { FormEvent, useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { humanizeError } from '@/utils/errorMessage';
import type { DbSubject } from '@/types/database';

export function AdminSubjects() {
  const [subjects, setSubjects] = useState<DbSubject[]>([]);
  const [classCounts, setClassCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<DbSubject | 'new' | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [subjectsRes, classesRes] = await Promise.all([
      supabase.from('subjects').select('*').order('code'),
      supabase.from('classes').select('subject_id'),
    ]);
    setLoading(false);
    if (subjectsRes.error) {
      setError(humanizeError(subjectsRes.error));
      return;
    }
    setSubjects(subjectsRes.data ?? []);

    const counts: Record<string, number> = {};
    ((classesRes.data ?? []) as { subject_id: string }[]).forEach((c) => {
      counts[c.subject_id] = (counts[c.subject_id] ?? 0) + 1;
    });
    setClassCounts(counts);
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const onDelete = async (subject: DbSubject) => {
    const inUse = classCounts[subject.id] ?? 0;
    if (inUse > 0) {
      setError(
        `Cannot delete "${subject.code}" — ${inUse} class${inUse === 1 ? '' : 'es'} still use this subject. Remove or reassign them first.`,
      );
      return;
    }
    if (!confirm(`Delete subject "${subject.code} — ${subject.title}"?`)) return;
    const { error: err } = await supabase.from('subjects').delete().eq('id', subject.id);
    if (err) {
      setError(humanizeError(err));
      return;
    }
    setError(null);
    void fetchAll();
  };

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Subjects</h1>
          <p className="text-sm text-content-muted">
            Subject catalog. Teachers create classes off this list.
          </p>
        </div>
        <button onClick={() => setEditing('new')} className="btn-primary">
          + Add Subject
        </button>
      </header>

      {error && (
        <div className="rounded-xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-600 ring-1 ring-red-500/30 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="card overflow-x-auto p-0">
        <table className="min-w-full divide-y divide-line text-sm">
          <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-content-subtle">
            <tr>
              <th className="px-4 py-2">Code</th>
              <th className="px-4 py-2">Title</th>
              <th className="px-4 py-2">Units</th>
              <th className="px-4 py-2">Classes</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-content-subtle">
                  Loading…
                </td>
              </tr>
            ) : subjects.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-content-subtle">
                  No subjects yet. Add one to get started.
                </td>
              </tr>
            ) : (
              subjects.map((s) => {
                const inUse = classCounts[s.id] ?? 0;
                return (
                  <tr key={s.id}>
                    <td className="px-4 py-2 font-mono">{s.code}</td>
                    <td className="px-4 py-2 font-medium">{s.title}</td>
                    <td className="px-4 py-2 text-content-muted">{s.units ?? '—'}</td>
                    <td className="px-4 py-2 text-content-muted">{inUse}</td>
                    <td className="px-4 py-2 text-right">
                      <button onClick={() => setEditing(s)} className="btn-secondary mr-2 text-xs">
                        Edit
                      </button>
                      <button
                        onClick={() => void onDelete(s)}
                        disabled={inUse > 0}
                        title={
                          inUse > 0
                            ? `Cannot delete — ${inUse} class${inUse === 1 ? '' : 'es'} still use this subject`
                            : 'Delete subject'
                        }
                        className="btn-danger text-xs disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <SubjectForm
          subject={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void fetchAll();
          }}
        />
      )}
    </div>
  );
}

function SubjectForm({
  subject,
  onClose,
  onSaved,
}: {
  subject: DbSubject | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [code, setCode] = useState(subject?.code ?? '');
  const [title, setTitle] = useState(subject?.title ?? '');
  const [units, setUnits] = useState(subject?.units?.toString() ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const payload = {
      code: code.trim(),
      title: title.trim(),
      units: units ? Number(units) : null,
    };
    const { error: err } = subject
      ? await supabase.from('subjects').update(payload).eq('id', subject.id)
      : await supabase.from('subjects').insert(payload);
    setBusy(false);
    if (err) {
      setError(humanizeError(err));
      return;
    }
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in md:left-[var(--sidebar-w)]">
      <form onSubmit={onSubmit} className="card w-full max-w-md space-y-4">
        <h3 className="text-lg font-semibold">{subject ? 'Edit Subject' : 'New Subject'}</h3>
        {error && (
          <div className="rounded-xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-600 ring-1 ring-red-500/30 dark:text-red-300">
            {error}
          </div>
        )}
        <div>
          <label className="label">Code</label>
          <input
            required
            className="input font-mono uppercase"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="CS301"
          />
        </div>
        <div>
          <label className="label">Title</label>
          <input
            required
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Database Systems"
          />
        </div>
        <div>
          <label className="label">Units</label>
          <input
            type="number"
            step="0.5"
            min="0"
            className="input"
            value={units}
            onChange={(e) => setUnits(e.target.value)}
            placeholder="3"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button disabled={busy} className="btn-primary">
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}
