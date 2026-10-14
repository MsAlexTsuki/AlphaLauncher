-- AlphaClient Community: profile bio, avatar storage and policies
-- Run in Supabase Dashboard -> SQL Editor after alpha_community_friends.sql.
-- This does not replace or modify the existing developer-auth RPC or changelogs.

begin;

alter table public.profiles
  add column if not exists bio text not null default '',
  add column if not exists avatar_url text;

alter table public.profiles
  drop constraint if exists profiles_bio_length;
alter table public.profiles
  add constraint profiles_bio_length check (char_length(bio) <= 160);

-- Profile owners can edit their own display name, bio and avatar URL.
-- Keep username controlled by the existing profile setup flow and uniqueness constraint.
grant update (display_name, bio, avatar_url) on public.profiles to authenticated;

-- Public bucket means avatar URLs can be displayed in the Friends list and launcher.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-avatars',
  'profile-avatars',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Each account can manage only objects inside its own UUID folder.
drop policy if exists "Public can view Alpha profile avatars" on storage.objects;
create policy "Public can view Alpha profile avatars"
  on storage.objects for select
  using (bucket_id = 'profile-avatars');

drop policy if exists "Users can upload their own Alpha profile avatar" on storage.objects;
create policy "Users can upload their own Alpha profile avatar"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'profile-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users can update their own Alpha profile avatar" on storage.objects;
create policy "Users can update their own Alpha profile avatar"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'profile-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'profile-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users can delete their own Alpha profile avatar" on storage.objects;
create policy "Users can delete their own Alpha profile avatar"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'profile-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

commit;
