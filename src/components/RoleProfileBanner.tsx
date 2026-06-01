import { FormEvent, useCallback, useEffect, useState } from 'react';
import { UserCircle2, X } from 'lucide-react';
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

const STUDENT_FIELDS: (keyof StudentRow)[] = ['student_no', 'course', 'year_level', 'section'];
const TEACHER_FIELDS: (keyof TeacherRow)[] = ['employee_no', 'department_id'];

export function RoleProfileBanner() {
  const { profile } = useAuth();
  const role = profile?.role;
  const [student, setStudent] = useState<StudentRow | null>(null);
  const [teacher, setTeacher] = useState<TeacherRow | null>(null);
  const [open, setOpen] = useState(false);

  const fetchRow = useCallback(async () => {
    if (!profile) return;
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
  }, [profile, role]);

  useEffect(() => {
    void fetchRow();
  }, [fetchRow]);

  if (role !== 'student' && role !== 'teacher' && role !== 'department_head') return null;

  const incomplete =
    role === 'student'
      ? !!student && STUDENT_FIELDS.some((f) => student[f] == null || student[f] === '')
      : !!teacher && TEACHER_FIELDS.some((f) => teacher[f] == null || teacher[f] === '');

  if (!incomplete) return null;

  return (
    <>
      <div className="card flex flex-wrap items-center gap-4 ring-amber-500/30 bg-amber-500/5">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-300">
          <UserCircle2 className="h-5 w-5" strokeWidth={1.9} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-content">Finish setting up your profile</h3>
          <p className="text-sm text-content-muted">
            {role === 'student'
              ? 'Add your student number, course, year level, and section.'
              : 'Add your employee number and department.'}
          </p>
        </div>
        <button onClick={() => setOpen(true)} className="btn-primary shrink-0">
          Complete now
        </button>
      </div>

      {open && role === 'student' && student && (
        <StudentForm
          row={student}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            void fetchRow();
          }}
        />
      )}
      {open && (role === 'teacher' || role === 'department_head') && teacher && (
        <TeacherForm
          row={teacher}
          isDeptHead={role === 'department_head'}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            void fetchRow();
          }}
        />
      )}
    </>
  );
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm animate-fade-in">
      <div className="card w-full max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-content">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-content-muted hover:bg-surface-3 hover:text-content"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function StudentForm({
  row,
  onClose,
  onSaved,
}: {
  row: StudentRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [studentNo, setStudentNo] = useState(row.student_no ?? '');
  const [course, setCourse] = useState(row.course ?? '');
  const [yearLevel, setYearLevel] = useState(row.year_level?.toString() ?? '');
  const [section, setSection] = useState(row.section ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const yr = yearLevel ? Number(yearLevel) : null;
    const { error: err } = await supabase
      .from('students')
      .update({
        student_no: studentNo.trim() || null,
        course: course.trim() || null,
        year_level: yr,
        section: section.trim() || null,
      })
      .eq('id', row.id);
    setBusy(false);
    if (err) {
      setError(humanizeError(err));
      return;
    }
    onSaved();
  };

  return (
    <ModalShell title="Complete student profile" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4">
        {error && (
          <div className="rounded-xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-600 ring-1 ring-red-500/30 dark:text-red-300">
            {error}
          </div>
        )}
        <div>
          <label className="label">Student number</label>
          <input
            required
            className="input font-mono"
            value={studentNo}
            onChange={(e) => setStudentNo(e.target.value)}
            placeholder="2024-12345"
          />
        </div>
        <div>
          <label className="label">Course</label>
          <input
            required
            className="input"
            value={course}
            onChange={(e) => setCourse(e.target.value)}
            placeholder="BS Computer Science"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Year level</label>
            <select
              required
              className="input"
              value={yearLevel}
              onChange={(e) => setYearLevel(e.target.value)}
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
              required
              className="input"
              value={section}
              onChange={(e) => setSection(e.target.value)}
              placeholder="A"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button disabled={busy} className="btn-primary">
            {busy ? 'Saving…' : 'Save profile'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function TeacherForm({
  row,
  isDeptHead,
  onClose,
  onSaved,
}: {
  row: TeacherRow;
  isDeptHead: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [employeeNo, setEmployeeNo] = useState(row.employee_no ?? '');
  const [departmentId, setDepartmentId] = useState(row.department_id ?? '');
  const [departments, setDepartments] = useState<DbDepartment[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    onSaved();
  };

  return (
    <ModalShell title="Complete teacher profile" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4">
        {error && (
          <div className="rounded-xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-600 ring-1 ring-red-500/30 dark:text-red-300">
            {error}
          </div>
        )}
        <div>
          <label className="label">Employee number</label>
          <input
            required
            className="input font-mono"
            value={employeeNo}
            onChange={(e) => setEmployeeNo(e.target.value)}
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
              required
              className="input"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
            >
              <option value="">— Select —</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} — {d.name}
                </option>
              ))}
            </select>
          )}
          {isDeptHead && (
            <p className="mt-1 text-xs text-content-subtle">
              Set by admin — you lead this department.
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button disabled={busy} className="btn-primary">
            {busy ? 'Saving…' : 'Save profile'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
