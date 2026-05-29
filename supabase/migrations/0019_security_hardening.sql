-- =============================================================================
-- GradePulse V2 — Security hardening (Phase C.3)
-- =============================================================================
-- Two concrete fixes from the security review:
--
-- 1. Lock-bypass defense-in-depth.
--    review_grade_change() sets the transaction-local GUC
--    `gradepulse.allow_locked_score_edit = 'on'` to let an approved score
--    write through the finalize lock. Custom GUCs can technically be set by
--    any role, so we add a second gate: the bypass is only honored when the
--    current actor is an admin or department head (the only roles that can
--    legitimately approve a post-finalize change). A teacher who somehow set
--    the flag still cannot edit a locked score.
--
-- 2. search_path pinning on every SECURITY DEFINER function.
--    SECURITY DEFINER functions without a fixed search_path are vulnerable to
--    search-path hijacking (an attacker creating a same-named object in an
--    earlier schema). We pin every SECURITY DEFINER function in `public` to
--    `search_path = public, pg_temp`. pg_catalog is always implicitly first,
--    and all our function bodies use schema-qualified refs (public.*, auth.*),
--    so this is safe and doesn't change behavior — only closes the hole.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Harden the lock-bypass trigger
-- -----------------------------------------------------------------------------
create or replace function public.prevent_score_edit_after_lock()
returns trigger language plpgsql security definer as $$
declare
  v_class_id uuid;
  v_period text;
  v_locked boolean;
  v_bypass text;
begin
  begin
    v_bypass := current_setting('gradepulse.allow_locked_score_edit', true);
  exception when others then
    v_bypass := null;
  end;

  -- Only honor the bypass for the roles that can legitimately approve a
  -- post-finalize grade change. Defense-in-depth on top of the RPC gate.
  if v_bypass = 'on' and public.current_role() in ('admin', 'department_head') then
    return new;
  end if;

  select gc.class_id, gc.period
    into v_class_id, v_period
    from public.grade_items gi
    join public.grade_categories gc on gc.id = gi.category_id
    where gi.id = coalesce(new.grade_item_id, old.grade_item_id);

  select exists(
    select 1 from public.finalized_grades
    where class_id = v_class_id
      and student_id = coalesce(new.student_id, old.student_id)
      and period = v_period
  ) into v_locked;

  if v_locked then
    raise exception 'Cannot modify score for a finalized period (% / class %)', v_period, v_class_id;
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. Pin search_path on every SECURITY DEFINER function in public
-- -----------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as func
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef = true            -- SECURITY DEFINER only
  loop
    execute format('alter function %s set search_path = public, pg_temp', r.func);
  end loop;
end$$;
