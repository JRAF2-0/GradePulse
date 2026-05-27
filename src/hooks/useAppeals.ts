import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { humanizeError } from '@/utils/errorMessage';
import type { DbAppeal } from '@/types/database';

export interface AppealRow extends DbAppeal {
  student_name: string;
  student_no: string | null;
  item_title: string;
  score_value: number | null;
  max_score: number;
  class_id: string;
}

/**
 * Fetch all appeals for a specific class (teacher view).
 */
export function useClassAppeals(classId: string | undefined) {
  const [appeals, setAppeals] = useState<AppealRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!classId) return;
    setLoading(true);
    const { data, error: err } = await supabase
      .from('appeals')
      .select(
        `*,
        student:students(student_no, user:users(full_name)),
        score:scores(
          score,
          item:grade_items(
            title, max_score,
            category:grade_categories(class_id)
          )
        )`,
      )
      .order('created_at', { ascending: false });
    setLoading(false);
    if (err) {
      setError(humanizeError(err));
      return;
    }
    type Row = DbAppeal & {
      student: { student_no: string | null; user: { full_name: string } };
      score: {
        score: number | null;
        item: {
          title: string;
          max_score: number;
          category: { class_id: string };
        };
      };
    };
    const rows = ((data as Row[] | null) ?? [])
      .filter((r) => r.score?.item?.category?.class_id === classId)
      .map<AppealRow>((r) => ({
        ...r,
        student_name: r.student.user.full_name,
        student_no: r.student.student_no,
        item_title: r.score.item.title,
        score_value: r.score.score,
        max_score: r.score.item.max_score,
        class_id: r.score.item.category.class_id,
      }));
    setAppeals(rows);
  }, [classId]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (!classId) return;
    const channel = supabase
      .channel(`appeals-${classId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appeals' }, () => {
        void fetchAll();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [classId, fetchAll]);

  return { appeals, loading, error, refresh: fetchAll };
}

/**
 * Fetch ALL appeals system-wide for the admin view.
 */
export interface AdminAppealRow extends AppealRow {
  subject_code: string;
  subject_title: string;
  teacher_name: string;
}

export function useAllAppeals() {
  const [appeals, setAppeals] = useState<AdminAppealRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('appeals')
      .select(
        `*,
        student:students(student_no, user:users(full_name)),
        score:scores(
          score,
          item:grade_items(
            title, max_score,
            category:grade_categories(
              class_id,
              class:classes(
                subject:subjects(code, title),
                teacher:teachers(user:users(full_name))
              )
            )
          )
        )`,
      )
      .order('created_at', { ascending: false });
    setLoading(false);
    if (err) {
      setError(humanizeError(err));
      return;
    }
    type Row = DbAppeal & {
      student: { student_no: string | null; user: { full_name: string } };
      score: {
        score: number | null;
        item: {
          title: string;
          max_score: number;
          category: {
            class_id: string;
            class: {
              subject: { code: string; title: string } | null;
              teacher: { user: { full_name: string } | null } | null;
            } | null;
          };
        };
      };
    };
    const rows = ((data as Row[] | null) ?? []).map<AdminAppealRow>((r) => ({
      ...r,
      student_name: r.student.user.full_name,
      student_no: r.student.student_no,
      item_title: r.score.item.title,
      score_value: r.score.score,
      max_score: r.score.item.max_score,
      class_id: r.score.item.category.class_id,
      subject_code: r.score.item.category.class?.subject?.code ?? '—',
      subject_title: r.score.item.category.class?.subject?.title ?? '—',
      teacher_name: r.score.item.category.class?.teacher?.user?.full_name ?? '—',
    }));
    setAppeals(rows);
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    const channel = supabase
      .channel('appeals-admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appeals' }, () => {
        void fetchAll();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchAll]);

  return { appeals, loading, error, refresh: fetchAll };
}

/**
 * Fetch the student's own appeals (used to show status next to each score).
 */
export function useStudentAppeals(classId: string | undefined) {
  const [appeals, setAppeals] = useState<DbAppeal[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!classId) return;
    setLoading(true);
    const { data: studentRow } = await supabase
      .from('students')
      .select('id')
      .eq('user_id', (await supabase.auth.getUser()).data.user?.id ?? '')
      .maybeSingle();
    if (!studentRow) {
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('appeals')
      .select('*')
      .eq('student_id', studentRow.id)
      .order('created_at', { ascending: false });
    setLoading(false);
    if (error) {
      console.error(error);
      return;
    }
    setAppeals(data ?? []);
  }, [classId]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  return { appeals, loading, refresh: fetchAll };
}
