-- 0020_user_personal_info.sql
-- ---------------------------------------------------------------
-- Adds role-agnostic personal info columns to public.users so they
-- can be collected once (right after signup, on the Pending page)
-- and reused across Profile, admin user detail, teacher class
-- rosters, and any other surface that benefits from contact info.
--
-- Role-specific data (student_no, course, year_level, section /
-- employee_no, department) continues to live on students/teachers
-- and is filled separately, after admin assigns a role.
-- ---------------------------------------------------------------

alter table public.users
  add column if not exists phone text,
  add column if not exists birthdate date,
  add column if not exists gender text,
  add column if not exists address text;

-- Constrain gender to a small known set (nullable so users can skip).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'users_gender_check'
  ) then
    alter table public.users
      add constraint users_gender_check
      check (gender is null or gender in ('male', 'female', 'other', 'prefer_not_to_say'));
  end if;
end $$;
