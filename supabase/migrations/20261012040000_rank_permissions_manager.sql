-- Rank-scoped permissions for the community website and launcher dashboard.
create table if not exists public.rank_permissions (
  scope text not null check (scope in ('community', 'launcher')),
  rank_key text not null check (rank_key in ('founder','owner','management','senior_admin','admin','senior_moderator','moderator','trial_moderator','beta','alpha_plus','alpha','member')),
  permission_key text not null check (permission_key in ('members.manage','moderation.manage','bans_reports.manage','ranks.manage','developer.tools','releases.manage')),
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  primary key (scope, rank_key, permission_key)
);

alter table public.rank_permissions enable row level security;
revoke all on public.rank_permissions from anon, authenticated;

-- Existing developer-admin gate remains the authority for editing the permission matrix.
create or replace function public.get_rank_permissions(p_scope text)
returns table(scope text, rank_key text, permission_key text, enabled boolean)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_developer_admin() then
    raise exception 'Developer administrator access required.';
  end if;
  if p_scope not in ('community', 'launcher') then
    raise exception 'Invalid permission scope.';
  end if;
  return query
    select rp.scope, rp.rank_key, rp.permission_key, rp.enabled
    from public.rank_permissions rp
    where rp.scope = p_scope
    order by rp.rank_key, rp.permission_key;
end;
$$;

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

    if v_rank not in ('founder','owner','management','senior_admin','admin','senior_moderator','moderator','trial_moderator','beta','alpha_plus','alpha','member')
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

-- Shared authorization primitive for protected community/launcher RPCs and RLS policies.
create or replace function public.has_rank_permission(p_scope text, p_permission_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    auth.uid() is not null
    and exists (
      select 1
      from public.community_profiles cp
      join public.rank_permissions rp on rp.rank_key = cp.rank_key
      where cp.id = auth.uid()
        and rp.scope = p_scope
        and rp.permission_key = p_permission_key
        and rp.enabled = true
    ),
    false
  );
$$;

revoke all on function public.get_rank_permissions(text) from public;
revoke all on function public.save_rank_permissions(text, jsonb) from public;
revoke all on function public.has_rank_permission(text, text) from public;
grant execute on function public.get_rank_permissions(text) to authenticated;
grant execute on function public.save_rank_permissions(text, jsonb) to authenticated;
grant execute on function public.has_rank_permission(text, text) to authenticated;
