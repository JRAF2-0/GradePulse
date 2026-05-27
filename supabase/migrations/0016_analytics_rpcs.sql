-- =============================================================================
-- GradePulse V2 — Analytics RPCs (CGPA, Dean's List, Risk Prediction)
-- =============================================================================
-- Three SECURITY DEFINER RPCs that power the V2 analytics surfaces:
--
--   * compute_cgpa(p_student_id)            — weighted cumulative GPA across
--                                              all finalized terms (PH scale
--                                              1.00 best → 5.00 worst), units
--                                              from subjects.units as weight.
--
--   * is_dean_list_eligible(p_student_id, p_school_year, p_semester)
--                                            — boolean. Requires:
--                                                * a finalized "finals"
--                                                  grade in every class for
--                                                  that term
--                                                * term GPA ≤ 1.50
--                                                * no class numeric grade > 2.50
--
--   * compute_risk_level(p_student_id, p_class_id default null)
--                                            — 'low' | 'medium' | 'high'.
--                                              Rule-based (see comments below).
--
-- All three bypass RLS via SECURITY DEFINER. They're safe for the caller
-- because they always scope to a single student_id passed in, and the
-- callers (student dashboard, teacher roster, admin counters) already gate
-- visibility before invoking.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. compute_cgpa
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
    and fg.period = 'finals';
$$;

-- -----------------------------------------------------------------------------
-- 2. is_dean_list_eligible
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
  -- Count classes the student is enrolled in for this term
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

  -- Count classes where the student has a finalized "finals" grade
  select count(*)
    into v_finalized_count
    from public.finalized_grades fg
    join public.classes c on c.id = fg.class_id
    where fg.student_id = p_student_id
      and c.school_year = p_school_year
      and c.semester = p_semester
      and fg.period = 'finals';

  -- Must have finalized grades for every class in the term
  if v_finalized_count < v_class_count then
    return false;
  end if;

  -- Weighted GPA for the term
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

  -- Plan defaults: GPA ≤ 1.50 AND no grade > 2.50
  return v_term_gpa <= 1.50 and v_max_grade <= 2.50;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. compute_risk_level
-- -----------------------------------------------------------------------------
-- Risk rules (per the V2 plan defaults; easily tunable):
--   * HIGH if any of:
--       - ≥3 failing scores in any single class the student is enrolled in
--       - current overall avg < 70%
--       - attendance % < 60% (across all classes if p_class_id is null,
--                              else for the given class)
--   * MEDIUM if any of:
--       - 1 or 2 failing scores in any single enrolled class
--       - overall avg 70–75%
--       - attendance 60–75%
--   * LOW otherwise.
--
-- "Failing score" = a graded score whose percentage of max_score is < 50%.
-- "Overall avg"   = simple mean of the percentages of all graded scores.
-- =============================================================================
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
  -- ----- overall average -----
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

  -- ----- max failing scores in any one class -----
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

  -- ----- attendance % (mirrors get_attendance_summary) -----
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

  -- ----- decision -----
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

-- -----------------------------------------------------------------------------
-- 4. Admin-side aggregate counters (efficient — one SQL pass per call)
-- -----------------------------------------------------------------------------
-- Returns counts of high-risk students system-wide. Admin-only.
create or replace function public.count_high_risk_students()
returns int language plpgsql security definer stable as $$
declare
  v_count int;
begin
  if public.current_role() <> 'admin' then
    raise exception 'Admin only';
  end if;
  select count(*)
    into v_count
    from public.students s
    where public.compute_risk_level(s.id, null) = 'high';
  return v_count;
end;
$$;

-- Returns counts of Dean's List students for the most recent term any class
-- exists in (school_year + semester with the most recent created_at).
create or replace function public.count_deans_list_current_term()
returns int language plpgsql security definer stable as $$
declare
  v_year text;
  v_sem text;
  v_count int;
begin
  if public.current_role() <> 'admin' then
    raise exception 'Admin only';
  end if;

  select c.school_year, c.semester
    into v_year, v_sem
    from public.classes c
    order by c.created_at desc
    limit 1;

  if v_year is null then
    return 0;
  end if;

  select count(distinct s.id)
    into v_count
    from public.students s
    where public.is_dean_list_eligible(s.id, v_year, v_sem) = true;

  return v_count;
end;
$$;

