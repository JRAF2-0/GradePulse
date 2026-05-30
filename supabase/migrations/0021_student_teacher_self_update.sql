-- 0021_student_teacher_self_update.sql
-- ---------------------------------------------------------------
-- Allows a user to update their own students/teachers row so they
-- can fill role-specific profile fields (student_no, course, year,
-- section / employee_no, department) on first dashboard visit after
-- admin assigns their role. The grade tables are NOT affected —
-- this only opens the user's own identity row.
-- ---------------------------------------------------------------

drop policy if exists students_self_update on public.students;
create policy students_self_update on public.students for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists teachers_self_update on public.teachers;
create policy teachers_self_update on public.teachers for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
