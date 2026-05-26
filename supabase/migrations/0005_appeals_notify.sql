-- =============================================================================
-- GradePulse — Appeals notification trigger
-- =============================================================================
-- When a teacher updates an appeal's status from 'pending' to 'approved' or
-- 'rejected', notify the student.
-- =============================================================================

create or replace function public.notify_appeal_resolved()
returns trigger language plpgsql security definer as $$
declare
  v_student_user_id uuid;
  v_class_id uuid;
  v_item_title text;
begin
  if new.status = old.status then
    return new;
  end if;
  if new.status not in ('approved', 'rejected') then
    return new;
  end if;

  select s.user_id into v_student_user_id
    from public.students s where s.id = new.student_id;

  select gc.class_id, gi.title
    into v_class_id, v_item_title
    from public.scores sc
    join public.grade_items gi on gi.id = sc.grade_item_id
    join public.grade_categories gc on gc.id = gi.category_id
    where sc.id = new.score_id;

  if v_student_user_id is not null then
    insert into public.notifications (user_id, message, type, related_class_id)
    values (
      v_student_user_id,
      'Your appeal on ' || coalesce(v_item_title, 'a grade') || ' was ' || new.status || '.',
      case when new.status = 'approved' then 'appeal_approved' else 'appeal_rejected' end,
      v_class_id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists appeals_notify_resolved on public.appeals;
create trigger appeals_notify_resolved
  after update on public.appeals
  for each row execute function public.notify_appeal_resolved();

create or replace function public.set_appeal_resolved_at()
returns trigger language plpgsql as $$
begin
  if new.status <> old.status and new.status in ('approved', 'rejected') then
    new.resolved_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists appeals_set_resolved_at on public.appeals;
create trigger appeals_set_resolved_at
  before update on public.appeals
  for each row execute function public.set_appeal_resolved_at();

alter publication supabase_realtime add table public.appeals;
