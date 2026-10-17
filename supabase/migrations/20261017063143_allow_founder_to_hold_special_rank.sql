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
  if target_rank = 'founder' and not ('founder' = any(requested_rank_keys)) then
    raise exception 'The Founder rank cannot be removed from the Founder account.' using errcode = '42501';
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
grant execute on function public.assign_community_ranks(uuid, text[]) to authenticated;
