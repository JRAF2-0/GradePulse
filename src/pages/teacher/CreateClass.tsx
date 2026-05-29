import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { humanizeError } from '@/utils/errorMessage';
import type { DbSubject, Semester } from '@/types/database';

export function CreateClass() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<DbSubject[]>([]);
  const [subjectId, setSubjectId] = useState('');
  const [section, setSection] = useState('');
  const [semester, setSemester] = useState<Semester>('1st');
  const [schoolYear, setSchoolYear] = useState(() => {
    const now = new Date();
    const y = now.getFullYear();
    return now.getMonth() >= 6 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void supabase
      .from('subjects')
      .select('*')
      .order('code')
      .then(({ data, error: err }) => {
        if (err) {
          setError(humanizeError(err));
          return;
        }
        setSubjects(data ?? []);
        if (data && data.length > 0) setSubjectId(data[0].id);
      });
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError(null);
    setBusy(true);
    const { data: teacherRow, error: tErr } = await supabase
      .from('teachers')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (tErr || !teacherRow) {
      setError('Teacher profile not found.');
      setBusy(false);
      return;
    }
    const { data, error: err } = await supabase
      .from('classes')
      .insert({
        subject_id: subjectId,
        teacher_id: teacherRow.id,
        section: section || null,
        semester,
        school_year: schoolYear,
      })
      .select('id')
      .single();
    setBusy(false);
    if (err) {
      setError(humanizeError(err));
      return;
    }
    navigate(`/teacher/classes/${data.id}`);
  };

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Create Class</h1>
        <p className="text-sm text-content-muted">
          A unique 6-character code will be generated for students to join.
        </p>
      </header>
      <form onSubmit={onSubmit} className="card space-y-4">
        {error && (
          <div className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300">{error}</div>
        )}
        <div>
          <label className="label">Subject</label>
          {subjects.length === 0 ? (
            <p className="text-sm text-content-subtle">
              No subjects exist yet — ask an admin to create one first.
            </p>
          ) : (
            <select
              required
              className="input"
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
            >
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} — {s.title}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Section</label>
            <input
              className="input"
              value={section}
              onChange={(e) => setSection(e.target.value)}
              placeholder="BSIT-3A"
            />
          </div>
          <div>
            <label className="label">Semester</label>
            <select
              className="input"
              value={semester}
              onChange={(e) => setSemester(e.target.value as Semester)}
            >
              <option value="1st">1st</option>
              <option value="2nd">2nd</option>
              <option value="summer">Summer</option>
            </select>
          </div>
        </div>
        <div>
          <label className="label">School year</label>
          <input
            required
            className="input"
            value={schoolYear}
            onChange={(e) => setSchoolYear(e.target.value)}
            placeholder="2025-2026"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => navigate('/teacher/classes')}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button disabled={busy || !subjectId} className="btn-primary">
            {busy ? 'Creating…' : 'Create Class'}
          </button>
        </div>
      </form>
    </div>
  );
}
