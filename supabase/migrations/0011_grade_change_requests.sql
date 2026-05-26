-- =============================================================================
-- GradePulse V2 — Grade change requests (post-finalize approval workflow)
-- =============================================================================
-- After a period is finalized, V1 blocks ALL score edits via the
-- `prevent_score_edit_after_lock` trigger. V2 introduces an approval path:
--
--   1. Teacher calls `request_grade_change(score_id, new_score, reason)`
--      → row inserted into grade_change_requests with status='pending'
--   2. Department Head reviews via `review_grade_change(request_id, decision,
--      review_note)`. On 'approve', the RPC sets a session-local flag, updates
--      the score (the lock trigger allows it because the flag is set), writes
--      an audit log, and notifies the student.
--   3. On 'reject', the score is untouched; review_note is stored.
--
-- The session-local flag (`gradepulse.allow_locked_score_edit`) is the
-- mechanism used to bypass the lock trigger ONLY from inside this RPC. It
-- cannot be set by client code because all writes go through PostgREST which
-- starts a fresh session per request.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. grade_change_requests table
-- -----------------------------------------------------------------------------
create table if not exists public.grade_change_requests (
  id uuid primary key default gen_random_uuid(),
  score_id uuid not null references public.scores(id) on delete cascade,
  requested_by uuid not null references public.users(id) on delete restrict,
  old_score numeric(8,2),
  new_score numeric(8,2),
  reason text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.users(id) on delete set null,
  review_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists grade_change_requests_score_id_idx on public.grade_change_requests(score_id);
create index if not exists grade_change_requests_status_idx on public.grade_change_requests(status);
create index if not exists grade_change_requests_requested_by_idx on public.grade_change_requests(requested_by);

alter table public.grade_change_requests enable row level security;

-- -----------------------------------------------------------------------------
-- 2. Update the score-lock trigger to honor an approval bypass flag
-- -----------------------------------------------------------------------------
create or replace function public.prevent_score_edit_after_lock()
returns trigger language plpgsql security definer as $$
declare
  v_class_id uuid;
  v_period text;
  v_locked boolean;
  v_bypass text;
begin
  -- Approval RPC sets this session flag to bypass the lock for one statement.
  begin
    v_bypass := current_setting('gradepulse.allow_locked_score_edit', true);
  exception when others then
    v_bypass := null;
  end;

  if v_bypass = 'on' then
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
-- 3. RPC: request_grade_change
-- -----------------------------------------------------------------------------
-- Teacher submits a grade change for review. Only allowed if the score's
-- period is currently locked (otherwise the teacher can edit the score
-- directly with no approval needed).
create or replace function public.request_grade_change(
  p_score_id uuid,
  p_new_score numeric,
  p_reason text
) returns uuid language plpgsql security definer as $$
declare
  v_teacher_id uuid;
  v_class_id uuid;
  v_period text;
  v_student_id uuid;
  v_old_score numeric;
  v_max_score numeric;
  v_locked boolean;
  v_request_id uuid;
begin
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'A reason is required for a grade change request';
  end if;
  if p_new_score is null or p_new_score < 0 then
    raise exception 'New score must be a non-negative number';
  end if;

  v_teacher_id := public.current_teacher_id();
  if v_teacher_id is null then
    raise exception 'Only teachers can request grade changes';
  end if;

  -- Resolve the score's class + period + ownership + current value.
  select sc.score, sc.student_id, gi.max_score, gc.class_id, gc.period
    into v_old_score, v_student_id, v_max_score, v_class_id, v_period
    from public.scores sc
    join public.grade_items gi on gi.id = sc.grade_item_id
    join public.grade_categories gc on gc.id = gi.category_id
    where sc.id = p_score_id;

  if v_class_id is null then
    raise exception 'Score not found';
  end if;

  if p_new_score > v_max_score then
    raise exception 'New score (%) exceeds max score (%) for this item', p_new_score, v_max_score;
  end if;

  -- Verify the caller teaches this class.
  if not exists (
    select 1 from public.classes c
    where c.id = v_class_id and c.teacher_id = v_teacher_id
  ) then
    raise exception 'You do not teach this class';
  end if;

  -- Only meaningful when the period is locked — otherwise edit directly.
  select exists(
    select 1 from public.finalized_grades
    where class_id = v_class_id and student_id = v_student_id and period = v_period
  ) into v_locked;
  if not v_locked then
    raise exception 'This period is not finalized — edit the score directly instead of filing a change request';
  end if;

  -- One pending request per score at a time.
  if exists (
    select 1 from public.grade_change_requests
    where score_id = p_score_id and status = 'pending'
  ) then
    raise exception 'A pending grade change request already exists for this score';
  end if;

  insert into public.grade_change_requests
    (score_id, requested_by, old_score, new_score, reason)
  values
    (p_score_id, auth.uid(), v_old_score, p_new_score, p_reason)
  returning id into v_request_id;

  return v_request_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. RPC: review_grade_change
-- -----------------------------------------------------------------------------
-- Department Head approves or rejects a pending request. On approve, the
-- score is updated, an audit_log row is written, and the student is notified.
create or replace function public.review_grade_change(
  p_request_id uuid,
  p_decision text,
  p_review_note text default null
) returns void language plpgsql security definer as $$
declare
  v_dept_id uuid;
  v_role text;
  v_request public.grade_change_requests%rowtype;
  v_class_id uuid;
  v_student_user_id uuid;
  v_item_title text;
begin
  if p_decision not in ('approve', 'reject') then
    raise exception 'Decision must be ''approve'' or ''reject''';
  end if;

  v_role := public.current_role();
  v_dept_id := public.current_department_head_dept_id();
  if v_role <> 'admin' and v_dept_id is null then
    raise exception 'Only a department head or admin can review grade change requests';
  end if;

  select * into v_request
    from public.grade_change_requests
    where id = p_request_id
    for update;

  if v_request.id is null then
    raise exception 'Request not found';
  end if;
  if v_request.status <> 'pending' then
    raise exception 'Request has already been %', v_request.status;
  end if;

  -- Resolve class + student user for notification + scope check
  select gc.class_id, gi.title, st.user_id
    into v_class_id, v_item_title, v_student_user_id
    from public.scores sc
    join public.grade_items gi on gi.id = sc.grade_item_id
    join public.grade_categories gc on gc.id = gi.category_id
    join public.students st on st.id = sc.student_id
    where sc.id = v_request.score_id;

  -- Dept_head can only review requests for classes in their department.
  if v_role <> 'admin' then
    if not public.dept_head_owns_class(v_class_id) then
      raise exception 'You do not have authority over this class';
    end if;
  end if;

  if p_decision = 'approve' then
    -- Bypass the lock trigger just for the next UPDATE statement.
    perform set_config('gradepulse.allow_locked_score_edit', 'on', true);
    update public.scores set score = v_request.new_score
      where id = v_request.score_id;
    perform set_config('gradepulse.allow_locked_score_edit', 'off', true);

    update public.grade_change_requests
      set status = 'approved',
          reviewed_by = auth.uid(),
          review_note = p_review_note,
          reviewed_at = now()
      where id = p_request_id;

    -- Audit log of the approval
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, old_value, new_value)
    values (
      auth.uid(),
      'grade_change_approved',
      'score',
      v_request.score_id,
      jsonb_build_object('score', v_request.old_score),
      jsonb_build_object(
        'score', v_request.new_score,
        'request_id', v_request.id,
        'reason', v_request.reason,
        'review_note', p_review_note
      )
    );

    if v_student_user_id is not null then
      insert into public.notifications (user_id, message, type, related_class_id)
      values (
        v_student_user_id,
        'A grade change on ' || coalesce(v_item_title, 'a graded item') || ' was approved.',
        'grade_change_approved',
        v_class_id
      );
    end if;
  else
    update public.grade_change_requests
      set status = 'rejected',
          reviewed_by = auth.uid(),
          review_note = p_review_note,
          reviewed_at = now()
      where id = p_request_id;

    insert into public.audit_logs (actor_id, action, entity_type, entity_id, old_value, new_value)
    values (
      auth.uid(),
      'grade_change_rejected',
      'grade_change_request',
      v_request.id,
      jsonb_build_object('score', v_request.old_score, 'requested_score', v_request.new_score),
      jsonb_build_object('review_note', p_review_note, 'reason', v_request.reason)
    );

    if v_student_user_id is not null then
      insert into public.notifications (user_id, message, type, related_class_id)
      values (
        v_student_user_id,
        'A grade change on ' || coalesce(v_item_title, 'a graded item') || ' was reviewed and not applied.',
        'grade_change_rejected',
        v_class_id
      );
    end if;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. RLS for grade_change_requests
-- -----------------------------------------------------------------------------
-- Teachers see requests they filed; department heads see pending + decided
-- requests for classes in their department; admins see everything.
-- Students see requests touching their own scores (so they can see the
-- pending banner in their grade view if we surface it later).
drop policy if exists grade_change_requests_select on public.grade_change_requests;
create policy grade_change_requests_select on public.grade_change_requests for select
  using (
    public.current_role() = 'admin'
    or requested_by = auth.uid()
    or exists (
      select 1
      from public.scores sc
      join public.grade_items gi on gi.id = sc.grade_item_id
      join public.grade_categories gc on gc.id = gi.category_id
      where sc.id = grade_change_requests.score_id
        and public.dept_head_owns_class(gc.class_id)
    )
    or exists (
      select 1 from public.scores sc
      where sc.id = grade_change_requests.score_id
        and sc.student_id = public.current_student_id()
    )
  );

-- Writes (insert/update) only happen via the RPCs above, which are
-- SECURITY DEFINER and bypass RLS. We still need a permissive policy so the
-- session can technically write — but in practice no client-side write path
-- exists. Lock it down to admin to be safe.
drop policy if exists grade_change_requests_admin_write on public.grade_change_requests;
create policy grade_change_requests_admin_write on public.grade_change_requests for all
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- -----------------------------------------------------------------------------
-- 6. Realtime
-- -----------------------------------------------------------------------------
-- Surface new pending requests to dept_head dashboards in real time.
alter publication supabase_realtime add table public.grade_change_requests;
