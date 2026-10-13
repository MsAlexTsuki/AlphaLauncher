-- AlphaClient public profile Last played activity
-- Run this once in Supabase Dashboard > SQL Editor.
create table if not exists public.profile_activity (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_played_at timestamptz,
  last_played_version text
);

alter table public.profile_activity enable row level security;

drop policy if exists "Users can read profile activity" on public.profile_activity;
create policy "Users can read profile activity"
  on public.profile_activity
  for select
  to authenticated
  using (true);

drop policy if exists "Users can insert own profile activity" on public.profile_activity;
create policy "Users can insert own profile activity"
  on public.profile_activity
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own profile activity" on public.profile_activity;
create policy "Users can update own profile activity"
  on public.profile_activity
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update on public.profile_activity to authenticated;
