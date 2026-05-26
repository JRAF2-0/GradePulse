-- =============================================================================
-- GradePulse — Fix RLS infinite recursion
-- =============================================================================
-- Multiple policies cross-reference (classes ↔ enrollments, grade_items → classes,
-- scores → grade_items → categories → classes, etc.). Each cross-table EXISTS
-- triggered the OTHER table's RLS, which in turn referenced the first table,
-- causing Postgres to detect infinite recursion.
--
-- Fix: introduce SECURITY DEFINER helper functions that bypass RLS, and rewrite
-- the recursive policies to use them.
-- =============================================================================

create or replace function public.is_class_teacher(p_class_id uuid)
returns boolean language sql security definer stable as $$
  select exists(
    select 1
    from public.classes c
    join public.teachers t on t.id = c.teacher_id
    where c.id = p_class_id and t.user_id = auth.uid()
  );
$$;

create or replace function public.is_enrolled(p_class_id uuid)
returns boolean language sql security definer stable as $$
  select exists(
    select 1
    from public.enrollments e
    join public.students s on s.id = e.student_id
    where e.class_id = p_class_id and s.user_id = auth.uid()
  );
$$;

create or replace function public.is_category_teacher(p_category_id uuid)
returns boolean language sql security definer stable as $$
  select exists(
    select 1
    from public.grade_categories gc
    join public.classes c on c.id = gc.class_id
    join public.teachers t on t.id = c.teacher_id
    where gc.id = p_category_id and t.user_id = auth.uid()
  );
$$;

create or replace function public.is_item_teacher(p_item_id uuid)
returns boolean language sql security definer stable as $$
  select exists(
    select 1
    from public.grade_items gi
    join public.grade_categories gc on gc.id = gi.category_id
    join public.classes c on c.id = gc.class_id
    join public.teachers t on t.id = c.teacher_id
    where gi.id = p_item_id and t.user_id = auth.uid()
  );
$$;

create or replace function public.can_student_read_item(p_item_id uuid)
returns boolean language sql security definer stable as $$
  select exists(
    select 1
    from public.grade_items gi
    join public.grade_categories gc on gc.id = gi.category_id
    join public.enrollments e on e.class_id = gc.class_id
    join public.students s on s.id = e.student_id
    where gi.id = p_item_id
      and gi.is_published = true
      and s.user_id = auth.uid()
  );
$$;

create or replace function public.is_score_teacher(p_score_id uuid)
returns boolean language sql security definer stable as $$
  select exists(
    select 1
    from public.scores sc
    join public.grade_items gi on gi.id = sc.grade_item_id
    join public.grade_categories gc on gc.id = gi.category_id
    join public.classes c on c.id = gc.class_id
    join public.teachers t on t.id = c.teacher_id
    where sc.id = p_score_id and t.user_id = auth.uid()
  );
$$;

-- ---------- classes ----------
drop policy if exists classes_select on public.classes;
create policy classes_select on public.classes for select
  using (
    public.current_role() = 'admin'
    or teacher_id = public.current_teacher_id()
    or public.is_enrolled(id)
  );

drop policy if exists classes_teacher_write on public.classes;
create policy classes_teacher_write on public.classes for all
  using (
    public.current_role() = 'admin' or teacher_id = public.current_teacher_id()
  )
  with check (
    public.current_role() = 'admin' or teacher_id = public.current_teacher_id()
  );

-- ---------- enrollments ----------
drop policy if exists enrollments_select on public.enrollments;
create policy enrollments_select on public.enrollments for select
  using (
    public.current_role() = 'admin'
    or student_id = public.current_student_id()
    or public.is_class_teacher(class_id)
  );

drop policy if exists enrollments_teacher_delete on public.enrollments;
create policy enrollments_teacher_delete on public.enrollments for delete
  using (public.is_class_teacher(class_id));

-- ---------- grade_categories ----------
drop policy if exists categories_select on public.grade_categories;
create policy categories_select on public.grade_categories for select
  using (
    public.current_role() = 'admin'
    or public.is_class_teacher(class_id)
    or public.is_enrolled(class_id)
  );

drop policy if exists categories_teacher_write on public.grade_categories;
create policy categories_teacher_write on public.grade_categories for all
  using (
    public.current_role() = 'admin' or public.is_class_teacher(class_id)
  )
  with check (
    public.current_role() = 'admin' or public.is_class_teacher(class_id)
  );

-- ---------- grade_items ----------
drop policy if exists items_select on public.grade_items;
create policy items_select on public.grade_items for select
  using (
    public.current_role() = 'admin'
    or public.is_category_teacher(category_id)
    or (is_published = true and exists (
      select 1
      from public.grade_categories gc
      where gc.id = grade_items.category_id
        and public.is_enrolled(gc.class_id)
    ))
  );

drop policy if exists items_teacher_write on public.grade_items;
create policy items_teacher_write on public.grade_items for all
  using (
    public.current_role() = 'admin' or public.is_category_teacher(category_id)
  )
  with check (
    public.current_role() = 'admin' or public.is_category_teacher(category_id)
  );

-- ---------- scores ----------
drop policy if exists scores_select on public.scores;
create policy scores_select on public.scores for select
  using (
    public.current_role() = 'admin'
    or public.is_item_teacher(grade_item_id)
    or (
      student_id = public.current_student_id()
      and is_draft = false
      and public.can_student_read_item(grade_item_id)
    )
  );

drop policy if exists scores_teacher_write on public.scores;
create policy scores_teacher_write on public.scores for all
  using (
    public.current_role() = 'admin' or public.is_item_teacher(grade_item_id)
  )
  with check (
    public.current_role() = 'admin' or public.is_item_teacher(grade_item_id)
  );

-- ---------- finalized_grades ----------
drop policy if exists finalized_select on public.finalized_grades;
create policy finalized_select on public.finalized_grades for select
  using (
    public.current_role() = 'admin'
    or student_id = public.current_student_id()
    or public.is_class_teacher(class_id)
  );

-- ---------- appeals ----------
drop policy if exists appeals_select on public.appeals;
create policy appeals_select on public.appeals for select
  using (
    public.current_role() = 'admin'
    or student_id = public.current_student_id()
    or public.is_score_teacher(score_id)
  );

drop policy if exists appeals_student_insert on public.appeals;
create policy appeals_student_insert on public.appeals for insert
  with check (student_id = public.current_student_id());

drop policy if exists appeals_teacher_update on public.appeals;
create policy appeals_teacher_update on public.appeals for update
  using (
    public.current_role() = 'admin' or public.is_score_teacher(score_id)
  );
