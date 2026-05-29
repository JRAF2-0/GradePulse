import { FormEvent, useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { humanizeError } from '@/utils/errorMessage';
import type { UserRole, DbDepartment } from '@/types/database';

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
  department_id: string | null;
  department_code: string | null;
  department_name: string | null;
  is_department_head: boolean;
}

export function AdminUsers() {
  const [users, setUsers] = useState<DirectoryRow[]>([]);
  const [departments, setDepartments] = useState<DbDepartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<DirectoryRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [dirRes, deptRes] = await Promise.all([
      supabase.rpc('get_user_directory'),
      supabase.from('departments').select('*').order('code'),
    ]);
    setLoading(false);
    if (dirRes.error) {
      setError(humanizeError(dirRes.error));
      return;
    }
    setUsers((dirRes.data as DirectoryRow[]) ?? []);
    setDepartments((deptRes.data as DbDepartment[]) ?? []);
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const pending = users.filter((u) => u.role === 'pending');
  const active = users.filter((u) => u.role !== 'pending');

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Users</h1>
        <p className="text-sm text-content-muted">
          Approve pending users by assigning them a role.
        </p>
      </header>

      {error && (
        <div className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300">{error}</div>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-content-subtle">
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
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-content-subtle">
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
          departments={departments}
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
      <table className="min-w-full divide-y divide-line text-sm">
        <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-content-subtle">
          <tr>
            <th className="px-4 py-2">Name</th>
            <th className="px-4 py-2">Email</th>
            <th className="px-4 py-2">Role</th>
            <th className="px-4 py-2">Details</th>
            <th className="px-4 py-2">Joined</th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {loading ? (
            <tr>
              <td colSpan={6} className="px-4 py-6 text-center text-content-subtle">
                Loading…
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-6 text-center text-content-subtle">
                {emptyText}
              </td>
            </tr>
          ) : (
            rows.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-2 font-medium">{u.full_name}</td>
                <td className="px-4 py-2 text-content-muted">{u.email}</td>
                <td className="px-4 py-2">
                  <RoleBadge role={u.role} />
                </td>
                <td className="px-4 py-2 text-content-muted">
                  {u.role === 'student' && (u.student_no ?? '—')}
                  {u.role === 'teacher' && (u.department_name ?? u.department ?? '—')}
                  {u.role === 'department_head' && (u.department_name ?? '—')}
                  {(u.role === 'admin' || u.role === 'pending' || u.role === 'parent') && '—'}
                </td>
                <td className="px-4 py-2 text-content-subtle">
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
        : role === 'department_head'
          ? 'badge-success'
          : role === 'student'
            ? 'badge-neutral'
            : role === 'parent'
              ? 'badge-neutral'
              : 'badge-warning';
  const label = role === 'department_head' ? 'dept head' : role;
  return <span className={cls}>{label}</span>;
}

function AssignRoleModal({
  user,
  departments,
  onClose,
  onSaved,
}: {
  user: DirectoryRow;
  departments: DbDepartment[];
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
  const [departmentId, setDepartmentId] = useState<string>(user.department_id ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const needsDept = role === 'teacher' || role === 'department_head';
  const needsDeptRequired = role === 'department_head';

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (needsDeptRequired && !departmentId) {
      setError('Please choose a department for the Department Head.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.rpc('set_user_role', {
      p_user_id: user.id,
      p_role: role,
      p_student_no: role === 'student' ? studentNo || null : null,
      p_course: role === 'student' ? course || null : null,
      p_year_level: role === 'student' && yearLevel ? Number(yearLevel) : null,
      p_section: role === 'student' ? section || null : null,
      p_employee_no: needsDept ? employeeNo || null : null,
      p_department: needsDept ? department || null : null,
      p_department_id: needsDept ? departmentId || null : null,
    });
    setBusy(false);
    if (err) {
      setError(humanizeError(err));
      return;
    }
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <form onSubmit={onSubmit} className="card w-full max-w-md space-y-4">
        <h3 className="text-lg font-semibold">Assign role — {user.full_name}</h3>
        {error && (
          <div className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300">{error}</div>
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
            <option value="department_head">Department Head</option>
            <option value="parent">Parent</option>
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

        {needsDept && (
          <>
            <div>
              <label className="label">Employee number</label>
              <input className="input" value={employeeNo} onChange={(e) => setEmployeeNo(e.target.value)} />
            </div>
            <div>
              <label className="label">
                Department {needsDeptRequired && <span className="text-red-600">*</span>}
              </label>
              <select
                className="input"
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
              >
                <option value="">— None —</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code} — {d.name}
                  </option>
                ))}
              </select>
              {departments.length === 0 && (
                <p className="mt-1 text-xs text-amber-700">
                  No departments yet. Create one under <strong>Departments</strong> first.
                </p>
              )}
            </div>
            <div>
              <label className="label">Department label (legacy, optional)</label>
              <input
                className="input"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="Free-text department name"
              />
            </div>
          </>
        )}

        {role === 'parent' && (
          <p className="text-xs text-content-subtle">
            After saving, link this parent to one or more students under{' '}
            <strong>Parent Links</strong>.
          </p>
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
