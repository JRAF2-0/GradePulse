-- =============================================================================
-- GradePulse — Role helpers
-- =============================================================================
-- Admin promotes a pending user to student/teacher/admin.
-- Atomically updates users.role AND inserts the matching students/teachers row.
-- =============================================================================

create or replace function public.set_user_role(
  p_user_id uuid,
  p_role text,
  p_student_no text default null,
  p_course text default null,
  p_year_level int default null,
  p_section text default null,
  p_employee_no text default null,
  p_department text default null
)
returns void language plpgsql security definer as $$
declare
  v_actor_role text;
begin
  v_actor_role := public.current_role();
  if v_actor_role <> 'admin' then
    raise exception 'Only admins can set user roles';
  end if;

  if p_role not in ('pending', 'student', 'teacher', 'admin') then
    raise exception 'Invalid role: %', p_role;
  end if;

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
    insert into public.teachers (user_id, employee_no, department)
    values (p_user_id, p_employee_no, p_department)
    on conflict (user_id) do update set
      employee_no = excluded.employee_no,
      department = excluded.department;
    insert into public.notifications (user_id, message, type)
    values (p_user_id, 'Your account was approved as a Teacher.', 'role_assigned');
  end if;
end;
$$;

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
  department text
)
language sql security definer stable as $$
  select
    u.id, u.email, u.full_name, u.role, u.created_at,
    s.student_no, s.course, s.year_level, s.section,
    t.employee_no, t.department
  from public.users u
  left join public.students s on s.user_id = u.id
  left join public.teachers t on t.user_id = u.id
  where public.current_role() = 'admin'
  order by u.created_at desc;
$$;
