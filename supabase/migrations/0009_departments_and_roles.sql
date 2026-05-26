-- =============================================================================
-- GradePulse V2 — Departments + new roles (department_head, parent)
-- =============================================================================
-- Adds two new user roles for V2:
--   * department_head — read-only oversight of a department's classes,
--     plus approval authority on post-finalize grade change requests
--   * parent — read-only access to grades/attendance of linked students
--
-- Also introduces the departments catalog and links teachers + subjects to it,
-- which is the basis for department-scoped RLS, bias detection, and parent
-- access boundaries in later V2 migrations.
--
-- The original `teachers.department` text column is kept for backward compat
-- with V1 data; new code should prefer `teachers.department_id`.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Expand users.role check constraint
-- -----------------------------------------------------------------------------
-- The V1 constraint was created inline (auto-named users_role_check). Drop it
-- defensively in case Postgres auto-named it differently in some environment.
do $$
declare
  v_constraint_name text;
begin
  select conname into v_constraint_name
    from pg_constraint
    where conrelid = 'public.users'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%role%in%';
  if v_constraint_name is not null then
    execute format('alter table public.users drop constraint %I', v_constraint_name);
  end if;
end$$;

alter table public.users
  add constraint users_role_check
  check (role in ('pending', 'student', 'teacher', 'admin', 'department_head', 'parent'));

-- -----------------------------------------------------------------------------
-- 2. Departments catalog
-- -----------------------------------------------------------------------------
create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,             -- e.g., "CS", "MATH"
  name text not null,                    -- e.g., "Computer Science"
  head_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 3. Link teachers + subjects to a department
-- -----------------------------------------------------------------------------
alter table public.teachers
  add column if not exists department_id uuid references public.departments(id) on delete set null;

alter table public.subjects
  add column if not exists department_id uuid references public.departments(id) on delete set null;

create index if not exists teachers_department_id_idx on public.teachers(department_id);
create index if not exists subjects_department_id_idx on public.subjects(department_id);
create index if not exists departments_head_id_idx on public.departments(head_id);

-- -----------------------------------------------------------------------------
-- 4. Helpers for the new roles
-- -----------------------------------------------------------------------------
-- Returns the department_id this department_head leads (null if not a head).
-- SECURITY DEFINER bypasses RLS to avoid recursion.
create or replace function public.current_department_head_dept_id()
returns uuid language sql security definer stable as $$
  select d.id
    from public.departments d
    where d.head_id = auth.uid()
    limit 1;
$$;

-- Convenience: true if a given subject belongs to the caller's department
-- (when the caller is a department_head).
create or replace function public.dept_head_owns_subject(p_subject_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1
    from public.subjects s
    where s.id = p_subject_id
      and s.department_id is not null
      and s.department_id = public.current_department_head_dept_id()
  );
$$;

-- Convenience: true if a given class belongs to a subject in the caller's
-- department.
create or replace function public.dept_head_owns_class(p_class_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1
    from public.classes c
    join public.subjects s on s.id = c.subject_id
    where c.id = p_class_id
      and s.department_id is not null
      and s.department_id = public.current_department_head_dept_id()
  );
$$;

-- -----------------------------------------------------------------------------
-- 5. RLS for the departments table itself
-- -----------------------------------------------------------------------------
alter table public.departments enable row level security;

-- Everyone authenticated can read the department catalog (needed for pickers
-- and labels on cards). It contains no sensitive data — just code + name.
drop policy if exists departments_select_all on public.departments;
create policy departments_select_all on public.departments for select
  using (auth.uid() is not null);

-- Only admins can create / update / delete departments.
drop policy if exists departments_admin_write on public.departments;
create policy departments_admin_write on public.departments for all
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- -----------------------------------------------------------------------------
-- 6. Extend existing RLS so department_heads can read their department's data
-- -----------------------------------------------------------------------------
-- NOTE: Parent role policies are added in 0010_parent_links.sql since they
-- depend on the parent_students table.

-- subjects: dept_head reads subjects in their department (admins/teachers
-- already covered by V1 policies). Re-create the V1 select policy to be a
-- single union so we don't have duplicate "FOR SELECT" rules.
drop policy if exists subjects_select on public.subjects;
drop policy if exists subjects_select_all on public.subjects;
create policy subjects_select on public.subjects for select
  using (
    auth.uid() is not null
  );
-- (subjects were already world-readable to authenticated users in V1 — keeping
-- that behavior; the department_id is just additional metadata.)

-- classes: dept_head reads any class whose subject is in their department.
-- The V1 classes_select policy allowed admin OR own-teacher OR enrolled student.
-- Re-create it adding the dept_head branch.
drop policy if exists classes_select on public.classes;
create policy classes_select on public.classes for select
  using (
    public.current_role() = 'admin'
    or teacher_id = public.current_teacher_id()
    or public.is_enrolled(id)
    or public.dept_head_owns_class(id)
  );

-- grade_categories / grade_items / scores: extend select policies so a
-- dept_head can read everything within their department's classes.
drop policy if exists grade_categories_select on public.grade_categories;
create policy grade_categories_select on public.grade_categories for select
  using (
    public.current_role() = 'admin'
    or public.is_category_teacher(id)
    or exists (
      select 1 from public.grade_categories gc
      where gc.id = grade_categories.id and public.is_enrolled(gc.class_id)
    )
    or exists (
      select 1 from public.grade_categories gc
      where gc.id = grade_categories.id and public.dept_head_owns_class(gc.class_id)
    )
  );

drop policy if exists grade_items_select on public.grade_items;
create policy grade_items_select on public.grade_items for select
  using (
    public.current_role() = 'admin'
    or public.is_item_teacher(id)
    or public.can_student_read_item(id)
    or exists (
      select 1
      from public.grade_items gi
      join public.grade_categories gc on gc.id = gi.category_id
      where gi.id = grade_items.id
        and public.dept_head_owns_class(gc.class_id)
    )
  );

drop policy if exists scores_select on public.scores;
create policy scores_select on public.scores for select
  using (
    public.current_role() = 'admin'
    or student_id = public.current_student_id()
    or public.is_score_teacher(id)
    or exists (
      select 1
      from public.scores s
      join public.grade_items gi on gi.id = s.grade_item_id
      join public.grade_categories gc on gc.id = gi.category_id
      where s.id = scores.id
        and public.dept_head_owns_class(gc.class_id)
    )
  );

-- enrollments: dept_head can see who is enrolled in classes within their dept.
drop policy if exists enrollments_select on public.enrollments;
create policy enrollments_select on public.enrollments for select
  using (
    public.current_role() = 'admin'
    or public.is_class_teacher(class_id)
    or student_id = public.current_student_id()
    or public.dept_head_owns_class(class_id)
  );

-- finalized_grades: dept_head reads finalized grades in their dept's classes.
drop policy if exists finalized_grades_select on public.finalized_grades;
create policy finalized_grades_select on public.finalized_grades for select
  using (
    public.current_role() = 'admin'
    or student_id = public.current_student_id()
    or public.is_class_teacher(class_id)
    or public.dept_head_owns_class(class_id)
  );

-- -----------------------------------------------------------------------------
-- 7. Update can_see_user() so dept_heads can read names of users in their dept
-- -----------------------------------------------------------------------------
-- A dept_head needs to see student + teacher names for any class within their
-- department; otherwise embedded users(full_name) joins return null.
create or replace function public.can_see_user(target_user_id uuid)
returns boolean language sql security definer stable as $$
  select
    target_user_id = auth.uid()
    or public.current_role() = 'admin'
    or exists (
      select 1
      from public.teachers t
      join public.classes c on c.teacher_id = t.id
      join public.enrollments e on e.class_id = c.id
      join public.students s on s.id = e.student_id
      where t.user_id = auth.uid() and s.user_id = target_user_id
    )
    or exists (
      select 1
      from public.students s
      join public.enrollments e on e.student_id = s.id
      join public.classes c on c.id = e.class_id
      join public.teachers t on t.id = c.teacher_id
      where s.user_id = auth.uid() and t.user_id = target_user_id
    )
    -- dept_head can see any teacher in their department
    or exists (
      select 1
      from public.teachers t
      where t.user_id = target_user_id
        and t.department_id is not null
        and t.department_id = public.current_department_head_dept_id()
    )
    -- dept_head can see any student enrolled in any class within their dept
    or exists (
      select 1
      from public.students s
      join public.enrollments e on e.student_id = s.id
      join public.classes c on c.id = e.class_id
      join public.subjects subj on subj.id = c.subject_id
      where s.user_id = target_user_id
        and subj.department_id is not null
        and subj.department_id = public.current_department_head_dept_id()
    );
$$;
