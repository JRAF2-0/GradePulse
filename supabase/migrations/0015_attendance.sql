-- =============================================================================
-- GradePulse V2 — Attendance tracking
-- =============================================================================
-- Teachers record per-day attendance for each enrolled student. Students see
-- their own attendance summary on the class detail page. Used later by the
-- B.4 risk-prediction RPC to correlate attendance % with grades.
--
-- Status values:
--   * present   — student attended class
--   * absent    — student missed class
--   * late      — student was tardy
--   * excused   — absence is excused (does not count against attendance %)
--
-- A row is unique per (class, student, day); a second mark on the same day
-- updates the existing row.
-- =============================================================================

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  attended_at date not null,
  status text not null check (status in ('present', 'absent', 'late', 'excused')),
  remarks text,
  recorded_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_id, student_id, attended_at)
);

create index if not exists attendance_class_id_idx on public.attendance(class_id);
create index if not exists attendance_student_id_idx on public.attendance(student_id);
create index if not exists attendance_attended_at_idx on public.attendance(attended_at);

alter table public.attendance enable row level security;

-- updated_at trigger reuses V1 set_updated_at helper
drop trigger if exists attendance_updated_at on public.attendance;
create trigger attendance_updated_at
  before update on public.attendance
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS policies
-- -----------------------------------------------------------------------------
-- Read: teacher of the class, the student themself, admin, dept_head of the
-- department owning the class, and the parents of the student.
drop policy if exists attendance_select on public.attendance;
create policy attendance_select on public.attendance for select
  using (
    public.current_role() = 'admin'
    or public.is_class_teacher(class_id)
    or student_id = public.current_student_id()
    or public.dept_head_owns_class(class_id)
    or public.is_parent_of(student_id)
  );

-- Write: only the class's teacher or admin can mark / update / delete.
drop policy if exists attendance_teacher_write on public.attendance;
create policy attendance_teacher_write on public.attendance for all
  using (
    public.current_role() = 'admin'
    or public.is_class_teacher(class_id)
  )
  with check (
    public.current_role() = 'admin'
    or public.is_class_teacher(class_id)
  );

-- -----------------------------------------------------------------------------
-- Helper RPCs
-- -----------------------------------------------------------------------------
-- Summary of a student's attendance in a class (used on student class detail
-- + later by risk prediction). Returns counts by status.
create or replace function public.get_attendance_summary(
  p_class_id uuid,
  p_student_id uuid
)
returns table(
  total int,
  present int,
  absent int,
  late int,
  excused int,
  attendance_pct numeric
)
language sql security definer stable as $$
  with rows as (
    select status from public.attendance
    where class_id = p_class_id and student_id = p_student_id
  ),
  agg as (
    select
      count(*)::int as total,
      count(*) filter (where status = 'present')::int as present,
      count(*) filter (where status = 'absent')::int as absent,
      count(*) filter (where status = 'late')::int as late,
      count(*) filter (where status = 'excused')::int as excused
    from rows
  )
  select
    a.total,
    a.present,
    a.absent,
    a.late,
    a.excused,
    case
      when (a.total - a.excused) = 0 then 0
      else round((100.0 * (a.present + a.late) / nullif(a.total - a.excused, 0))::numeric, 2)
    end as attendance_pct
  from agg a;
$$;

alter publication supabase_realtime add table public.attendance;
