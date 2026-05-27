import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { humanizeError } from '@/utils/errorMessage';
import type {
  DbClass,
  DbFinalizedGrade,
  DbGradeCategory,
  DbGradeChangeRequest,
  DbGradeItem,
  DbScore,
  DbScoreComment,
  DbSubject,
  Period,
} from '@/types/database';

export interface ClassDetail {
  class: DbClass & { subject: Pick<DbSubject, 'code' | 'title' | 'units'> };
  roster: { student_id: string; full_name: string; student_no: string | null }[];
  categories: DbGradeCategory[];
  items: DbGradeItem[];
  scores: DbScore[];
  finalized: DbFinalizedGrade[];
  pendingChangeRequests: DbGradeChangeRequest[];
  comments: DbScoreComment[];
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
    let pendingChangeRequests: DbGradeChangeRequest[] = [];
    let comments: DbScoreComment[] = [];
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
        const scoreIds = scores.map((s) => s.id);
        if (scoreIds.length > 0) {
          const reqRes = await supabase
            .from('grade_change_requests')
            .select('*')
            .in('score_id', scoreIds)
            .eq('status', 'pending');
          if (!reqRes.error) {
            pendingChangeRequests = (reqRes.data as DbGradeChangeRequest[]) ?? [];
          }
        }
        // Comments: any targeting either our scores or our items
        const scoreCommentsP =
          scoreIds.length > 0
            ? supabase.from('score_comments').select('*').in('score_id', scoreIds)
            : Promise.resolve({ data: [] as DbScoreComment[], error: null });
        const itemCommentsP = supabase
          .from('score_comments')
          .select('*')
          .in('grade_item_id', itemIds);
        const [scoreCommentsRes, itemCommentsRes] = await Promise.all([
          scoreCommentsP,
          itemCommentsP,
        ]);
        if (!scoreCommentsRes.error) {
          comments = comments.concat(
            (scoreCommentsRes.data as DbScoreComment[]) ?? [],
          );
        }
        if (!itemCommentsRes.error) {
          comments = comments.concat(
            (itemCommentsRes.data as DbScoreComment[]) ?? [],
          );
        }
      }
    }

    const finalizedRes = await supabase
      .from('finalized_grades')
      .select('*')
      .eq('class_id', classId);
    const finalized = (finalizedRes.data as DbFinalizedGrade[] | null) ?? [];

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
      finalized,
      pendingChangeRequests,
      comments,
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
