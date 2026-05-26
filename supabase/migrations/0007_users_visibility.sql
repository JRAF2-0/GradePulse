-- =============================================================================
-- GradePulse — Allow users to see other users in shared classes
-- =============================================================================
-- The original users SELECT policy only allowed self + admin. That blocks:
--   - Students from reading their teachers' names (on /student/classes)
--   - Teachers from reading their students' names (on roster page)
-- which broke the embedded queries (`teacher:teachers(user:users(full_name))`)
-- and caused "cannot read full_name of null" crashes after a successful join.
--
-- Fix: expand the policy via a SECURITY DEFINER helper that checks if the
-- caller shares a class with the target user (either direction). Bypass RLS
-- in the helper to avoid recursion.
-- =============================================================================

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
    );
$$;

drop policy if exists users_select_self_or_admin on public.users;
drop policy if exists users_select on public.users;
create policy users_select on public.users for select
  using (public.can_see_user(id));
