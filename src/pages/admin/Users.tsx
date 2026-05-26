import { FormEvent, useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { humanizeError } from '@/utils/errorMessage';
import type { UserRole } from '@/types/database';

interface DirectoryRow {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  created_at: string;
  student_no: string | null;
  course: string | null;
  year_level: number | null;
  section: string | null;
  employee_no: string | null;
  department: string | null;
}

export function AdminUsers() {
  const [users, setUsers] = useState<DirectoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<DirectoryRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase.rpc('get_user_directory');
    setLoading(false);
    if (err) {
      setError(humanizeError(err));
      return;
    }
    setUsers(data ?? []);
  }, []);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  const pending = users.filter((u) => u.role === 'pending');
  const active = users.filter((u) => u.role !== 'pending');

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Users</h1>
        <p className="text-sm text-slate-600">
          Approve pending users by assigning them a role.
        </p>
      </header>

      {error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Pending ({pending.length})
        </h2>
        <UserTable
          rows={pending}
          loading={loading}
          onAssign={(u) => setEditing(u)}
          emptyText="No pending users."
        />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Active ({active.length})
        </h2>
        <UserTable
          rows={active}
          loading={loading}
          onAssign={(u) => setEditing(u)}
          emptyText="No active users yet."
        />
      </section>

      {editing && (
        <AssignRoleModal
          user={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void fetchUsers();
          }}
        />
      )}
    </div>
  );
}

function UserTable({
  rows,
  loading,
  onAssign,
  emptyText,
}: {
  rows: DirectoryRow[];
  loading: boolean;
  onAssign: (u: DirectoryRow) => void;
  emptyText: string;
}) {
  return (
    <div className="card overflow-x-auto p-0">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-2">Name</th>
            <th className="px-4 py-2">Email</th>
            <th className="px-4 py-2">Role</th>
            <th className="px-4 py-2">Details</th>
            <th className="px-4 py-2">Joined</th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {loading ? (
            <tr>
              <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                Loading…
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                {emptyText}
              </td>
            </tr>
          ) : (
            rows.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-2 font-medium">{u.full_name}</td>
                <td className="px-4 py-2 text-slate-600">{u.email}</td>
                <td className="px-4 py-2">
                  <RoleBadge role={u.role} />
                </td>
                <td className="px-4 py-2 text-slate-600">
                  {u.role === 'student' && (u.student_no ?? '—')}
                  {u.role === 'teacher' && (u.department ?? '—')}
                  {(u.role === 'admin' || u.role === 'pending') && '—'}
                </td>
                <td className="px-4 py-2 text-slate-500">
                  {new Date(u.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => onAssign(u)} className="btn-secondary text-xs">
                    {u.role === 'pending' ? 'Assign role' : 'Change'}
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function RoleBadge({ role }: { role: UserRole }) {
  const cls =
    role === 'admin'
      ? 'badge-danger'
      : role === 'teacher'
        ? 'badge-success'
        : role === 'student'
          ? 'badge-neutral'
          : 'badge-warning';
  return <span className={cls}>{role}</span>;
}

function AssignRoleModal({
  user,
  onClose,
  onSaved,
}: {
  user: DirectoryRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [role, setRole] = useState<UserRole>(user.role === 'pending' ? 'student' : user.role);
  const [studentNo, setStudentNo] = useState(user.student_no ?? '');
  const [course, setCourse] = useState(user.course ?? '');
  const [yearLevel, setYearLevel] = useState(user.year_level?.toString() ?? '');
  const [section, setSection] = useState(user.section ?? '');
  const [employeeNo, setEmployeeNo] = useState(user.employee_no ?? '');
  const [department, setDepartment] = useState(user.department ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.rpc('set_user_role', {
      p_user_id: user.id,
      p_role: role,
      p_student_no: role === 'student' ? studentNo || null : null,
      p_course: role === 'student' ? course || null : null,
      p_year_level: role === 'student' && yearLevel ? Number(yearLevel) : null,
      p_section: role === 'student' ? section || null : null,
      p_employee_no: role === 'teacher' ? employeeNo || null : null,
      p_department: role === 'teacher' ? department || null : null,
    });
    setBusy(false);
    if (err) {
      setError(humanizeError(err));
      return;
    }
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <form onSubmit={onSubmit} className="card w-full max-w-md space-y-4">
        <h3 className="text-lg font-semibold">Assign role — {user.full_name}</h3>
        {error && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}
        <div>
          <label className="label">Role</label>
          <select
            className="input"
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
          >
            <option value="student">Student</option>
            <option value="teacher">Teacher</option>
            <option value="admin">Admin</option>
            <option value="pending">Pending (revoke access)</option>
          </select>
        </div>

        {role === 'student' && (
          <>
            <div>
              <label className="label">Student number</label>
              <input className="input" value={studentNo} onChange={(e) => setStudentNo(e.target.value)} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="label">Course</label>
                <input className="input" value={course} onChange={(e) => setCourse(e.target.value)} placeholder="BSIT" />
              </div>
              <div>
                <label className="label">Year</label>
                <input
                  type="number"
                  min={1}
                  max={6}
                  className="input"
                  value={yearLevel}
                  onChange={(e) => setYearLevel(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Section</label>
                <input className="input" value={section} onChange={(e) => setSection(e.target.value)} placeholder="3A" />
              </div>
            </div>
          </>
        )}

        {role === 'teacher' && (
          <>
            <div>
              <label className="label">Employee number</label>
              <input className="input" value={employeeNo} onChange={(e) => setEmployeeNo(e.target.value)} />
            </div>
            <div>
              <label className="label">Department</label>
              <input className="input" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="CS Department" />
            </div>
          </>
        )}

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
