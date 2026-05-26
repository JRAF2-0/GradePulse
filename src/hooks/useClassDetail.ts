import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { humanizeError } from '@/utils/errorMessage';
import type {
  DbClass,
  DbGradeCategory,
  DbGradeItem,
  DbScore,
  DbSubject,
  Period,
} from '@/types/database';

export interface ClassDetail {
  class: DbClass & { subject: Pick<DbSubject, 'code' | 'title' | 'units'> };
  roster: { student_id: string; full_name: string; student_no: string | null }[];
  categories: DbGradeCategory[];
  items: DbGradeItem[];
  scores: DbScore[];
}

export function useClassDetail(classId: string | undefined) {
  const [data, setData] = useState<ClassDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!classId) return;
    setLoading(true);

    const [classRes, rosterRes, categoriesRes] = await Promise.all([
      supabase
        .from('classes')
        .select('*, subject:subjects(code, title, units)')
        .eq('id', classId)
        .maybeSingle(),
      supabase
        .from('enrollments')
        .select('student_id, students!inner(id, student_no, users!inner(full_name))')
        .eq('class_id', classId),
      supabase.from('grade_categories').select('*').eq('class_id', classId).order('period'),
    ]);

    if (classRes.error || !classRes.data) {
      setError(humanizeError(classRes.error ?? 'Class not found'));
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
        .in('category_id', categoryIds);
      if (itemsRes.error) {
        setError(humanizeError(itemsRes.error));
        setLoading(false);
        return;
      }
      items = itemsRes.data ?? [];
      const itemIds = items.map((i) => i.id);
      if (itemIds.length > 0) {
        const scoresRes = await supabase.from('scores').select('*').in('grade_item_id', itemIds);
        if (scoresRes.error) {
          setError(humanizeError(scoresRes.error));
          setLoading(false);
          return;
        }
        scores = scoresRes.data ?? [];
      }
    }

    type RosterRow = {
      student_id: string;
      students: {
        id: string;
        student_no: string | null;
        users: { full_name: string } | null;
      } | null;
    };
    const roster = ((rosterRes.data as RosterRow[] | null) ?? [])
      .filter((r) => r.students)
      .map((r) => ({
        student_id: r.students!.id,
        full_name: r.students!.users?.full_name ?? 'Unknown',
        student_no: r.students!.student_no,
      }));

    setData({
      class: classRes.data as ClassDetail['class'],
      roster,
      categories: categoriesRes.data ?? [],
      items,
      scores,
    });
    setLoading(false);
  }, [classId]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  return { data, loading, error, refresh: fetchAll };
}

export function categoriesForPeriod(cats: DbGradeCategory[], period: Period) {
  return cats.filter((c) => c.period === period);
}

export function weightTotal(cats: DbGradeCategory[], period: Period) {
  return categoriesForPeriod(cats, period).reduce((s, c) => s + Number(c.weight), 0);
}
