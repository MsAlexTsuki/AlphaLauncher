-- Audit successful community rank changes.
-- Preserves the existing rank-management authorization and protection rules.

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
  actor_name text;
  target_name text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  select p.rank_key,
         coalesce(nullif(p.display_name, ''), p.username)
    into actor_rank, actor_name
  from public.profiles p
  where p.id = auth.uid();

  if actor_rank is null or actor_rank not in ('founder', 'owner') then
    raise exception 'Only Founder and Owner can manage community ranks.'
      using errcode = '42501';
  end if;

  if requested_rank_key not in (
    'owner', 'management', 'senior_admin', 'admin',
    'senior_moderator', 'moderator', 'trial_moderator',
    'beta', 'alpha_plus', 'alpha', 'member'
  ) then
    raise exception 'Founder cannot be assigned through Rank Management. Choose another rank.'
      using errcode = '42501';
  end if;

  if target_profile_id = auth.uid() then
    raise exception 'You cannot change your own rank.'
      using errcode = '42501';
  end if;

  select p.rank_key,
         coalesce(nullif(p.display_name, ''), p.username)
    into target_rank, target_name
  from public.profiles p
  where p.id = target_profile_id
  for update;

  if not found then
    raise exception 'Community member not found.' using errcode = 'P0002';
  end if;

  if actor_rank = 'owner' and target_rank in ('founder', 'owner') then
    raise exception 'Owners cannot manage Founder or Owner accounts.'
      using errcode = '42501';
  end if;

  update public.profiles
  set rank_key = requested_rank_key,
      is_founder = false
  where id = target_profile_id;

  insert into public.audit_logs (
    actor_id, actor_label, product, category, action,
    target_user_id, target_label, outcome, details
  ) values (
    auth.uid(), actor_name, 'system', 'ranks', 'rank_changed',
    target_profile_id, target_name, 'success',
    jsonb_build_object('old_rank', target_rank, 'new_rank', requested_rank_key)
  );

  return query select target_profile_id, requested_rank_key;
end;
$$;

revoke all on function public.assign_community_rank(uuid, text) from public, anon;
grant execute on function public.assign_community_rank(uuid, text) to authenticated;

commit;
