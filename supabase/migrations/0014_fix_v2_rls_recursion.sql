-- =============================================================================
-- GradePulse V2 — Fix RLS recursion introduced by 0009 / 0010
-- =============================================================================
-- 0009 and 0010 added dept_head + parent branches to the SELECT policies on
-- grade_categories, grade_items, scores, etc. The new branches were written
-- as `EXISTS (select 1 from same_table self where self.id = same_table.id
-- and ...)` which RE-EXECUTES the same RLS policy and triggers infinite
-- recursion in any query that JOINs through these tables (e.g., when
-- scores RLS joins grade_items + grade_categories, each join re-applies
-- the target table's RLS).
--
-- Fix: rewrite the SELECT policies to use:
--   * direct column refs (e.g., grade_categories.class_id) where the column
--     exists on the row being checked
--   * SECURITY DEFINER helpers that look up indirect class_ids without
--     re-entering RLS
--
-- Also restate the V1 helper policies idempotently so the chain ends up in
-- a known-good state.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. New SECURITY DEFINER helpers to resolve class_id from item/score IDs
-- -----------------------------------------------------------------------------
create or replace function public.grade_item_class_id(p_item_id uuid)
returns uuid language sql security definer stable as $$
  select gc.class_id
    from public.grade_items gi
    join public.grade_categories gc on gc.id = gi.category_id
    where gi.id = p_item_id;
$$;

create or replace function public.score_class_id(p_score_id uuid)
returns uuid language sql security definer stable as $$
  select gc.class_id
    from public.scores sc
    join public.grade_items gi on gi.id = sc.grade_item_id
    join public.grade_categories gc on gc.id = gi.category_id
    where sc.id = p_score_id;
$$;

-- -----------------------------------------------------------------------------
-- 2. grade_categories SELECT — no more self-EXISTS, use class_id directly
-- -----------------------------------------------------------------------------
drop policy if exists grade_categories_select on public.grade_categories;
create policy grade_categories_select on public.grade_categories for select
  using (
    public.current_role() = 'admin'
    or public.is_category_teacher(id)
    or public.is_enrolled(class_id)
    or public.dept_head_owns_class(class_id)
    or public.parent_can_see_class(class_id)
  );

-- -----------------------------------------------------------------------------
-- 3. grade_items SELECT — resolve class_id via helper, no self-EXISTS
-- -----------------------------------------------------------------------------
drop policy if exists grade_items_select on public.grade_items;
create policy grade_items_select on public.grade_items for select
  using (
    public.current_role() = 'admin'
    or public.is_item_teacher(id)
    or public.can_student_read_item(id)
    or public.dept_head_owns_class(public.grade_item_class_id(id))
    or (
      is_published = true
      and public.parent_can_see_class(public.grade_item_class_id(id))
    )
  );

-- -----------------------------------------------------------------------------
-- 4. scores SELECT — resolve class_id via helper, no self-EXISTS
-- -----------------------------------------------------------------------------
drop policy if exists scores_select on public.scores;
create policy scores_select on public.scores for select
  using (
    public.current_role() = 'admin'
    or student_id = public.current_student_id()
    or public.is_score_teacher(id)
    or public.dept_head_owns_class(public.score_class_id(id))
    or (
      public.is_parent_of(student_id)
      and exists (
        select 1 from public.grade_items gi
        where gi.id = scores.grade_item_id and gi.is_published = true
      )
    )
  );

-- The parent branch on scores still has an EXISTS but it's to grade_items,
-- NOT to scores itself, and grade_items RLS uses only SECURITY DEFINER
-- helpers now, so no recursion path exists.

-- -----------------------------------------------------------------------------
-- 5. enrollments / classes / finalized_grades — already use helpers, restate
--    for idempotence
-- -----------------------------------------------------------------------------
drop policy if exists enrollments_select on public.enrollments;
create policy enrollments_select on public.enrollments for select
  using (
    public.current_role() = 'admin'
    or public.is_class_teacher(class_id)
    or student_id = public.current_student_id()
    or public.dept_head_owns_class(class_id)
    or public.is_parent_of(student_id)
  );

drop policy if exists classes_select on public.classes;
create policy classes_select on public.classes for select
  using (
    public.current_role() = 'admin'
    or teacher_id = public.current_teacher_id()
    or public.is_enrolled(id)
    or public.dept_head_owns_class(id)
    or public.parent_can_see_class(id)
  );

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
-- 6. score_comments SELECT — same pattern, fix any self-EXISTS that exist
-- -----------------------------------------------------------------------------
-- The 0013 policy already routes through SECURITY DEFINER helpers for the
-- score/item ownership checks, but the dept_head and parent branches use
-- EXISTS into grade_items / grade_categories which may now cascade. Restate
-- using the new helpers so no chain touches grade_categories or grade_items
-- RLS at all.
drop policy if exists score_comments_select on public.score_comments;
create policy score_comments_select on public.score_comments for select
  using (
    public.current_role() = 'admin'
    or author_id = auth.uid()
    or (score_id is not null and public.teacher_owns_score(score_id))
    or (grade_item_id is not null and public.teacher_owns_grade_item(grade_item_id))
    or (score_id is not null and public.student_owns_score(score_id))
    or (grade_item_id is not null and public.student_can_see_item(grade_item_id))
    or (score_id is not null and public.dept_head_owns_class(public.score_class_id(score_id)))
    or (grade_item_id is not null and public.dept_head_owns_class(public.grade_item_class_id(grade_item_id)))
    or (
      score_id is not null
      and exists (
        select 1 from public.scores sc
        where sc.id = score_id and public.is_parent_of(sc.student_id)
      )
    )
    or (grade_item_id is not null and public.parent_can_see_class(public.grade_item_class_id(grade_item_id)))
  );

-- -----------------------------------------------------------------------------
-- 7. grade_change_requests SELECT — same fix
-- -----------------------------------------------------------------------------
drop policy if exists grade_change_requests_select on public.grade_change_requests;
create policy grade_change_requests_select on public.grade_change_requests for select
  using (
    public.current_role() = 'admin'
    or requested_by = auth.uid()
    or public.dept_head_owns_class(public.score_class_id(score_id))
    or exists (
      select 1 from public.scores sc
      where sc.id = grade_change_requests.score_id
        and sc.student_id = public.current_student_id()
    )
  );
