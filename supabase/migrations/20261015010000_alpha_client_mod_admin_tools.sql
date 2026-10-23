-- AlphaClient mod permission administration.
-- Apply after 20261015000000_alpha_client_mod_permissions.sql and its RPC migration.

alter table public.client_mods
  drop constraint if exists client_mods_category_key_check;
alter table public.client_mods
  add constraint client_mods_category_key_check
  check (category_key in (
    'general', 'staff', 'beta', 'alpha', 'alpha_plus', 'trial_moderator',
    'moderator', 'senior_moderator', 'admin', 'senior_admin', 'management', 'owner'
  ));

alter table public.client_mod_category_grants
  drop constraint if exists client_mod_category_grants_category_key_check;
alter table public.client_mod_category_grants
  add constraint client_mod_category_grants_category_key_check
  check (category_key in (
    'general', 'staff', 'beta', 'alpha', 'alpha_plus', 'trial_moderator',
    'moderator', 'senior_moderator', 'admin', 'senior_admin', 'management', 'owner'
  ));

-- Bhop is a staff tool, not a public/general mod.
update public.client_mods
set category_key = 'staff', updated_at = now()
where mod_id = 'staff.bhop';

-- Seed public mods as available by default, and BHOP only for staff-level ranks.
insert into public.client_mod_rank_permissions (rank_key, mod_id, enabled)
select r.rank_key, m.mod_id,
       case
         when m.mod_id in ('public.performance_monitor', 'public.custom_hud') then true
         when m.mod_id = 'staff.bhop' then r.rank_key in (
           'founder', 'owner', 'management', 'senior_admin', 'admin',
           'senior_moderator', 'moderator', 'trial_moderator'
         )
         else false
       end
from public.community_ranks r
cross join public.client_mods m
on conflict (rank_key, mod_id) do nothing;

create or replace function public.admin_list_client_mods()
returns table (
  mod_id text,
  display_name text,
  category_key text,
  description text,
  enabled boolean
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_developer_admin() then
    raise exception 'Developer administrator access required';
  end if;

  return query
  select m.mod_id, m.display_name, m.category_key, m.description, m.enabled
  from public.client_mods m
  order by m.category_key, m.display_name;
end;
$$;

create or replace function public.admin_get_client_mod_rank_permissions()
returns table (rank_key text, mod_id text, enabled boolean)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_developer_admin() then
    raise exception 'Developer administrator access required';
  end if;

  return query
  select p.rank_key, p.mod_id, p.enabled
  from public.client_mod_rank_permissions p;
end;
$$;

create or replace function public.admin_search_client_mod_players(p_search text default '')
returns table (user_id uuid, username text, display_name text, rank_key text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_developer_admin() then
    raise exception 'Developer administrator access required';
  end if;

  return query
  select p.id, p.username, p.display_name, coalesce(p.rank_key, 'member')
  from public.profiles p
  where coalesce(p.username, '') ilike '%' || coalesce(p_search, '') || '%'
     or coalesce(p.display_name, '') ilike '%' || coalesce(p_search, '') || '%'
  order by lower(coalesce(p.display_name, p.username, ''))
  limit 100;
end;
$$;

create or replace function public.admin_list_client_mod_category_grants()
returns table (id uuid, user_id uuid, category_key text, expires_at timestamptz, reason text, username text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_developer_admin() then
    raise exception 'Developer administrator access required';
  end if;

  return query
  select g.id, g.user_id, g.category_key, g.expires_at, g.reason, p.username
  from public.client_mod_category_grants g
  left join public.profiles p on p.id = g.user_id
  where g.revoked_at is null
    and (g.expires_at is null or g.expires_at > now())
  order by g.created_at desc
  limit 500;
end;
$$;

create or replace function public.admin_list_client_mod_user_overrides()
returns table (id uuid, user_id uuid, mod_id text, effect text, expires_at timestamptz, reason text, username text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_developer_admin() then
    raise exception 'Developer administrator access required';
  end if;

  return query
  select o.id, o.user_id, o.mod_id, o.effect, o.expires_at, o.reason, p.username
  from public.client_mod_user_overrides o
  left join public.profiles p on p.id = o.user_id
  where o.revoked_at is null
    and (o.expires_at is null or o.expires_at > now())
  order by o.created_at desc
  limit 500;
end;
$$;

-- Keep only one active override for a user/mod pair by revoking earlier rows.
create or replace function public.set_client_mod_user_override(
  p_user_id uuid,
  p_mod_id text,
  p_effect text,
  p_expires_at timestamptz default null,
  p_reason text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null or not public.is_developer_admin() then
    raise exception 'Developer administrator access required';
  end if;
  if p_effect not in ('allow', 'deny') then
    raise exception 'Effect must be allow or deny';
  end if;
  if not exists (select 1 from public.client_mods m where m.mod_id = p_mod_id and m.enabled) then
    raise exception 'Unknown or disabled mod';
  end if;
  if p_expires_at is not null and p_expires_at <= now() then
    raise exception 'Expiry must be in the future';
  end if;

  update public.client_mod_user_overrides
  set revoked_at = now(), revoked_by = auth.uid()
  where user_id = p_user_id and mod_id = p_mod_id and revoked_at is null;

  insert into public.client_mod_user_overrides
    (user_id, mod_id, effect, expires_at, reason, granted_by)
  values
    (p_user_id, p_mod_id, p_effect, p_expires_at, nullif(left(trim(p_reason), 300), ''), auth.uid())
  returning id into v_id;

  insert into public.client_mod_permission_audit
    (actor_id, target_user_id, action, mod_id, effect, expires_at, reason)
  values
    (auth.uid(), p_user_id, 'user_override_set', p_mod_id, p_effect, p_expires_at, nullif(left(trim(p_reason), 300), ''));

  return v_id;
end;
$$;

create or replace function public.grant_client_mod_category(
  p_user_id uuid,
  p_category_key text,
  p_expires_at timestamptz default null,
  p_reason text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null or not public.is_developer_admin() then
    raise exception 'Developer administrator access required';
  end if;
  if p_category_key not in (
    'general', 'staff', 'beta', 'alpha', 'alpha_plus', 'trial_moderator',
    'moderator', 'senior_moderator', 'admin', 'senior_admin', 'management', 'owner'
  ) then
    raise exception 'Invalid mod category';
  end if;
  if p_expires_at is not null and p_expires_at <= now() then
    raise exception 'Expiry must be in the future';
  end if;

  update public.client_mod_category_grants
  set revoked_at = now(), revoked_by = auth.uid()
  where user_id = p_user_id and category_key = p_category_key and revoked_at is null;

  insert into public.client_mod_category_grants
    (user_id, category_key, expires_at, reason, granted_by)
  values
    (p_user_id, p_category_key, p_expires_at, nullif(left(trim(p_reason), 300), ''), auth.uid())
  returning id into v_id;

  insert into public.client_mod_permission_audit
    (actor_id, target_user_id, action, category_key, expires_at, reason)
  values
    (auth.uid(), p_user_id, 'category_grant_set', p_category_key, p_expires_at, nullif(left(trim(p_reason), 300), ''));

  return v_id;
end;
$$;

grant execute on function public.admin_list_client_mods() to authenticated;
grant execute on function public.admin_get_client_mod_rank_permissions() to authenticated;
grant execute on function public.admin_search_client_mod_players(text) to authenticated;
grant execute on function public.admin_list_client_mod_category_grants() to authenticated;
grant execute on function public.admin_list_client_mod_user_overrides() to authenticated;
grant execute on function public.set_client_mod_user_override(uuid, text, text, timestamptz, text) to authenticated;
grant execute on function public.grant_client_mod_category(uuid, text, timestamptz, text) to authenticated;
