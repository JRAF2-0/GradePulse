import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { humanizeError } from '@/utils/errorMessage';
import type { DbClass, DbSubject } from '@/types/database';

export interface ClassWithSubject extends DbClass {
  subject: Pick<DbSubject, 'code' | 'title' | 'units'>;
  enrollment_count: number;
}

export function useTeacherClasses() {
  const [classes, setClasses] = useState<ClassWithSubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('classes')
      .select('*, subject:subjects(code, title, units), enrollments(count)')
      .eq('is_archived', false)
      .order('created_at', { ascending: false });
    setLoading(false);
    if (err) {
      setError(humanizeError(err));
      return;
    }
    setClasses(
      (data ?? []).map((c: { enrollments?: { count: number }[] } & Record<string, unknown>) => ({
        ...(c as unknown as ClassWithSubject),
        enrollment_count: c.enrollments?.[0]?.count ?? 0,
      })),
    );
  }, []);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  return { classes, loading, error, refresh: fetch };
}
