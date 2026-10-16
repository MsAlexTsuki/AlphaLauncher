-- AlphaClient public Rank Viewer: link multiple Minecraft UUIDs to one signed-in
-- Alpha profile. Ranks remain owned by public.profiles (rank_key/is_founder).
-- UUID links are display associations only, never identity proof or authorization.
-- Apply after 20261011000000_community_rank_catalog.sql.

begin;

create table if not exists public.alpha_minecraft_accounts (
  mc_uuid uuid primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  linked_at timestamptz not null default now()
);

create index if not exists alpha_minecraft_accounts_profile_id_idx
  on public.alpha_minecraft_accounts(profile_id);

alter table public.alpha_minecraft_accounts enable row level security;
revoke all on public.alpha_minecraft_accounts from public, anon, authenticated;
grant select on public.alpha_minecraft_accounts to service_role;

-- The caller can add UUIDs only to their own Alpha profile.
-- A UUID already associated with another profile cannot be claimed.
create or replace function public.link_minecraft_uuid(target_uuid uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_profile_id uuid;
  existing_profile_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  if target_uuid is null then
    raise exception 'Minecraft UUID is required.' using errcode = '22023';
  end if;

  select p.id into current_profile_id
  from public.profiles p
  where p.id = auth.uid();

  if current_profile_id is null then
    raise exception 'Alpha community profile not found.' using errcode = 'P0002';
  end if;

  -- Serialize concurrent attempts for this UUID, including first-time links.
  perform pg_advisory_xact_lock(hashtextextended(target_uuid::text, 0));

  select a.profile_id into existing_profile_id
  from public.alpha_minecraft_accounts a
  where a.mc_uuid = target_uuid;

  if existing_profile_id is not null and existing_profile_id <> current_profile_id then
    raise exception 'This Minecraft UUID is already linked to another Alpha account.'
      using errcode = '23505';
  end if;

  insert into public.alpha_minecraft_accounts (mc_uuid, profile_id)
  values (target_uuid, current_profile_id)
  on conflict (mc_uuid) do nothing;

  return jsonb_build_object('minecraft_uuid', target_uuid);
end;
$$;

revoke all on function public.link_minecraft_uuid(uuid) from public, anon;
grant execute on function public.link_minecraft_uuid(uuid) to authenticated;

-- Preserve the RankCache.java response shape (mc_uuid, rank).
-- Return only linked UUIDs; rank and Founder status come from the Alpha profile.
create or replace function public.get_public_ranks(uuids uuid[])
returns table (mc_uuid uuid, rank text)
language sql
stable
security definer
set search_path = ''
as $$
  select requested.mc_uuid,
         case
           when coalesce(p.is_founder, false) or p.rank_key = 'founder' then 'founder'
           else coalesce(nullif(p.rank_key, ''), 'member')
         end as rank
  from unnest(coalesce(uuids[1:100], array[]::uuid[])) as requested(mc_uuid)
  join public.alpha_minecraft_accounts a on a.mc_uuid = requested.mc_uuid
  join public.profiles p on p.id = a.profile_id;
$$;

revoke all on function public.get_public_ranks(uuid[]) from public;
grant execute on function public.get_public_ranks(uuid[]) to anon, authenticated;

commit;
