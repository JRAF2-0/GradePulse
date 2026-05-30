import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { humanizeError } from '@/utils/errorMessage';
import type { DbDepartment } from '@/types/database';

interface StudentRow {
  id: string;
  student_no: string | null;
  course: string | null;
  year_level: number | null;
  section: string | null;
}

interface TeacherRow {
  id: string;
  employee_no: string | null;
  department: string | null;
  department_id: string | null;
}

export function RoleSpecificInfoCard() {
  const { profile } = useAuth();
  const role = profile?.role;
  const [student, setStudent] = useState<StudentRow | null>(null);
  const [teacher, setTeacher] = useState<TeacherRow | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRow = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    if (role === 'student') {
      const { data } = await supabase
        .from('students')
        .select('id, student_no, course, year_level, section')
        .eq('user_id', profile.id)
        .maybeSingle();
      setStudent((data as StudentRow | null) ?? null);
    } else if (role === 'teacher' || role === 'department_head') {
      const { data } = await supabase
        .from('teachers')
        .select('id, employee_no, department, department_id')
        .eq('user_id', profile.id)
        .maybeSingle();
      setTeacher((data as TeacherRow | null) ?? null);
    }
    setLoading(false);
  }, [profile, role]);

  useEffect(() => {
    void fetchRow();
  }, [fetchRow]);

  if (role !== 'student' && role !== 'teacher' && role !== 'department_head') return null;
  if (loading) return <div className="skeleton h-40" />;

  if (role === 'student' && student) {
    return <StudentFields row={student} onSaved={fetchRow} />;
  }
  if ((role === 'teacher' || role === 'department_head') && teacher) {
    return <TeacherFields row={teacher} isDeptHead={role === 'department_head'} onSaved={fetchRow} />;
  }
  return null;
}

function StudentFields({ row, onSaved }: { row: StudentRow; onSaved: () => void }) {
  const [studentNo, setStudentNo] = useState(row.student_no ?? '');
  const [course, setCourse] = useState(row.course ?? '');
  const [yearLevel, setYearLevel] = useState(row.year_level?.toString() ?? '');
  const [section, setSection] = useState(row.section ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(false);
    const { error: err } = await supabase
      .from('students')
      .update({
        student_no: studentNo.trim() || null,
        course: course.trim() || null,
        year_level: yearLevel ? Number(yearLevel) : null,
        section: section.trim() || null,
      })
      .eq('id', row.id);
    setBusy(false);
    if (err) {
      setError(humanizeError(err));
      return;
    }
    setSuccess(true);
    onSaved();
  };

  return (
    <form onSubmit={onSubmit} className="card space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-content">Student info</h2>
        <p className="mt-1 text-sm text-content-muted">
          Shown to teachers and admins. Keep your number, course, year, and section current.
        </p>
      </div>

      {error && (
        <div className="rounded-xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-600 ring-1 ring-red-500/30 dark:text-red-300">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-xl bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-600 ring-1 ring-emerald-500/30 dark:text-emerald-300">
          Student info saved.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">Student number</label>
          <input
            className="input font-mono"
            value={studentNo}
            onChange={(e) => {
              setStudentNo(e.target.value);
              setSuccess(false);
            }}
            placeholder="2024-12345"
          />
        </div>
        <div>
          <label className="label">Course</label>
          <input
            className="input"
            value={course}
            onChange={(e) => {
              setCourse(e.target.value);
              setSuccess(false);
            }}
            placeholder="BS Computer Science"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Year level</label>
            <select
              className="input"
              value={yearLevel}
              onChange={(e) => {
                setYearLevel(e.target.value);
                setSuccess(false);
              }}
            >
              <option value="">—</option>
              {[1, 2, 3, 4, 5].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Section</label>
            <input
              className="input"
              value={section}
              onChange={(e) => {
                setSection(e.target.value);
                setSuccess(false);
              }}
              placeholder="A"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button disabled={busy} className="btn-primary">
          {busy ? 'Saving…' : 'Save student info'}
        </button>
      </div>
    </form>
  );
}

function TeacherFields({
  row,
  isDeptHead,
  onSaved,
}: {
  row: TeacherRow;
  isDeptHead: boolean;
  onSaved: () => void;
}) {
  const [employeeNo, setEmployeeNo] = useState(row.employee_no ?? '');
  const [departmentId, setDepartmentId] = useState(row.department_id ?? '');
  const [departments, setDepartments] = useState<DbDepartment[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from('departments').select('*').order('code');
      setDepartments((data as DbDepartment[]) ?? []);
    })();
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(false);
    const payload: Partial<TeacherRow> = {
      employee_no: employeeNo.trim() || null,
    };
    if (!isDeptHead) {
      payload.department_id = departmentId || null;
    }
    const { error: err } = await supabase.from('teachers').update(payload).eq('id', row.id);
    setBusy(false);
    if (err) {
      setError(humanizeError(err));
      return;
    }
    setSuccess(true);
    onSaved();
  };

  return (
    <form onSubmit={onSubmit} className="card space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-content">
          {isDeptHead ? 'Department Head info' : 'Teacher info'}
        </h2>
        <p className="mt-1 text-sm text-content-muted">
          Shown to students and admins. Keep your employee number and department current.
        </p>
      </div>

      {error && (
        <div className="rounded-xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-600 ring-1 ring-red-500/30 dark:text-red-300">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-xl bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-600 ring-1 ring-emerald-500/30 dark:text-emerald-300">
          Saved.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Employee number</label>
          <input
            className="input font-mono"
            value={employeeNo}
            onChange={(e) => {
              setEmployeeNo(e.target.value);
              setSuccess(false);
            }}
            placeholder="EMP-001"
          />
        </div>
        <div>
          <label className="label">Department</label>
          {isDeptHead ? (
            <input
              className="input bg-surface-2"
              value={departments.find((d) => d.id === row.department_id)?.name ?? '—'}
              disabled
            />
          ) : (
            <select
              className="input"
              value={departmentId}
              onChange={(e) => {
                setDepartmentId(e.target.value);
                setSuccess(false);
              }}
            >
              <option value="">— None —</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} — {d.name}
                </option>
              ))}
            </select>
          )}
          {isDeptHead && (
            <p className="mt-1 text-xs text-content-subtle">
              Assigned by admin — you lead this department.
            </p>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <button disabled={busy} className="btn-primary">
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}
