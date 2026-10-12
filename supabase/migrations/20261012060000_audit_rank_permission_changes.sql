-- Audit changes to the rank-permission matrix.
-- Only records permissions whose enabled value actually changes.

begin;

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
  v_previous_enabled boolean;
  v_actor_name text;
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

  select coalesce(nullif(p.display_name, ''), p.username)
    into v_actor_name
  from public.profiles p
  where p.id = auth.uid();

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

    select rp.enabled
      into v_previous_enabled
    from public.rank_permissions rp
    where rp.scope = p_scope
      and rp.rank_key = v_rank
      and rp.permission_key = v_permission
    for update;

    if not found then
      v_previous_enabled := false;
    end if;

    insert into public.rank_permissions(scope, rank_key, permission_key, enabled, updated_at, updated_by)
    values (p_scope, v_rank, v_permission, v_enabled, now(), auth.uid())
    on conflict (scope, rank_key, permission_key)
    do update set enabled = excluded.enabled, updated_at = now(), updated_by = auth.uid();

    if v_previous_enabled is distinct from v_enabled then
      insert into public.audit_logs (
        actor_id,
        actor_label,
        product,
        category,
        action,
        target_label,
        outcome,
        details
      ) values (
        auth.uid(),
        v_actor_name,
        'system',
        'permissions',
        'rank_permission_changed',
        v_rank,
        'success',
        jsonb_build_object(
          'scope', p_scope,
          'rank_key', v_rank,
          'permission_key', v_permission,
          'old_enabled', v_previous_enabled,
          'new_enabled', v_enabled
        )
      );
    end if;
  end loop;
end;
$$;

revoke all on function public.save_rank_permissions(text, jsonb) from public, anon;
grant execute on function public.save_rank_permissions(text, jsonb) to authenticated;

commit;
