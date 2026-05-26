-- =============================================================================
-- GradePulse — Audit log enriched view
-- =============================================================================
-- Returns audit_logs joined with actor name + (for score targets) student name
-- and item title. Admin-only via current_role() check.
-- =============================================================================

create or replace function public.get_audit_logs(
  p_limit int default 100,
  p_offset int default 0,
  p_action text default null,
  p_target_type text default null
)
returns table (
  id uuid,
  created_at timestamptz,
  action text,
  target_type text,
  target_id uuid,
  old_value jsonb,
  new_value jsonb,
  actor_id uuid,
  actor_name text,
  actor_email text,
  student_name text,
  item_title text
) language plpgsql security definer stable as $$
begin
  if public.current_role() <> 'admin' then
    raise exception 'Admin access required';
  end if;

  return query
  select
    al.id,
    al.created_at,
    al.action,
    al.target_type,
    al.target_id,
    al.old_value,
    al.new_value,
    al.actor_id,
    actor.full_name as actor_name,
    actor.email as actor_email,
    (
      select u.full_name
      from public.students s
      join public.users u on u.id = s.user_id
      where s.id = nullif(coalesce(al.new_value->>'student_id', al.old_value->>'student_id'), '')::uuid
    ) as student_name,
    (
      select gi.title
      from public.grade_items gi
      where gi.id = nullif(coalesce(al.new_value->>'grade_item_id', al.old_value->>'grade_item_id'), '')::uuid
    ) as item_title
  from public.audit_logs al
  left join public.users actor on actor.id = al.actor_id
  where (p_action is null or al.action = p_action)
    and (p_target_type is null or al.target_type = p_target_type)
  order by al.created_at desc
  limit p_limit offset p_offset;
end;
$$;

create or replace function public.count_audit_logs(
  p_action text default null,
  p_target_type text default null
)
returns bigint language plpgsql security definer stable as $$
declare
  v_count bigint;
begin
  if public.current_role() <> 'admin' then
    raise exception 'Admin access required';
  end if;

  select count(*) into v_count
  from public.audit_logs al
  where (p_action is null or al.action = p_action)
    and (p_target_type is null or al.target_type = p_target_type);

  return v_count;
end;
$$;
