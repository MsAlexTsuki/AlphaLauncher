-- Search community members for the Rank Management screen without exposing profiles broadly.
begin;

create or replace function public.search_rank_management_profiles(search_term text default '')
returns table (
  id uuid,
  username text,
  display_name text,
  rank_key text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_rank text;
  normalized_term text := lower(trim(coalesce(search_term, '')));
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  select p.rank_key into actor_rank
  from public.profiles p
  where p.id = auth.uid();

  if actor_rank is null or actor_rank not in ('founder', 'owner') then
    raise exception 'Only Founder and Owner can search community ranks.'
      using errcode = '42501';
  end if;

  return query
  select p.id, p.username, p.display_name, coalesce(p.rank_key, 'member')
  from public.profiles p
  where normalized_term = ''
     or lower(coalesce(p.username, '')) like '%' || normalized_term || '%'
     or lower(coalesce(p.display_name, '')) like '%' || normalized_term || '%'
  order by lower(coalesce(p.username, ''))
  limit 100;
end;
$$;

revoke all on function public.search_rank_management_profiles(text) from public, anon;
grant execute on function public.search_rank_management_profiles(text) to authenticated;

commit;
