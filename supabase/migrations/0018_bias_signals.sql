-- =============================================================================
-- GradePulse V2 — Bias / anomaly detection signals
-- =============================================================================
-- compute_bias_signals() returns a read-only list of statistical flags for
-- admins (system-wide) and department heads (scoped to their department).
-- These are SIGNALS, NOT ACCUSATIONS — they surface classes worth a closer
-- look, never an automated judgement.
--
-- Signals (all computed from FINALIZED 'finals' grades, so incomplete terms
-- don't generate noise):
--   1. below_dept_avg     — class avg > 1 SD below the department mean
--                           (only when the department has >= 3 finalized
--                            classes and non-zero spread)
--   2. section_divergence — a section's avg is > 10 points below the other
--                           sections of the SAME subject + teacher
--   3. high_fail_rate     — >= 30% of the class has a failing final grade
--   4. entry_burst        — > 50 score writes recorded in a single day for a
--                           class (from audit_logs) — possible bulk override
--
-- Each row: signal_type, class identity, teacher + department labels, the
-- metric value, the benchmark it's compared against, and a human detail.
-- =============================================================================

create or replace function public.compute_bias_signals()
returns table(
  signal_type text,
  class_id uuid,
  subject_code text,
  subject_title text,
  section text,
  teacher_name text,
  department_name text,
  metric numeric,
  benchmark numeric,
  detail text
)
language plpgsql security definer stable as $$
declare
  v_is_admin boolean := public.current_role() = 'admin';
  v_dept uuid := public.current_department_head_dept_id();
begin
  if not v_is_admin and v_dept is null then
    raise exception 'Admin or department head only';
  end if;

  return query
  with class_avgs as (
    select
      c.id as class_id,
      c.subject_id,
      c.teacher_id,
      c.section,
      s.department_id,
      avg(fg.percentage)::numeric as avg_pct,
      count(*) as n_students,
      count(*) filter (where fg.percentage < 75) as n_failing
    from public.finalized_grades fg
    join public.classes c on c.id = fg.class_id
    join public.subjects s on s.id = c.subject_id
    where fg.period = 'finals'
    group by c.id, c.subject_id, c.teacher_id, c.section, s.department_id
  ),
  dept_stats as (
    select department_id,
           avg(avg_pct) as dept_mean,
           stddev_pop(avg_pct) as dept_sd,
           count(*) as n_classes
    from class_avgs
    where department_id is not null
    group by department_id
  ),
  group_stats as (
    select subject_id, teacher_id,
           avg(avg_pct) as grp_mean,
           count(*) as n_sections
    from class_avgs
    group by subject_id, teacher_id
    having count(*) > 1
  ),
  entry_bursts as (
    select gc.class_id, al.created_at::date as day, count(*) as n
    from public.audit_logs al
    join public.scores sc on sc.id = al.target_id
    join public.grade_items gi on gi.id = sc.grade_item_id
    join public.grade_categories gc on gc.id = gi.category_id
    where al.target_type = 'score'
      and al.action in ('insert', 'update')
    group by gc.class_id, al.created_at::date
    having count(*) > 50
  ),
  labeled as (
    select ca.*,
           subj.code as subject_code,
           subj.title as subject_title,
           u.full_name as teacher_name,
           d.name as department_name
    from class_avgs ca
    join public.subjects subj on subj.id = ca.subject_id
    left join public.teachers t on t.id = ca.teacher_id
    left join public.users u on u.id = t.user_id
    left join public.departments d on d.id = ca.department_id
  )
  -- Signal 1: class avg > 1 SD below the department mean
  select 'below_dept_avg'::text, l.class_id, l.subject_code, l.subject_title, l.section,
         l.teacher_name, l.department_name,
         round(l.avg_pct, 2), round(ds.dept_mean, 2),
         'Class average is more than 1 standard deviation below the department mean.'::text
  from labeled l
  join dept_stats ds on ds.department_id = l.department_id
  where ds.n_classes >= 3
    and ds.dept_sd > 0
    and l.avg_pct < ds.dept_mean - ds.dept_sd
    and (v_is_admin or l.department_id = v_dept)

  union all
  -- Signal 2: section diverges from sibling sections (same subject + teacher)
  select 'section_divergence'::text, l.class_id, l.subject_code, l.subject_title, l.section,
         l.teacher_name, l.department_name,
         round(l.avg_pct, 2), round(gs.grp_mean, 2),
         'This section''s average is more than 10 points below other sections of the same subject and teacher.'::text
  from labeled l
  join group_stats gs on gs.subject_id = l.subject_id and gs.teacher_id = l.teacher_id
  where l.avg_pct < gs.grp_mean - 10
    and (v_is_admin or l.department_id = v_dept)

  union all
  -- Signal 3: high failing rate (>= 30%)
  select 'high_fail_rate'::text, l.class_id, l.subject_code, l.subject_title, l.section,
         l.teacher_name, l.department_name,
         round(100.0 * l.n_failing / nullif(l.n_students, 0), 1), 30.0::numeric,
         'At least 30% of this class has a failing final grade.'::text
  from labeled l
  where l.n_students > 0
    and (l.n_failing::numeric / l.n_students) >= 0.30
    and (v_is_admin or l.department_id = v_dept)

  union all
  -- Signal 4: grade entry burst (> 50 score writes in a day)
  select 'entry_burst'::text, l.class_id, l.subject_code, l.subject_title, l.section,
         l.teacher_name, l.department_name,
         eb.n::numeric, 50.0::numeric,
         ('More than 50 score changes were recorded on ' || eb.day::text || ' for this class.')::text
  from entry_bursts eb
  join labeled l on l.class_id = eb.class_id
  where (v_is_admin or l.department_id = v_dept);
end;
$$;
