import { FormEvent, useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { humanizeError } from '@/utils/errorMessage';
import type { DbDepartment } from '@/types/database';

interface DepartmentRow extends DbDepartment {
  head?: { full_name: string } | null;
}

export function AdminDepartments() {
  const [rows, setRows] = useState<DepartmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<DepartmentRow | 'new' | null>(null);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('departments')
      .select('id, code, name, head_id, created_at, head:users!head_id(full_name)')
      .order('code');
    setLoading(false);
    if (err) {
      setError(humanizeError(err));
      return;
    }
    setRows((data as unknown as DepartmentRow[]) ?? []);
  }, []);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  const onDelete = async (row: DepartmentRow) => {
    if (
      !confirm(
        `Delete department "${row.name}"? Teachers and subjects linked to it will be unlinked.`,
      )
    )
      return;
    const { error: err } = await supabase.from('departments').delete().eq('id', row.id);
    if (err) {
      setError(humanizeError(err));
      return;
    }
    await fetchRows();
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Departments</h1>
          <p className="text-sm text-content-muted">
            Departments group subjects and teachers. A Department Head leads one department.
          </p>
        </div>
        <button onClick={() => setEditing('new')} className="btn-primary">
          New department
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
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Head</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-content-subtle">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-content-subtle">
                  No departments yet. Click "New department" to create one.
                </td>
              </tr>
            ) : (
              rows.map((d) => (
                <tr key={d.id}>
                  <td className="px-4 py-2 font-mono text-xs">{d.code}</td>
                  <td className="px-4 py-2 font-medium">{d.name}</td>
                  <td className="px-4 py-2 text-content-muted">{d.head?.full_name ?? '—'}</td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => setEditing(d)} className="btn-secondary mr-2 text-xs">
                      Edit
                    </button>
                    <button
                      onClick={() => void onDelete(d)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <DepartmentForm
          initial={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void fetchRows();
          }}
        />
      )}
    </div>
  );
}

function DepartmentForm({
  initial,
  onClose,
  onSaved,
}: {
  initial: DbDepartment | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [code, setCode] = useState(initial?.code ?? '');
  const [name, setName] = useState(initial?.name ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    if (initial) {
      const { error: err } = await supabase
        .from('departments')
        .update({ code: code.toUpperCase(), name })
        .eq('id', initial.id);
      if (err) {
        setError(humanizeError(err));
        setBusy(false);
        return;
      }
    } else {
      const { error: err } = await supabase
        .from('departments')
        .insert({ code: code.toUpperCase(), name });
      if (err) {
        setError(humanizeError(err));
        setBusy(false);
        return;
      }
    }
    setBusy(false);
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 px-4 animate-fade-in">
      <form onSubmit={onSubmit} className="card w-full max-w-md space-y-4">
        <h3 className="text-lg font-semibold">{initial ? 'Edit department' : 'New department'}</h3>
        {error && (
          <div className="rounded-xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-600 ring-1 ring-red-500/30 dark:text-red-300">
            {error}
          </div>
        )}
        <div>
          <label className="label">Code</label>
          <input
            required
            className="input uppercase"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="CS"
            maxLength={20}
          />
        </div>
        <div>
          <label className="label">Name</label>
          <input
            required
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Computer Science"
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
