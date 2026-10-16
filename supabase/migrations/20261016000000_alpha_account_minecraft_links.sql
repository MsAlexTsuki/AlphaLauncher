-- Link one Alpha community profile to multiple Minecraft accounts.
-- Rank ownership remains on public.profiles.rank_key; Minecraft UUIDs are identities only.
-- Apply in Supabase SQL Editor after the community rank catalog migration.

begin;

create table if not exists public.alpha_minecraft_accounts (
  mc_uuid uuid primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  linked_at timestamptz not null default now()
);

create index if not exists alpha_minecraft_accounts_profile_id_idx
  on public.alpha_minecraft_accounts(profile_id);

alter table public.alpha_minecraft_accounts enable row level security;

-- Clients must use the guarded RPCs; never allow direct link edits.
revoke all on public.alpha_minecraft_accounts from anon, authenticated;
grant select on public.alpha_minecraft_accounts to service_role;

create or replace function public.link_minecraft_uuid(target_uuid uuid)
returns void
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
    raise exception 'No Alpha community profile exists for this account.' using errcode = 'P0002';
  end if;

  -- Serialize attempts for the same UUID, including the not-yet-linked case.
  perform pg_advisory_xact_lock(hashtextextended(target_uuid::text, 0));

  select a.profile_id into existing_profile_id
  from public.alpha_minecraft_accounts a
  where a.mc_uuid = target_uuid;

  if existing_profile_id is not null and existing_profile_id <> current_profile_id then
    raise exception 'This Minecraft account is already linked to another Alpha account.'
      using errcode = '42501';
  end if;

  insert into public.alpha_minecraft_accounts (mc_uuid, profile_id)
  values (target_uuid, current_profile_id)
  on conflict (mc_uuid) do nothing;
end;
$$;

revoke all on function public.link_minecraft_uuid(uuid) from public, anon;
grant execute on function public.link_minecraft_uuid(uuid) to authenticated;

-- Public display lookup only: UUID -> linked Alpha profile -> profile-owned rank.
-- The return shape stays compatible with RankCache.java. Unlinked UUIDs are omitted
-- so the client does not incorrectly display a Member badge for every unlinked player.
create or replace function public.get_public_ranks(uuids uuid[])
returns table (mc_uuid uuid, rank text)
language sql
stable
security definer
set search_path = ''
as $$
  select requested.mc_uuid,
         coalesce(p.rank_key, 'member') as rank
  from unnest(coalesce(uuids, array[]::uuid[])) as requested(mc_uuid)
  join public.alpha_minecraft_accounts a on a.mc_uuid = requested.mc_uuid
  join public.profiles p on p.id = a.profile_id;
$$;

revoke all on function public.get_public_ranks(uuid[]) from public, anon;
grant execute on function public.get_public_ranks(uuid[]) to anon, authenticated;

commit;
