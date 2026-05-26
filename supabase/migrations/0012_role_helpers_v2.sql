-- =============================================================================
-- GradePulse V2 — Role helpers updated for department_head + parent
-- =============================================================================
-- Extends set_user_role and get_user_directory to know about the two new V2
-- roles introduced in 0009. set_user_role now accepts a department_id and:
--   * for 'teacher': stores it on teachers.department_id
--   * for 'department_head': stores it on teachers.department_id AND sets the
--     departments.head_id (one head per department; reassignment clears the
--     previous head if any)
--   * for 'parent': just flips the role (parent_students links are managed
--     separately via admin/ParentLinks)
-- =============================================================================

drop function if exists public.set_user_role(uuid, text, text, text, int, text, text, text);

create or replace function public.set_user_role(
  p_user_id uuid,
  p_role text,
  p_student_no text default null,
  p_course text default null,
  p_year_level int default null,
  p_section text default null,
  p_employee_no text default null,
  p_department text default null,
  p_department_id uuid default null
)
returns void language plpgsql security definer as $$
declare
  v_actor_role text;
begin
  v_actor_role := public.current_role();
  if v_actor_role <> 'admin' then
    raise exception 'Only admins can set user roles';
  end if;

  if p_role not in ('pending', 'student', 'teacher', 'admin', 'department_head', 'parent') then
    raise exception 'Invalid role: %', p_role;
  end if;

  -- Clear any previous department_head linkage on this user when changing role.
  update public.departments set head_id = null where head_id = p_user_id;

  update public.users set role = p_role where id = p_user_id;

  if p_role = 'student' then
    insert into public.students (user_id, student_no, course, year_level, section)
    values (p_user_id, p_student_no, p_course, p_year_level, p_section)
    on conflict (user_id) do update set
      student_no = excluded.student_no,
      course = excluded.course,
      year_level = excluded.year_level,
      section = excluded.section;
    insert into public.notifications (user_id, message, type)
    values (p_user_id, 'Your account was approved as a Student.', 'role_assigned');

  elsif p_role = 'teacher' then
    insert into public.teachers (user_id, employee_no, department, department_id)
    values (p_user_id, p_employee_no, p_department, p_department_id)
    on conflict (user_id) do update set
      employee_no = excluded.employee_no,
      department = excluded.department,
      department_id = excluded.department_id;
    insert into public.notifications (user_id, message, type)
    values (p_user_id, 'Your account was approved as a Teacher.', 'role_assigned');

  elsif p_role = 'department_head' then
    if p_department_id is null then
      raise exception 'A department must be selected for a Department Head';
    end if;
    -- Keep a teacher row so the user can also teach classes if needed; not
    -- strictly required but keeps the data shape consistent. Idempotent.
    insert into public.teachers (user_id, employee_no, department, department_id)
    values (p_user_id, p_employee_no, p_department, p_department_id)
    on conflict (user_id) do update set
      employee_no = coalesce(excluded.employee_no, public.teachers.employee_no),
      department = coalesce(excluded.department, public.teachers.department),
      department_id = excluded.department_id;
    update public.departments set head_id = p_user_id where id = p_department_id;
    insert into public.notifications (user_id, message, type)
    values (p_user_id, 'Your account was approved as a Department Head.', 'role_assigned');

  elsif p_role = 'parent' then
    insert into public.notifications (user_id, message, type)
    values (p_user_id, 'Your account was approved as a Parent.', 'role_assigned');
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- get_user_directory — surface department info for the admin table
-- -----------------------------------------------------------------------------
drop function if exists public.get_user_directory();

create or replace function public.get_user_directory()
returns table (
  id uuid,
  email text,
  full_name text,
  role text,
  created_at timestamptz,
  student_no text,
  course text,
  year_level int,
  section text,
  employee_no text,
  department text,
  department_id uuid,
  department_code text,
  department_name text,
  is_department_head boolean
)
language sql security definer stable as $$
  select
    u.id, u.email, u.full_name, u.role, u.created_at,
    s.student_no, s.course, s.year_level, s.section,
    t.employee_no, t.department,
    t.department_id,
    d.code as department_code,
    d.name as department_name,
    exists (select 1 from public.departments dh where dh.head_id = u.id) as is_department_head
  from public.users u
  left join public.students s on s.user_id = u.id
  left join public.teachers t on t.user_id = u.id
  left join public.departments d on d.id = t.department_id
  where public.current_role() = 'admin'
  order by u.created_at desc;
$$;
