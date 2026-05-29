-- =============================================================================
-- GradePulse V2 — Authorization guard for student-scoped analytics RPCs
-- =============================================================================
-- compute_cgpa / compute_risk_level / get_attendance_summary /
-- is_dean_list_eligible are SECURITY DEFINER and accept an arbitrary
-- p_student_id. Without a guard, any authenticated user could call them for
-- ANY student and read aggregate data, bypassing the row-level security on
-- the underlying tables.
--
-- This migration adds `can_view_student(p_student_id)` and bakes it into each
-- of those RPCs so the caller only gets data for a student they're allowed
-- to see:
--   * the student themself
--   * an admin
--   * a parent linked to the student
--   * a teacher of a class the student is enrolled in
--   * the department head whose department owns one of the student's classes
--
-- Unauthorized calls return a "safe empty" result (0 / false / null) rather
-- than raising, so callers don't have to special-case errors.
-- =============================================================================

create or replace function public.can_view_student(p_student_id uuid)
returns boolean language sql security definer stable as $$
  select
    public.current_role() = 'admin'
    or exists (
      select 1 from public.students s
      where s.id = p_student_id and s.user_id = auth.uid()
    )
    or public.is_parent_of(p_student_id)
    or exists (
      select 1
      from public.enrollments e
      join public.classes c on c.id = e.class_id
      where e.student_id = p_student_id
        and c.teacher_id = public.current_teacher_id()
    )
    or exists (
      select 1
      from public.enrollments e
      join public.classes c on c.id = e.class_id
      join public.subjects sub on sub.id = c.subject_id
      where e.student_id = p_student_id
        and sub.department_id is not null
        and sub.department_id = public.current_department_head_dept_id()
    );
$$;

-- -----------------------------------------------------------------------------
-- Re-create compute_cgpa with the guard baked into the WHERE clause.
-- -----------------------------------------------------------------------------
create or replace function public.compute_cgpa(p_student_id uuid)
returns numeric language sql security definer stable as $$
  select round(
    coalesce(
      sum(fg.numeric_grade * coalesce(sub.units, 3.0))
        / nullif(sum(coalesce(sub.units, 3.0)), 0),
      0
    )::numeric,
    2
  )
  from public.finalized_grades fg
  join public.classes c on c.id = fg.class_id
  join public.subjects sub on sub.id = c.subject_id
  where fg.student_id = p_student_id
    and fg.period = 'finals'
    and public.can_view_student(p_student_id);
$$;

-- -----------------------------------------------------------------------------
-- Re-create get_attendance_summary with the guard.
-- -----------------------------------------------------------------------------
create or replace function public.get_attendance_summary(
  p_class_id uuid,
  p_student_id uuid
)
returns table(
  total int,
  present int,
  absent int,
  late int,
  excused int,
  attendance_pct numeric
)
language sql security definer stable as $$
  with rows as (
    select status from public.attendance
    where class_id = p_class_id
      and student_id = p_student_id
      and public.can_view_student(p_student_id)
  ),
  agg as (
    select
      count(*)::int as total,
      count(*) filter (where status = 'present')::int as present,
      count(*) filter (where status = 'absent')::int as absent,
      count(*) filter (where status = 'late')::int as late,
      count(*) filter (where status = 'excused')::int as excused
    from rows
  )
  select
    a.total,
    a.present,
    a.absent,
    a.late,
    a.excused,
    case
      when (a.total - a.excused) = 0 then 0
      else round((100.0 * (a.present + a.late) / nullif(a.total - a.excused, 0))::numeric, 2)
    end as attendance_pct
  from agg a;
$$;

-- -----------------------------------------------------------------------------
-- Re-create is_dean_list_eligible with an early authorization guard.
-- -----------------------------------------------------------------------------
create or replace function public.is_dean_list_eligible(
  p_student_id uuid,
  p_school_year text,
  p_semester text
)
returns boolean language plpgsql security definer stable as $$
declare
  v_term_gpa numeric;
  v_max_grade numeric;
  v_finalized_count int;
  v_class_count int;
begin
  if not public.can_view_student(p_student_id) then
    return false;
  end if;

  select count(*)
    into v_class_count
    from public.enrollments e
    join public.classes c on c.id = e.class_id
    where e.student_id = p_student_id
      and c.school_year = p_school_year
      and c.semester = p_semester;

  if v_class_count = 0 then
    return false;
  end if;

  select count(*)
    into v_finalized_count
    from public.finalized_grades fg
    join public.classes c on c.id = fg.class_id
    where fg.student_id = p_student_id
      and c.school_year = p_school_year
      and c.semester = p_semester
      and fg.period = 'finals';

  if v_finalized_count < v_class_count then
    return false;
  end if;

  select coalesce(
    sum(fg.numeric_grade * coalesce(sub.units, 3.0))
      / nullif(sum(coalesce(sub.units, 3.0)), 0),
    5.0
  ),
  max(fg.numeric_grade)
    into v_term_gpa, v_max_grade
    from public.finalized_grades fg
    join public.classes c on c.id = fg.class_id
    join public.subjects sub on sub.id = c.subject_id
    where fg.student_id = p_student_id
      and c.school_year = p_school_year
      and c.semester = p_semester
      and fg.period = 'finals';

  return v_term_gpa <= 1.50 and v_max_grade <= 2.50;
end;
$$;

-- -----------------------------------------------------------------------------
-- Re-create compute_risk_level with an early authorization guard.
-- -----------------------------------------------------------------------------
create or replace function public.compute_risk_level(
  p_student_id uuid,
  p_class_id uuid default null
)
returns text language plpgsql security definer stable as $$
declare
  v_overall_avg numeric;
  v_max_failing int;
  v_total int;
  v_present int;
  v_excused int;
  v_late int;
  v_attendance_pct numeric;
begin
  if not public.can_view_student(p_student_id) then
    return null;
  end if;

  with sc as (
    select sc.score, gi.max_score, gc.class_id
      from public.scores sc
      join public.grade_items gi on gi.id = sc.grade_item_id
      join public.grade_categories gc on gc.id = gi.category_id
      where sc.student_id = p_student_id
        and sc.status = 'graded'
        and sc.score is not null
        and (p_class_id is null or gc.class_id = p_class_id)
  )
  select coalesce(avg(100.0 * score / nullif(max_score, 0)), 100)
    into v_overall_avg
    from sc;

  with failing as (
    select gc.class_id, count(*) as n
      from public.scores sc
      join public.grade_items gi on gi.id = sc.grade_item_id
      join public.grade_categories gc on gc.id = gi.category_id
      where sc.student_id = p_student_id
        and sc.status = 'graded'
        and sc.score is not null
        and (p_class_id is null or gc.class_id = p_class_id)
        and (sc.score::numeric / nullif(gi.max_score::numeric, 0)) < 0.5
      group by gc.class_id
  )
  select coalesce(max(n), 0) into v_max_failing from failing;

  select count(*)::int,
         count(*) filter (where status = 'present')::int,
         count(*) filter (where status = 'late')::int,
         count(*) filter (where status = 'excused')::int
    into v_total, v_present, v_late, v_excused
    from public.attendance
    where student_id = p_student_id
      and (p_class_id is null or class_id = p_class_id);

  if (v_total - v_excused) > 0 then
    v_attendance_pct := (100.0 * (v_present + v_late) / (v_total - v_excused))::numeric;
  else
    v_attendance_pct := 100.0;
  end if;

  if v_max_failing >= 3
     or v_overall_avg < 70
     or v_attendance_pct < 60
  then
    return 'high';
  end if;

  if v_max_failing between 1 and 2
     or v_overall_avg < 75
     or v_attendance_pct < 75
  then
    return 'medium';
  end if;

  return 'low';
end;
$$;
