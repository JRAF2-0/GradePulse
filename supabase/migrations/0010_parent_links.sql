-- =============================================================================
-- GradePulse V2 — Parent ↔ Student linkage + parent-scoped RLS
-- =============================================================================
-- A `parent` role user is read-only and can only see data for the specific
-- students they are linked to via `parent_students`. Admins create + manage
-- these links. A parent can be linked to multiple children; a student can
-- have multiple linked guardians (mother, father, guardian, etc.).
--
-- This migration:
--   1. Creates the parent_students table
--   2. Adds helper functions to check parent ↔ student relationships
--   3. Extends RLS on the existing student-data tables so parents can read
--      (but never write) data for their linked children only
--   4. Updates can_see_user() so parents can read names of the teachers
--      teaching their children's classes
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. parent_students linkage table
-- -----------------------------------------------------------------------------
create table if not exists public.parent_students (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.users(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  relationship text,                       -- 'mother', 'father', 'guardian', etc.
  created_at timestamptz not null default now(),
  unique (parent_id, student_id)
);

create index if not exists parent_students_parent_id_idx on public.parent_students(parent_id);
create index if not exists parent_students_student_id_idx on public.parent_students(student_id);

alter table public.parent_students enable row level security;

-- -----------------------------------------------------------------------------
-- 2. Helpers
-- -----------------------------------------------------------------------------
-- True if the caller is a parent linked to the given student.
-- SECURITY DEFINER to bypass RLS recursion when used in policies.
create or replace function public.is_parent_of(p_student_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.parent_students ps
    where ps.parent_id = auth.uid()
      and ps.student_id = p_student_id
  );
$$;

-- True if the caller is a parent linked to any student enrolled in this class.
-- Used by class/grade-category/grade-item RLS so a parent can read the
-- structure of classes their child is enrolled in.
create or replace function public.parent_can_see_class(p_class_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1
    from public.parent_students ps
    join public.enrollments e on e.student_id = ps.student_id
    where ps.parent_id = auth.uid()
      and e.class_id = p_class_id
  );
$$;

-- -----------------------------------------------------------------------------
-- 3. RLS on parent_students
-- -----------------------------------------------------------------------------
drop policy if exists parent_students_select on public.parent_students;
create policy parent_students_select on public.parent_students for select
  using (
    public.current_role() = 'admin'
    or parent_id = auth.uid()              -- parent sees their own links
  );

-- Only admins manage parent ↔ student links.
drop policy if exists parent_students_admin_write on public.parent_students;
create policy parent_students_admin_write on public.parent_students for all
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- -----------------------------------------------------------------------------
-- 4. Extend RLS so parents can read their linked students' data
-- -----------------------------------------------------------------------------
-- students: parent can read rows for their linked children
drop policy if exists students_select on public.students;
create policy students_select on public.students for select
  using (
    user_id = auth.uid()
    or public.current_role() = 'admin'
    or public.current_role() = 'teacher'
    or public.is_parent_of(id)
  );

-- enrollments: parent reads enrollments of their linked students
drop policy if exists enrollments_select on public.enrollments;
create policy enrollments_select on public.enrollments for select
  using (
    public.current_role() = 'admin'
    or public.is_class_teacher(class_id)
    or student_id = public.current_student_id()
    or public.dept_head_owns_class(class_id)
    or public.is_parent_of(student_id)
  );

-- classes: parent reads classes their linked students are enrolled in
drop policy if exists classes_select on public.classes;
create policy classes_select on public.classes for select
  using (
    public.current_role() = 'admin'
    or teacher_id = public.current_teacher_id()
    or public.is_enrolled(id)
    or public.dept_head_owns_class(id)
    or public.parent_can_see_class(id)
  );

-- grade_categories: parent reads categories of classes their children are in
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
    or exists (
      select 1 from public.grade_categories gc
      where gc.id = grade_categories.id and public.parent_can_see_class(gc.class_id)
    )
  );

-- grade_items: parent reads published items in their children's classes
-- (mirrors the V1 student rule — only published items are visible)
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
    or exists (
      select 1
      from public.grade_items gi
      join public.grade_categories gc on gc.id = gi.category_id
      where gi.id = grade_items.id
        and public.parent_can_see_class(gc.class_id)
        and gi.is_published = true
    )
  );

-- scores: parent reads scores belonging to their linked children
-- (only for published items, so they see exactly what the student sees)
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
    or exists (
      select 1
      from public.scores s
      join public.grade_items gi on gi.id = s.grade_item_id
      where s.id = scores.id
        and gi.is_published = true
        and public.is_parent_of(s.student_id)
    )
  );

-- finalized_grades: parent reads finalized grades of their linked children
drop policy if exists finalized_grades_select on public.finalized_grades;
create policy finalized_grades_select on public.finalized_grades for select
  using (
    public.current_role() = 'admin'
    or student_id = public.current_student_id()
    or public.is_class_teacher(class_id)
    or public.dept_head_owns_class(class_id)
    or public.is_parent_of(student_id)
  );

-- -----------------------------------------------------------------------------
-- 5. Extend can_see_user() so parents can read teacher + child names
-- -----------------------------------------------------------------------------
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
    -- dept_head: any teacher in their department
    or exists (
      select 1
      from public.teachers t
      where t.user_id = target_user_id
        and t.department_id is not null
        and t.department_id = public.current_department_head_dept_id()
    )
    -- dept_head: any student enrolled in any class in their department
    or exists (
      select 1
      from public.students s
      join public.enrollments e on e.student_id = s.id
      join public.classes c on c.id = e.class_id
      join public.subjects subj on subj.id = c.subject_id
      where s.user_id = target_user_id
        and subj.department_id is not null
        and subj.department_id = public.current_department_head_dept_id()
    )
    -- parent: any of their linked children
    or exists (
      select 1
      from public.parent_students ps
      join public.students s on s.id = ps.student_id
      where ps.parent_id = auth.uid() and s.user_id = target_user_id
    )
    -- parent: any teacher teaching any class their linked children are in
    or exists (
      select 1
      from public.parent_students ps
      join public.enrollments e on e.student_id = ps.student_id
      join public.classes c on c.id = e.class_id
      join public.teachers t on t.id = c.teacher_id
      where ps.parent_id = auth.uid() and t.user_id = target_user_id
    );
$$;
