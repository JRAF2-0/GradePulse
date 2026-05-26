-- =============================================================================
-- GradePulse — Allow students to leave their own classes
-- =============================================================================
-- Previously, only admins (FOR ALL) and teachers of the class (FOR DELETE)
-- could remove enrollments. Students had no way to drop a class they joined
-- by mistake. Add a self-delete policy.
-- =============================================================================

drop policy if exists enrollments_student_leave on public.enrollments;
create policy enrollments_student_leave on public.enrollments for delete
  using (student_id = public.current_student_id());
