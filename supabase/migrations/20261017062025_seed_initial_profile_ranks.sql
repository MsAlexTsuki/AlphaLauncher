begin;

create or replace function public.seed_profile_rank_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  insert into public.profile_ranks (profile_id, rank_key)
  values (new.id, coalesce(new.rank_key, 'member'))
  on conflict (profile_id, rank_key) do nothing;
  return new;
end;
$function$;

drop trigger if exists seed_profile_rank_assignment on public.profiles;
create trigger seed_profile_rank_assignment
after insert on public.profiles
for each row execute function public.seed_profile_rank_assignment();

revoke all on function public.seed_profile_rank_assignment() from public, anon, authenticated;

commit;
