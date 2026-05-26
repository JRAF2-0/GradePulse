import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { humanizeError } from '@/utils/errorMessage';
import type { DbClass, DbSubject } from '@/types/database';

export interface EnrolledClass extends DbClass {
  subject: Pick<DbSubject, 'code' | 'title' | 'units'>;
  teacher_name: string;
}

export function useStudentClasses() {
  const [classes, setClasses] = useState<EnrolledClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('enrollments')
      .select(
        'class:classes(*, subject:subjects(code, title, units), teacher:teachers(user:users(full_name)))',
      );
    setLoading(false);
    if (err) {
      setError(humanizeError(err));
      return;
    }
    type Row = {
      class: DbClass & {
        subject: Pick<DbSubject, 'code' | 'title' | 'units'>;
        teacher: { user: { full_name: string } | null } | null;
      };
    };
    setClasses(
      ((data as unknown as Row[]) ?? [])
        .filter((row) => row.class)
        .map((row) => ({
          ...row.class,
          teacher_name: row.class.teacher?.user?.full_name ?? 'Unknown',
        })),
    );
  }, []);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  return { classes, loading, error, refresh: fetch };
}
