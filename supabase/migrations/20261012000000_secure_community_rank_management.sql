-- Secure Founder/Owner rank management for Alpha Community.
-- Run after 20261011000000_community_rank_catalog.sql.

begin;

create or replace function public.assign_community_rank(
  target_profile_id uuid,
  requested_rank_key text
)
returns table (profile_id uuid, rank_key text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_rank text;
  target_rank text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  select p.rank_key into actor_rank
  from public.profiles p
  where p.id = auth.uid();

  if actor_rank not in ('founder', 'owner') then
    raise exception 'Only Founder and Owner can manage community ranks.'
      using errcode = '42501';
  end if;

  if requested_rank_key not in (
    'founder', 'owner', 'management', 'senior_admin', 'admin',
    'senior_moderator', 'moderator', 'trial_moderator',
    'beta', 'alpha_plus', 'alpha', 'member'
  ) then
    raise exception 'Unknown community rank.' using errcode = '22023';
  end if;

  select p.rank_key into target_rank
  from public.profiles p
  where p.id = target_profile_id
  for update;

  if not found then
    raise exception 'Community member not found.' using errcode = 'P0002';
  end if;

  -- Founder identity is immutable through this management menu.
  if target_rank = 'founder' and actor_rank <> 'founder' then
    raise exception 'Only the Founder can manage the Founder account.'
      using errcode = '42501';
  end if;

  if requested_rank_key = 'founder' and actor_rank <> 'founder' then
    raise exception 'Only the Founder can assign the Founder rank.'
      using errcode = '42501';
  end if;

  -- Do not let an Owner change another Owner's rank.
  if target_rank = 'owner' and actor_rank <> 'founder' then
    raise exception 'Only the Founder can manage an Owner account.'
      using errcode = '42501';
  end if;

  update public.profiles
  set rank_key = requested_rank_key,
      is_founder = (requested_rank_key = 'founder')
  where id = target_profile_id;

  return query select target_profile_id, requested_rank_key;
end;
$$;

revoke all on function public.assign_community_rank(uuid, text) from public, anon;
grant execute on function public.assign_community_rank(uuid, text) to authenticated;

-- Permit the protected SECURITY DEFINER function to update ranks while continuing
-- to block direct authenticated profile rank updates.
create or replace function public.prevent_profile_rank_self_assignment()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.rank_key is distinct from old.rank_key
     and coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     and current_user not in ('postgres', 'service_role') then
    raise exception 'Profile ranks can only be changed by authorized administrators.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.prevent_profile_rank_self_assignment() from public, anon, authenticated;

commit;
