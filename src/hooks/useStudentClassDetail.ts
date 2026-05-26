import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { humanizeError } from '@/utils/errorMessage';
import type {
  DbClass,
  DbGradeCategory,
  DbGradeItem,
  DbScore,
  DbSubject,
  Period,
} from '@/types/database';

export interface PeriodGrade {
  percentage: number;
  numeric_grade: number;
  remarks: string;
}

export interface StudentClassDetail {
  class: DbClass & { subject: Pick<DbSubject, 'code' | 'title' | 'units'> };
  categories: DbGradeCategory[];
  items: DbGradeItem[];
  scores: DbScore[];
  midterm: PeriodGrade;
  finals: PeriodGrade;
  final: PeriodGrade;
  studentId: string;
}

export function useStudentClassDetail(classId: string | undefined) {
  const { user } = useAuth();
  const [data, setData] = useState<StudentClassDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!classId || !user) return;
    setLoading(true);

    const [studentRes, classRes] = await Promise.all([
      supabase.from('students').select('id').eq('user_id', user.id).maybeSingle(),
      supabase
        .from('classes')
        .select('*, subject:subjects(code, title, units)')
        .eq('id', classId)
        .maybeSingle(),
    ]);

    if (studentRes.error || !studentRes.data) {
      setError(humanizeError(studentRes.error ?? 'Student profile not found'));
      setLoading(false);
      return;
    }
    if (classRes.error || !classRes.data) {
      setError(humanizeError(classRes.error ?? 'Class not found'));
      setLoading(false);
      return;
    }

    const studentId = studentRes.data.id;

    const categoriesRes = await supabase
      .from('grade_categories')
      .select('*')
      .eq('class_id', classId);
    if (categoriesRes.error) {
      setError(humanizeError(categoriesRes.error));
      setLoading(false);
      return;
    }

    const categoryIds = (categoriesRes.data ?? []).map((c) => c.id);
    let items: DbGradeItem[] = [];
    let scores: DbScore[] = [];
    if (categoryIds.length > 0) {
      const itemsRes = await supabase
        .from('grade_items')
        .select('*')
        .in('category_id', categoryIds)
        .eq('is_published', true);
      if (itemsRes.error) {
        setError(humanizeError(itemsRes.error));
        setLoading(false);
        return;
      }
      items = itemsRes.data ?? [];
      if (items.length > 0) {
        const scoresRes = await supabase
          .from('scores')
          .select('*')
          .in('grade_item_id', items.map((i) => i.id))
          .eq('student_id', studentId)
          .eq('is_draft', false);
        if (scoresRes.error) {
          setError(humanizeError(scoresRes.error));
          setLoading(false);
          return;
        }
        scores = scoresRes.data ?? [];
      }
    }

    const [mid, fin, final] = await Promise.all([
      callPeriod(classId, studentId, 'midterm'),
      callPeriod(classId, studentId, 'finals'),
      callFinal(classId, studentId),
    ]);

    setData({
      class: classRes.data as StudentClassDetail['class'],
      categories: categoriesRes.data ?? [],
      items,
      scores,
      midterm: mid,
      finals: fin,
      final,
      studentId,
    });
    setLoading(false);
  }, [classId, user]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  // Realtime: refetch when scores change for this class
  useEffect(() => {
    if (!classId) return;
    const channel = supabase
      .channel(`student-class-${classId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scores' }, () => {
        void fetchAll();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'grade_items' }, () => {
        void fetchAll();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [classId, fetchAll]);

  return { data, loading, error, refresh: fetchAll };
}

async function callPeriod(
  classId: string,
  studentId: string,
  period: Period,
): Promise<PeriodGrade> {
  const { data, error } = await supabase
    .rpc('compute_period_grade', {
      p_class_id: classId,
      p_student_id: studentId,
      p_period: period,
    });
  if (error || !data || data.length === 0) {
    return { percentage: 0, numeric_grade: 5.0, remarks: 'No grades yet' };
  }
  const row = (data as PeriodGrade[])[0];
  return {
    percentage: Number(row.percentage),
    numeric_grade: Number(row.numeric_grade),
    remarks: row.remarks,
  };
}

async function callFinal(classId: string, studentId: string): Promise<PeriodGrade> {
  const { data, error } = await supabase.rpc('compute_final_grade', {
    p_class_id: classId,
    p_student_id: studentId,
  });
  if (error || !data || data.length === 0) {
    return { percentage: 0, numeric_grade: 5.0, remarks: 'No grades yet' };
  }
  const row = (data as PeriodGrade[])[0];
  return {
    percentage: Number(row.percentage),
    numeric_grade: Number(row.numeric_grade),
    remarks: row.remarks,
  };
}
