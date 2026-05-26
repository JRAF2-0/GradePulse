-- =============================================================================
-- GradePulse V1 — Initial Schema
-- =============================================================================
-- Run this entire file in the Supabase SQL editor. Idempotent on a fresh DB.
-- Implements the V1 spec from GRADEPULSE_V1.md.
-- =============================================================================

-- Required extensions
create extension if not exists "pgcrypto";

-- =============================================================================
-- TABLES
-- =============================================================================

-- users: extends auth.users with role + display info
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null,
  role text not null default 'pending'
    check (role in ('pending', 'student', 'teacher', 'admin')),
  created_at timestamptz not null default now()
);

-- students: student-specific profile
create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  student_no text unique,
  course text,
  year_level int,
  section text
);

-- teachers: teacher-specific profile
create table if not exists public.teachers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  employee_no text unique,
  department text
);

-- subjects: catalog
create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  units numeric(3,1)
);

-- classes: subject taught by a teacher in a specific term
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete restrict,
  teacher_id uuid not null references public.teachers(id) on delete restrict,
  semester text not null check (semester in ('1st', '2nd', 'summer')),
  school_year text not null,
  section text,
  class_code text not null unique,
  is_archived boolean not null default false,
  created_at timestamptz not null default now()
);

-- enrollments: student in class
create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (class_id, student_id)
);

-- grade_categories: e.g., Quizzes 30%, Midterm Exam 40%
create table if not exists public.grade_categories (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  name text not null,
  weight numeric(5,2) not null check (weight >= 0 and weight <= 100),
  period text not null check (period in ('midterm', 'finals'))
);

-- grade_items: individual quizzes, exams, projects
create table if not exists public.grade_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.grade_categories(id) on delete cascade,
  title text not null,
  max_score numeric(8,2) not null check (max_score > 0),
  due_date timestamptz,
  is_published boolean not null default false
);

-- scores: student score on a grade item
create table if not exists public.scores (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  grade_item_id uuid not null references public.grade_items(id) on delete cascade,
  score numeric(8,2) check (score is null or score >= 0),
  status text not null default 'graded'
    check (status in ('graded', 'missing', 'late', 'excused')),
  remarks text,
  is_draft boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users(id) on delete set null,
  unique (grade_item_id, student_id)
);

-- finalized_grades: locked midterm/finals snapshots
create table if not exists public.finalized_grades (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  period text not null check (period in ('midterm', 'finals')),
  percentage numeric(5,2) not null,
  numeric_grade numeric(3,2) not null,
  remarks text not null,
  locked_at timestamptz not null default now(),
  locked_by uuid not null references public.users(id) on delete set null,
  unique (class_id, student_id, period)
);

-- appeals: student disputes a score
create table if not exists public.appeals (
  id uuid primary key default gen_random_uuid(),
  score_id uuid not null references public.scores(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  reason text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  teacher_response text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- notifications
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  message text not null,
  type text not null,
  is_read boolean not null default false,
  related_class_id uuid references public.classes(id) on delete set null,
  created_at timestamptz not null default now()
);

-- audit_logs: append-only record of significant changes
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.users(id) on delete set null,
  action text not null check (action in ('insert', 'update', 'delete', 'publish', 'lock')),
  target_type text not null,
  target_id uuid not null,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

-- Indexes for query performance
create index if not exists idx_enrollments_student on public.enrollments(student_id);
create index if not exists idx_enrollments_class on public.enrollments(class_id);
create index if not exists idx_scores_student on public.scores(student_id);
create index if not exists idx_scores_item on public.scores(grade_item_id);
create index if not exists idx_grade_items_category on public.grade_items(category_id);
create index if not exists idx_grade_categories_class on public.grade_categories(class_id);
create index if not exists idx_notifications_user on public.notifications(user_id, is_read, created_at desc);
create index if not exists idx_audit_logs_target on public.audit_logs(target_type, target_id);

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

create or replace function public.current_role()
returns text language sql security definer stable as $$
  select role from public.users where id = auth.uid();
$$;

create or replace function public.current_student_id()
returns uuid language sql security definer stable as $$
  select id from public.students where user_id = auth.uid();
$$;

create or replace function public.current_teacher_id()
returns uuid language sql security definer stable as $$
  select id from public.teachers where user_id = auth.uid();
$$;

-- =============================================================================
-- TRIGGERS
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.users (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    'pending'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.generate_class_code()
returns trigger language plpgsql as $$
declare
  candidate text;
  attempts int := 0;
begin
  if new.class_code is not null and new.class_code <> '' then
    return new;
  end if;
  loop
    candidate := upper(substring(replace(replace(replace(encode(gen_random_bytes(6), 'base64'), '/', ''), '+', ''), '=', '') from 1 for 6));
    candidate := translate(candidate, 'O0I1', 'XYZW');
    exit when not exists (select 1 from public.classes where class_code = candidate);
    attempts := attempts + 1;
    if attempts > 10 then
      raise exception 'Failed to generate unique class_code after 10 attempts';
    end if;
  end loop;
  new.class_code := candidate;
  return new;
end;
$$;

drop trigger if exists set_class_code on public.classes;
create trigger set_class_code
  before insert on public.classes
  for each row execute function public.generate_class_code();

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(new.updated_by, auth.uid());
  return new;
end;
$$;

drop trigger if exists scores_set_updated_at on public.scores;
create trigger scores_set_updated_at
  before update on public.scores
  for each row execute function public.set_updated_at();

create or replace function public.log_score_changes()
returns trigger language plpgsql security definer as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_logs (actor_id, action, target_type, target_id, new_value)
    values (auth.uid(), 'insert', 'score', new.id, to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public.audit_logs (actor_id, action, target_type, target_id, old_value, new_value)
    values (auth.uid(), 'update', 'score', new.id, to_jsonb(old), to_jsonb(new));
    return new;
  elsif tg_op = 'DELETE' then
    insert into public.audit_logs (actor_id, action, target_type, target_id, old_value)
    values (auth.uid(), 'delete', 'score', old.id, to_jsonb(old));
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists scores_audit on public.scores;
create trigger scores_audit
  after insert or update or delete on public.scores
  for each row execute function public.log_score_changes();

create or replace function public.log_finalized_grade()
returns trigger language plpgsql security definer as $$
begin
  insert into public.audit_logs (actor_id, action, target_type, target_id, new_value)
  values (auth.uid(), 'lock', 'finalized_grade', new.id, to_jsonb(new));
  return new;
end;
$$;

drop trigger if exists finalized_grades_audit on public.finalized_grades;
create trigger finalized_grades_audit
  after insert on public.finalized_grades
  for each row execute function public.log_finalized_grade();

create or replace function public.notify_score_change()
returns trigger language plpgsql security definer as $$
declare
  v_student_user_id uuid;
  v_class_id uuid;
  v_item_title text;
begin
  if new.is_draft then
    return new;
  end if;

  select s.user_id into v_student_user_id from public.students s where s.id = new.student_id;
  select gc.class_id, gi.title
    into v_class_id, v_item_title
    from public.grade_items gi
    join public.grade_categories gc on gc.id = gi.category_id
    where gi.id = new.grade_item_id;

  if v_student_user_id is not null then
    insert into public.notifications (user_id, message, type, related_class_id)
    values (
      v_student_user_id,
      case
        when tg_op = 'INSERT' then 'New grade posted: ' || coalesce(v_item_title, 'item')
        else 'Grade updated: ' || coalesce(v_item_title, 'item')
      end,
      case when tg_op = 'INSERT' then 'grade_posted' else 'grade_changed' end,
      v_class_id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists scores_notify on public.scores;
create trigger scores_notify
  after insert or update on public.scores
  for each row execute function public.notify_score_change();

create or replace function public.prevent_score_edit_after_lock()
returns trigger language plpgsql security definer as $$
declare
  v_class_id uuid;
  v_period text;
  v_locked boolean;
begin
  select gc.class_id, gc.period
    into v_class_id, v_period
    from public.grade_items gi
    join public.grade_categories gc on gc.id = gi.category_id
    where gi.id = coalesce(new.grade_item_id, old.grade_item_id);

  select exists(
    select 1 from public.finalized_grades
    where class_id = v_class_id
      and student_id = coalesce(new.student_id, old.student_id)
      and period = v_period
  ) into v_locked;

  if v_locked then
    raise exception 'Cannot modify score for a finalized period (% / class %)', v_period, v_class_id;
  end if;
  return new;
end;
$$;

drop trigger if exists scores_lock_guard on public.scores;
create trigger scores_lock_guard
  before update or delete on public.scores
  for each row execute function public.prevent_score_edit_after_lock();

-- =============================================================================
-- RPC FUNCTIONS
-- =============================================================================

create or replace function public.join_class_by_code(p_class_code text)
returns table(class_id uuid, subject_code text, subject_title text)
language plpgsql security definer as $$
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

create or replace function public.convert_percentage_to_numeric(pct numeric)
returns numeric language sql immutable as $$
  select case
    when pct >= 97 then 1.00
    when pct >= 94 then 1.25
    when pct >= 91 then 1.50
    when pct >= 88 then 1.75
    when pct >= 85 then 2.00
    when pct >= 84 then 2.25
    when pct >= 81 then 2.50
    when pct >= 78 then 2.75
    when pct >= 75 then 3.00
    else 5.00
  end::numeric(3,2);
$$;

create or replace function public.compute_period_grade(
  p_class_id uuid,
  p_student_id uuid,
  p_period text
)
returns table(percentage numeric, numeric_grade numeric, remarks text)
language plpgsql stable security definer as $$
declare
  v_pct numeric := 0;
  v_total_weight numeric := 0;
begin
  select
    coalesce(sum(
      case
        when cat_pct.cat_pct is null then 0
        else cat.weight * cat_pct.cat_pct
      end
    ) / nullif(sum(cat.weight), 0), 0),
    coalesce(sum(cat.weight), 0)
  into v_pct, v_total_weight
  from public.grade_categories cat
  left join lateral (
    select
      case when sum(gi.max_score) = 0 then null
        else (sum(coalesce(case when sc.status in ('graded') then sc.score else 0 end, 0))
              / sum(gi.max_score)) * 100
      end as cat_pct
    from public.grade_items gi
    left join public.scores sc
      on sc.grade_item_id = gi.id
      and sc.student_id = p_student_id
      and sc.is_draft = false
    where gi.category_id = cat.id
      and gi.is_published = true
  ) cat_pct on true
  where cat.class_id = p_class_id
    and cat.period = p_period;

  if v_total_weight = 0 then
    return query select 0::numeric, 5.00::numeric, 'No grades yet'::text;
    return;
  end if;

  return query select
    round(v_pct, 2)::numeric,
    public.convert_percentage_to_numeric(v_pct),
    case
      when v_pct >= 75 then 'Passed'
      when v_pct >= 70 then 'At Risk'
      else 'Failed'
    end;
end;
$$;

create or replace function public.compute_final_grade(
  p_class_id uuid,
  p_student_id uuid
)
returns table(percentage numeric, numeric_grade numeric, remarks text)
language plpgsql stable security definer as $$
declare
  v_mid_pct numeric;
  v_fin_pct numeric;
  v_avg numeric;
begin
  select pg.percentage into v_mid_pct
    from public.compute_period_grade(p_class_id, p_student_id, 'midterm') pg;
  select pg.percentage into v_fin_pct
    from public.compute_period_grade(p_class_id, p_student_id, 'finals') pg;

  v_avg := round(((coalesce(v_mid_pct, 0) + coalesce(v_fin_pct, 0)) / 2.0)::numeric, 2);

  return query select
    v_avg,
    public.convert_percentage_to_numeric(v_avg),
    case
      when v_avg >= 75 then 'Passed'
      when v_avg >= 70 then 'At Risk'
      else 'Failed'
    end;
end;
$$;

create or replace function public.compute_gpa(
  p_student_id uuid,
  p_school_year text,
  p_semester text
)
returns numeric language plpgsql stable security definer as $$
declare
  v_gpa numeric;
begin
  select coalesce(
    sum(fg.numeric_grade * coalesce(sub.units, 3))
    / nullif(sum(coalesce(sub.units, 3)), 0),
    0
  )
  into v_gpa
  from public.finalized_grades fg
  join public.classes c on c.id = fg.class_id
  join public.subjects sub on sub.id = c.subject_id
  where fg.student_id = p_student_id
    and c.school_year = p_school_year
    and c.semester = p_semester
    and fg.period = 'finals';

  return round(coalesce(v_gpa, 0), 2);
end;
$$;

create or replace function public.finalize_period(
  p_class_id uuid,
  p_period text
)
returns int language plpgsql security definer as $$
declare
  v_count int := 0;
  v_teacher_id uuid;
  v_user_id uuid;
  v_actor_role text;
  r record;
  v_grade record;
begin
  v_actor_role := public.current_role();
  v_user_id := auth.uid();
  select teacher_id into v_teacher_id from public.classes where id = p_class_id;

  if v_actor_role <> 'admin' and v_teacher_id <> public.current_teacher_id() then
    raise exception 'Only the class teacher or admin can finalize this period';
  end if;

  for r in
    select e.student_id from public.enrollments e where e.class_id = p_class_id
  loop
    select * into v_grade
      from public.compute_period_grade(p_class_id, r.student_id, p_period);

    insert into public.finalized_grades
      (class_id, student_id, period, percentage, numeric_grade, remarks, locked_by)
    values
      (p_class_id, r.student_id, p_period, v_grade.percentage, v_grade.numeric_grade,
       v_grade.remarks, v_user_id)
    on conflict (class_id, student_id, period) do nothing;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

alter table public.users enable row level security;
alter table public.students enable row level security;
alter table public.teachers enable row level security;
alter table public.subjects enable row level security;
alter table public.classes enable row level security;
alter table public.enrollments enable row level security;
alter table public.grade_categories enable row level security;
alter table public.grade_items enable row level security;
alter table public.scores enable row level security;
alter table public.finalized_grades enable row level security;
alter table public.appeals enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists users_select_self_or_admin on public.users;
create policy users_select_self_or_admin on public.users for select
  using (id = auth.uid() or public.current_role() = 'admin');

drop policy if exists users_update_self_no_role on public.users;
create policy users_update_self_no_role on public.users for update
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from public.users where id = auth.uid()));

drop policy if exists users_admin_all on public.users;
create policy users_admin_all on public.users for all
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

drop policy if exists students_select on public.students;
create policy students_select on public.students for select
  using (
    user_id = auth.uid()
    or public.current_role() = 'admin'
    or public.current_role() = 'teacher'
  );

drop policy if exists students_admin_all on public.students;
create policy students_admin_all on public.students for all
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

drop policy if exists teachers_select on public.teachers;
create policy teachers_select on public.teachers for select
  using (user_id = auth.uid() or public.current_role() in ('admin', 'student', 'teacher'));

drop policy if exists teachers_admin_all on public.teachers;
create policy teachers_admin_all on public.teachers for all
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

drop policy if exists subjects_read_all on public.subjects;
create policy subjects_read_all on public.subjects for select
  using (auth.role() = 'authenticated');

drop policy if exists subjects_admin_write on public.subjects;
create policy subjects_admin_write on public.subjects for all
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- NOTE: classes/enrollments/grade_categories/grade_items/scores/finalized_grades/appeals
-- policies are rewritten in 0004_fix_rls_recursion.sql using SECURITY DEFINER helpers
-- to break infinite recursion. The policies below are the initial (buggy) versions
-- kept here for historical accuracy; 0004 supersedes them.

drop policy if exists classes_select on public.classes;
create policy classes_select on public.classes for select
  using (
    public.current_role() = 'admin'
    or teacher_id = public.current_teacher_id()
    or exists (
      select 1 from public.enrollments e
      where e.class_id = classes.id and e.student_id = public.current_student_id()
    )
  );

drop policy if exists classes_teacher_write on public.classes;
create policy classes_teacher_write on public.classes for all
  using (
    public.current_role() = 'admin' or teacher_id = public.current_teacher_id()
  )
  with check (
    public.current_role() = 'admin' or teacher_id = public.current_teacher_id()
  );

drop policy if exists enrollments_select on public.enrollments;
create policy enrollments_select on public.enrollments for select
  using (
    public.current_role() = 'admin'
    or student_id = public.current_student_id()
    or exists (select 1 from public.classes c
               where c.id = enrollments.class_id
                 and c.teacher_id = public.current_teacher_id())
  );

drop policy if exists enrollments_admin_write on public.enrollments;
create policy enrollments_admin_write on public.enrollments for all
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications for select
  using (user_id = auth.uid());

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists audit_admin_select on public.audit_logs;
create policy audit_admin_select on public.audit_logs for select
  using (public.current_role() = 'admin');

-- =============================================================================
-- REALTIME PUBLICATION
-- =============================================================================

alter publication supabase_realtime add table public.scores;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.grade_items;
