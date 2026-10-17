begin;

update public.community_ranks set sort_order = sort_order + 100;
update public.community_ranks
set sort_order = case rank_key
  when 'founder' then 1
  when 'owner' then 2
  when 'management' then 3
  when 'senior_admin' then 4
  when 'admin' then 5
  when 'senior_moderator' then 6
  when 'moderator' then 7
  when 'trial_moderator' then 8
  when 'the_nibbler' then 9
  when 'beta' then 10
  when 'alpha_plus' then 11
  when 'alpha' then 12
  when 'member' then 13
  else sort_order
end;

create or replace function public.enforce_the_nibbler_assignment_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor_rank text;
  assigned_count integer;
begin
  if new.rank_key <> 'the_nibbler' then return new; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('alpha_the_nibbler_assignment_limit'));
  select p.rank_key into actor_rank from public.profiles p where p.id = auth.uid();
  if auth.uid() is not null and actor_rank is distinct from 'founder' then
    raise exception 'Only the Founder can assign The Nibbler.' using errcode = '42501';
  end if;
  select count(distinct pr.profile_id)::integer into assigned_count
  from public.profile_ranks pr
  where pr.rank_key = 'the_nibbler' and pr.profile_id <> new.profile_id;
  if assigned_count >= 2 then
    raise exception 'The Nibbler is limited to two accounts.' using errcode = '23514';
  end if;
  return new;
end;
$function$;

drop trigger if exists enforce_the_nibbler_assignment_limit on public.profile_ranks;
create trigger enforce_the_nibbler_assignment_limit
before insert or update of rank_key, profile_id on public.profile_ranks
for each row execute function public.enforce_the_nibbler_assignment_limit();

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
  if auth.uid() is null then raise exception 'Authentication required.' using errcode = '42501'; end if;
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
  ) then raise exception 'Unknown community rank.' using errcode = '22023'; end if;
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
  if 'the_nibbler' = any(requested_rank_keys) and actor_rank <> 'founder' then
    raise exception 'Only the Founder can assign The Nibbler.' using errcode = '42501';
  end if;
  select cr.rank_key into primary_rank
  from public.community_ranks cr
  where cr.rank_key = any(requested_rank_keys)
  order by cr.sort_order asc limit 1;
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

revoke all on function public.enforce_the_nibbler_assignment_limit() from public, anon, authenticated;
grant execute on function public.assign_community_ranks(uuid, text[]) to authenticated;

commit;
