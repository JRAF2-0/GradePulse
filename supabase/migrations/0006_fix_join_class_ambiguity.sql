-- =============================================================================
-- GradePulse — Fix ambiguous class_id in join_class_by_code
-- =============================================================================
-- The function declared `returns table(class_id uuid, ...)`. That makes
-- `class_id` a PL/pgSQL output variable. In the same body we have:
--     on conflict (class_id, student_id) do nothing;
-- The bare `class_id` could mean either the output variable OR the
-- enrollments table column. Postgres refuses to choose and throws:
--     "column reference \"class_id\" is ambiguous"
--
-- Fix: add `#variable_conflict use_column` directive so PL/pgSQL prefers
-- the table column when there's a conflict. This is the recommended
-- Postgres pattern for this exact scenario.
-- =============================================================================

create or replace function public.join_class_by_code(p_class_code text)
returns table(class_id uuid, subject_code text, subject_title text)
language plpgsql security definer as $$
#variable_conflict use_column
declare
  v_class_id uuid;
  v_subject_id uuid;
  v_student_id uuid;
begin
  v_student_id := public.current_student_id();
  if v_student_id is null then
    raise exception 'Only students can join classes by code';
  end if;

  select c.id, c.subject_id into v_class_id, v_subject_id
    from public.classes c
    where c.class_code = upper(p_class_code) and c.is_archived = false;

  if v_class_id is null then
    raise exception 'Invalid class code';
  end if;

  insert into public.enrollments (class_id, student_id)
  values (v_class_id, v_student_id)
  on conflict (class_id, student_id) do nothing;

  return query
    select c.id, s.code, s.title
      from public.classes c
      join public.subjects s on s.id = c.subject_id
      where c.id = v_class_id;
end;
$$;
