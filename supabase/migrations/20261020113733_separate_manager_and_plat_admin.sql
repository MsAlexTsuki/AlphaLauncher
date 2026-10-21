-- Correct the distinction between Manager and Plat Admin.
-- Manager uses the existing AlphaClient Management badge; the former Management rank
-- is preserved as the new Plat Admin rank, including existing assignments/permissions.

begin;

-- Create the separate Plat Admin catalog entry before migrating references.
update public.community_ranks set sort_order = sort_order + 1000;
insert into public.community_ranks (rank_key, rank_name, sort_order, badge_color, badge_icon)
values ('plat_admin', 'Plat Admin', 2004, '#5C0303', '◆')
on conflict (rank_key) do update
set rank_name = excluded.rank_name,
    badge_color = excluded.badge_color,
    badge_icon = excluded.badge_icon;

-- Preserve the old Management rank's assignments as Plat Admin.
delete from public.profile_ranks old_rank
using public.profile_ranks new_rank
where old_rank.profile_id = new_rank.profile_id
  and old_rank.rank_key = 'management'
  and new_rank.rank_key = 'plat_admin';

update public.profile_ranks set rank_key = 'plat_admin' where rank_key = 'management';
update public.profiles set rank_key = 'plat_admin' where rank_key = 'management';

-- Preserve existing StaffMods rank permissions while removing the old catalog key.
update public.client_mod_rank_permissions set rank_key = 'plat_admin' where rank_key = 'management';
delete from public.community_ranks where rank_key = 'management';

-- Rebuild the priority ordering without colliding with the unique sort_order constraint.
update public.community_ranks set sort_order = sort_order + 1000;
update public.community_ranks
set
  rank_name = case rank_key
    when 'plat_admin' then 'Plat Admin'
    when 'manager' then 'Manager'
    when 'senior_moderator' then 'Sr Mod'
    when 'trial_moderator' then 'T-Mod'
    when 'senior_admin' then 'Sr Admin'
    else rank_name
  end,
  sort_order = case rank_key
    when 'founder' then 1
    when 'owner' then 2
    when 'manager' then 3
    when 'plat_admin' then 4
    when 'senior_admin' then 5
    when 'admin' then 6
    when 'senior_moderator' then 7
    when 'moderator' then 8
    when 'trial_moderator' then 9
    when 'the_nibbler' then 10
    when 'alpha_plus' then 11
    when 'alpha' then 12
    when 'elite' then 13
    when 'rogue' then 14
    when 'scout' then 15
    when 'member' then 16
    when 'beta' then 17
    else sort_order
  end,
  badge_color = case
    when rank_key in ('manager', 'elite', 'rogue', 'scout') then '#808080'
    when rank_key = 'plat_admin' then '#5C0303'
    else badge_color
  end;

-- Keep rank permission administration compatible with the renamed rank and new Manager.
alter table public.rank_permissions drop constraint if exists rank_permissions_rank_key_check;
update public.rank_permissions set rank_key = 'plat_admin' where rank_key = 'management';
alter table public.rank_permissions
  add constraint rank_permissions_rank_key_check
  check (rank_key in ('founder','owner','manager','plat_admin','senior_admin','admin','senior_moderator','moderator','trial_moderator','beta','alpha_plus','alpha','member','the_nibbler','elite','rogue','scout'));

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

    if v_rank not in ('founder','owner','manager','plat_admin','senior_admin','admin','senior_moderator','moderator','trial_moderator','beta','alpha_plus','alpha','member','the_nibbler','elite','rogue','scout')
       or v_permission not in ('members.manage','moderation.manage','bans_reports.manage','ranks.manage','developer.tools','releases.manage')
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

grant execute on function public.save_rank_permissions(text, jsonb) to authenticated;

commit;
