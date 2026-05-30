-- 0022_user_profile_v2.sql
-- ---------------------------------------------------------------
-- Production-level profile expansion. Adds avatar, civil status,
-- nationality, emergency contact, structured address fields, and
-- an updated_at timestamp + auto-update trigger.
--
-- All columns are nullable so existing rows are unaffected. The
-- legacy text `address` column (added in 0020) is kept for
-- backwards-compatibility; the structured columns take precedence
-- in the UI going forward.
--
-- Also creates the `avatars` Supabase Storage bucket (public read,
-- per-user write) so users can upload a profile photo.
-- ---------------------------------------------------------------

-- New profile columns
alter table public.users
  add column if not exists avatar_url text,
  add column if not exists civil_status text,
  add column if not exists nationality text,
  add column if not exists emergency_contact_name text,
  add column if not exists emergency_contact_phone text,
  add column if not exists emergency_contact_relation text,
  add column if not exists address_street text,
  add column if not exists address_city text,
  add column if not exists address_province text,
  add column if not exists address_postal_code text,
  add column if not exists address_country text,
  add column if not exists updated_at timestamptz;

-- Constrain civil_status to a small known set (nullable so users can skip).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'users_civil_status_check'
  ) then
    alter table public.users
      add constraint users_civil_status_check
      check (
        civil_status is null
        or civil_status in ('single', 'married', 'widowed', 'separated', 'divorced')
      );
  end if;
end $$;

-- Auto-stamp updated_at on every row update.
create or replace function public.touch_users_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists users_touch_updated_at on public.users;
create trigger users_touch_updated_at
  before update on public.users
  for each row execute function public.touch_users_updated_at();

-- ---------------------------------------------------------------
-- Avatars storage bucket + RLS
-- ---------------------------------------------------------------
-- Public read so the avatar URL works in <img src> without signing.
-- Per-user write: a user can only upload/update/delete files in a
-- folder whose first path segment matches their auth.uid().
--   e.g.  avatars/<user_id>/profile.jpg
-- ---------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read" on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "avatars_own_insert" on storage.objects;
create policy "avatars_own_insert" on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_own_update" on storage.objects;
create policy "avatars_own_update" on storage.objects for update
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_own_delete" on storage.objects;
create policy "avatars_own_delete" on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
