-- =============================================================================
-- GradePulse V2 — Teacher comments on individual scores
-- =============================================================================
-- Teachers leave free-text notes on a specific student's score (e.g., "Late
-- submission — 10% penalty applied", "Excellent reasoning on Q3"). Students
-- see these comments next to the corresponding score. A comment can target
-- either:
--   * a specific score (score_id IS NOT NULL)  — student-specific note
--   * a grade_item     (grade_item_id IS NOT NULL) — note visible to whole class
-- The CHECK constraint guarantees exactly one target.
--
-- Inserting a comment fires a notification to the student (if it targets a
-- score) or to all enrolled students (if it targets a grade item).
-- =============================================================================

create table if not exists public.score_comments (
  id uuid primary key default gen_random_uuid(),
  score_id uuid references public.scores(id) on delete cascade,
  grade_item_id uuid references public.grade_items(id) on delete cascade,
  author_id uuid not null references public.users(id) on delete cascade,
  body text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((score_id is not null and grade_item_id is null)
      or (score_id is null and grade_item_id is not null))
);

create index if not exists score_comments_score_id_idx on public.score_comments(score_id);
create index if not exists score_comments_grade_item_id_idx on public.score_comments(grade_item_id);
create index if not exists score_comments_author_id_idx on public.score_comments(author_id);

alter table public.score_comments enable row level security;

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------
-- True if the caller (teacher) owns the class that contains this score or item.
create or replace function public.teacher_owns_score(p_score_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1
    from public.scores sc
    join public.grade_items gi on gi.id = sc.grade_item_id
    join public.grade_categories gc on gc.id = gi.category_id
    join public.classes c on c.id = gc.class_id
    where sc.id = p_score_id and c.teacher_id = public.current_teacher_id()
  );
$$;

create or replace function public.teacher_owns_grade_item(p_item_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1
    from public.grade_items gi
    join public.grade_categories gc on gc.id = gi.category_id
    join public.classes c on c.id = gc.class_id
    where gi.id = p_item_id and c.teacher_id = public.current_teacher_id()
  );
$$;

-- True if the caller (student) is the subject of this score.
create or replace function public.student_owns_score(p_score_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.scores sc
    where sc.id = p_score_id and sc.student_id = public.current_student_id()
  );
$$;

-- True if the caller (student) is enrolled in a class that contains this grade item.
create or replace function public.student_can_see_item(p_item_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1
    from public.grade_items gi
    join public.grade_categories gc on gc.id = gi.category_id
    join public.enrollments e on e.class_id = gc.class_id
    join public.students s on s.id = e.student_id
    where gi.id = p_item_id and s.user_id = auth.uid()
  );
$$;

-- -----------------------------------------------------------------------------
-- RLS policies
-- -----------------------------------------------------------------------------
-- Visibility:
-- * Author always sees their own comments
-- * Admin sees everything
-- * Teacher sees comments in classes they own
-- * Student sees comments on THEIR scores, or item-level comments on items
--   visible to them
-- * Department head sees comments within classes in their dept
-- * Parent sees comments on their linked children's scores or items in their
--   children's classes
drop policy if exists score_comments_select on public.score_comments;
create policy score_comments_select on public.score_comments for select
  using (
    public.current_role() = 'admin'
    or author_id = auth.uid()
    or (score_id is not null and public.teacher_owns_score(score_id))
    or (grade_item_id is not null and public.teacher_owns_grade_item(grade_item_id))
    or (score_id is not null and public.student_owns_score(score_id))
    or (grade_item_id is not null and public.student_can_see_item(grade_item_id))
    or (
      score_id is not null
      and exists (
        select 1
        from public.scores sc
        join public.grade_items gi on gi.id = sc.grade_item_id
        join public.grade_categories gc on gc.id = gi.category_id
        where sc.id = score_id and public.dept_head_owns_class(gc.class_id)
      )
    )
    or (
      grade_item_id is not null
      and exists (
        select 1
        from public.grade_items gi
        join public.grade_categories gc on gc.id = gi.category_id
        where gi.id = grade_item_id and public.dept_head_owns_class(gc.class_id)
      )
    )
    or (
      score_id is not null
      and exists (
        select 1 from public.scores sc
        where sc.id = score_id and public.is_parent_of(sc.student_id)
      )
    )
    or (
      grade_item_id is not null
      and exists (
        select 1
        from public.grade_items gi
        join public.grade_categories gc on gc.id = gi.category_id
        where gi.id = grade_item_id and public.parent_can_see_class(gc.class_id)
      )
    )
  );

-- Insert / update / delete: only the owning teacher (or admin) can write a
-- comment. Authors can edit/delete their own.
drop policy if exists score_comments_teacher_write on public.score_comments;
create policy score_comments_teacher_write on public.score_comments for all
  using (
    public.current_role() = 'admin'
    or author_id = auth.uid()
    or (score_id is not null and public.teacher_owns_score(score_id))
    or (grade_item_id is not null and public.teacher_owns_grade_item(grade_item_id))
  )
  with check (
    public.current_role() = 'admin'
    or author_id = auth.uid()
    or (score_id is not null and public.teacher_owns_score(score_id))
    or (grade_item_id is not null and public.teacher_owns_grade_item(grade_item_id))
  );

-- -----------------------------------------------------------------------------
-- Triggers: keep updated_at fresh + notify the student
-- -----------------------------------------------------------------------------
drop trigger if exists score_comments_updated_at on public.score_comments;
create trigger score_comments_updated_at
  before update on public.score_comments
  for each row execute function public.set_updated_at();

create or replace function public.notify_score_comment()
returns trigger language plpgsql security definer as $$
declare
  v_user_id uuid;
  v_class_id uuid;
  v_item_title text;
begin
  if tg_op <> 'INSERT' then
    return new;
  end if;

  if new.score_id is not null then
    -- Score-specific comment → notify just that student.
    select st.user_id, gc.class_id, gi.title
      into v_user_id, v_class_id, v_item_title
      from public.scores sc
      join public.students st on st.id = sc.student_id
      join public.grade_items gi on gi.id = sc.grade_item_id
      join public.grade_categories gc on gc.id = gi.category_id
      where sc.id = new.score_id;

    if v_user_id is not null then
      insert into public.notifications (user_id, message, type, related_class_id)
      values (
        v_user_id,
        'New comment on ' || coalesce(v_item_title, 'a grade') || '.',
        'comment_added',
        v_class_id
      );
    end if;
  else
    -- Item-level comment → notify all enrolled students.
    select gc.class_id, gi.title
      into v_class_id, v_item_title
      from public.grade_items gi
      join public.grade_categories gc on gc.id = gi.category_id
      where gi.id = new.grade_item_id;

    insert into public.notifications (user_id, message, type, related_class_id)
    select st.user_id,
           'New comment on ' || coalesce(v_item_title, 'a grade item') || '.',
           'comment_added',
           v_class_id
      from public.enrollments e
      join public.students st on st.id = e.student_id
     where e.class_id = v_class_id;
  end if;

  return new;
end;
$$;

drop trigger if exists score_comments_notify on public.score_comments;
create trigger score_comments_notify
  after insert on public.score_comments
  for each row execute function public.notify_score_comment();

-- -----------------------------------------------------------------------------
-- Realtime
-- -----------------------------------------------------------------------------
alter publication supabase_realtime add table public.score_comments;
