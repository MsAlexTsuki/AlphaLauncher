begin;

create table if not exists public.profile_ranks (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  rank_key text not null references public.community_ranks(rank_key),
  assigned_at timestamptz not null default now(),
  assigned_by uuid references auth.users(id),
  primary key (profile_id, rank_key)
);

alter table public.profile_ranks enable row level security;
revoke all on public.profile_ranks from public, anon, authenticated;

insert into public.profile_ranks (profile_id, rank_key)
select p.id, p.rank_key
from public.profiles p
where p.rank_key is not null
on conflict (profile_id, rank_key) do nothing;

create or replace function public.get_profile_ranks(p_profile_ids uuid[])
returns table(profile_id uuid, rank_key text, rank_name text, sort_order smallint, badge_color text, badge_icon text)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  return query
  select pr.profile_id, cr.rank_key, cr.rank_name, cr.sort_order, cr.badge_color, cr.badge_icon
  from public.profile_ranks pr
  join public.community_ranks cr on cr.rank_key = pr.rank_key
  where pr.profile_id = any(coalesce(p_profile_ids, array[]::uuid[]))
  order by cr.sort_order;
end;
$function$;

create or replace function public.assign_community_ranks(target_profile_id uuid, requested_rank_keys text[])
returns table(profile_id uuid, rank_key text)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor_rank text;
  target_rank text;
  primary_rank text;
  requested_key text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  select p.rank_key into actor_rank from public.profiles p where p.id = auth.uid();
  if actor_rank is null or actor_rank not in ('founder', 'owner') then
    raise exception 'Only Founder and Owner can manage community ranks.' using errcode = '42501';
  end if;

  if requested_rank_keys is null or cardinality(requested_rank_keys) = 0 then
    raise exception 'At least one rank must remain assigned.' using errcode = '22023';
  end if;
  if cardinality(requested_rank_keys) <> (select count(distinct x) from unnest(requested_rank_keys) as x) then
    raise exception 'Duplicate ranks are not allowed.' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(requested_rank_keys) as requested(key)
    where not exists (select 1 from public.community_ranks cr where cr.rank_key = requested.key)
  ) then
    raise exception 'Unknown community rank.' using errcode = '22023';
  end if;

  select p.rank_key into target_rank from public.profiles p where p.id = target_profile_id for update;
  if not found then raise exception 'Community member not found.' using errcode = 'P0002'; end if;
  if target_rank = 'founder' then
    raise exception 'The Founder account is protected and cannot be changed through Rank Management.' using errcode = '42501';
  end if;
  if 'founder' = any(requested_rank_keys) and actor_rank <> 'founder' then
    raise exception 'Only the Founder can assign the Founder rank.' using errcode = '42501';
  end if;
  if target_rank = 'owner' and actor_rank <> 'founder' then
    raise exception 'Only the Founder can manage an Owner account.' using errcode = '42501';
  end if;

  primary_rank := requested_rank_keys[1];
  delete from public.profile_ranks pr where pr.profile_id = target_profile_id;
  foreach requested_key in array requested_rank_keys loop
    insert into public.profile_ranks(profile_id, rank_key, assigned_by)
    values (target_profile_id, requested_key, auth.uid());
  end loop;

  update public.profiles set rank_key = primary_rank, is_founder = (primary_rank = 'founder')
  where id = target_profile_id;

  return query select target_profile_id, primary_rank;
end;
$function$;

create or replace function public.assign_community_rank(target_profile_id uuid, requested_rank_key text)
returns table(profile_id uuid, rank_key text)
language sql
security definer
set search_path = ''
as $function$
  select * from public.assign_community_ranks(target_profile_id, array[requested_rank_key]);
$function$;

create or replace function public.has_rank_permission(p_scope text, p_permission_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce(
    auth.uid() is not null
    and exists (
      select 1
      from public.profiles p
      join public.profile_ranks pr on pr.profile_id = p.id
      join public.rank_permissions rp on rp.rank_key = pr.rank_key
      where p.id = auth.uid()
        and rp.scope = p_scope
        and rp.permission_key = p_permission_key
        and rp.enabled = true
    ),
    false
  );
$function$;

revoke all on function public.get_profile_ranks(uuid[]) from public, anon;
revoke all on function public.assign_community_ranks(uuid, text[]) from public, anon;
revoke all on function public.assign_community_rank(uuid, text) from public, anon;
revoke all on function public.has_rank_permission(text, text) from public, anon;
grant execute on function public.get_profile_ranks(uuid[]) to authenticated;
grant execute on function public.assign_community_ranks(uuid, text[]) to authenticated;
grant execute on function public.assign_community_rank(uuid, text) to authenticated;
grant execute on function public.has_rank_permission(text, text) to authenticated;

commit;
