begin;

-- Normalize the public rank order to Alpha's canonical hierarchy.
-- Lower sort_order means a higher displayed rank.
update public.community_ranks
set sort_order = sort_order + 1000;

update public.community_ranks
set sort_order = case rank_key
  when 'founder' then 1
  when 'owner' then 2
  when 'manager' then 3
  when 'management' then 4
  when 'senior_admin' then 5
  when 'admin' then 6
  when 'senior_moderator' then 7
  when 'moderator' then 8
  when 'trial_moderator' then 9
  when 'the_nibbler' then 10
  when 'beta' then 11
  when 'alpha_plus' then 12
  when 'alpha' then 13
  when 'elite' then 14
  when 'rogue' then 15
  when 'scout' then 16
  when 'member' then 17
  else sort_order
end;

-- Manager is a real staff rank. Keep legacy community-rank permission keys
-- valid for compatibility, but the staff permission editor exposes staff ranks only.
alter table public.rank_permissions
  drop constraint if exists rank_permissions_rank_key_check;

alter table public.rank_permissions
  add constraint rank_permissions_rank_key_check
  check (rank_key in (
    'founder', 'owner', 'manager', 'management',
    'senior_admin', 'admin', 'senior_moderator', 'moderator', 'trial_moderator',
    'beta', 'alpha_plus', 'alpha', 'member'
  ));

create or replace function public.save_rank_permissions(p_scope text, p_permissions jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  item jsonb;
  v_rank text;
  v_permission text;
  v_enabled boolean;
begin
  if auth.uid() is null or not public.is_developer_admin() then
    raise exception 'Developer administrator access required.';
  end if;
  if p_scope not in ('community', 'launcher') then
    raise exception 'Invalid permission scope.';
  end if;
  if jsonb_typeof(p_permissions) <> 'array' or jsonb_array_length(p_permissions) = 0 then
    raise exception 'A non-empty permission list is required.';
  end if;

  for item in select value from jsonb_array_elements(p_permissions)
  loop
    v_rank := item->>'rank_key';
    v_permission := item->>'permission_key';
    v_enabled := (item->>'enabled')::boolean;

    if v_rank not in (
         'founder', 'owner', 'manager', 'management',
         'senior_admin', 'admin', 'senior_moderator', 'moderator', 'trial_moderator',
         'beta', 'alpha_plus', 'alpha', 'member'
       )
       or v_permission not in (
         'members.manage', 'moderation.manage', 'bans_reports.manage',
         'ranks.manage', 'developer.tools', 'releases.manage'
       )
       or v_enabled is null then
      raise exception 'Invalid rank permission entry.';
    end if;

    insert into public.rank_permissions(scope, rank_key, permission_key, enabled, updated_at, updated_by)
    values (p_scope, v_rank, v_permission, v_enabled, now(), auth.uid())
    on conflict (scope, rank_key, permission_key)
    do update set enabled = excluded.enabled, updated_at = now(), updated_by = auth.uid();
  end loop;
end;
$$;

-- The public rank badge must use the highest assigned rank, not a hard-coded
-- The Nibbler override or only profiles.rank_key.
create or replace function public.get_public_ranks(uuids uuid[])
returns table(mc_uuid uuid, rank text)
language sql
stable
security definer
set search_path = ''
as $function$
  select distinct on (requested.mc_uuid)
         requested.mc_uuid,
         case
           when coalesce(p.is_founder, false) or p.rank_key = 'founder' then 'founder'
           else coalesce(
             (
               select pr.rank_key
               from public.profile_ranks pr
               join public.community_ranks cr on cr.rank_key = pr.rank_key
               where pr.profile_id = p.id
               order by cr.sort_order asc
               limit 1
             ),
             nullif(p.rank_key, ''),
             'member'
           )
         end as rank
  from unnest(coalesce(uuids[1:100], array[]::uuid[])) as requested(mc_uuid)
  join public.alpha_minecraft_accounts a on a.mc_uuid = requested.mc_uuid
  join public.profiles p on p.id = a.profile_id
  order by requested.mc_uuid, a.linked_at desc, a.profile_id;
$function$;

grant execute on function public.get_public_ranks(uuid[]) to anon, authenticated;

commit;
