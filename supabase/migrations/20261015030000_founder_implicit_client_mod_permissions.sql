-- Keep Founder access to AlphaClient mods enforced by Supabase, independent of UI state.
-- Includes the authenticated user's effective mod entitlement list for the client adapter.

begin;

create or replace function public.has_client_mod_access(p_mod_id text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_rank_key text;
  v_is_founder boolean := false;
  v_category_key text;
  v_override_effect text;
begin
  if v_user_id is null or p_mod_id is null or length(trim(p_mod_id)) = 0 then
    return false;
  end if;

  select p.rank_key, (p.rank_key = 'founder' or p.is_founder is true)
    into v_rank_key, v_is_founder
  from public.profiles p
  where p.id = v_user_id;

  if not found then
    return false;
  end if;

  -- Founder is the platform owner and cannot lose access through UI settings or overrides.
  if v_is_founder then
    return exists (
      select 1 from public.client_mods m
      where m.mod_id = p_mod_id and m.enabled
    );
  end if;

  select m.category_key into v_category_key
  from public.client_mods m
  where m.mod_id = p_mod_id and m.enabled;

  if not found then
    return false;
  end if;

  -- The latest active per-user override takes precedence over grants and rank defaults.
  select o.effect into v_override_effect
  from public.client_mod_user_overrides o
  where o.user_id = v_user_id
    and o.mod_id = p_mod_id
    and o.revoked_at is null
    and (o.expires_at is null or o.expires_at > now())
  order by o.created_at desc
  limit 1;

  if v_override_effect is not null then
    return v_override_effect = 'allow';
  end if;

  if exists (
    select 1
    from public.client_mod_category_grants g
    where g.user_id = v_user_id
      and g.category_key = v_category_key
      and g.revoked_at is null
      and (g.expires_at is null or g.expires_at > now())
  ) then
    return true;
  end if;

  return exists (
    select 1
    from public.client_mod_rank_permissions rp
    where rp.rank_key = coalesce(v_rank_key, 'member')
      and rp.mod_id = p_mod_id
      and rp.enabled = true
  );
end;
$$;

create or replace function public.get_my_client_mod_entitlements()
returns table (mod_id text)
language sql
stable
security definer
set search_path = ''
as $$
  select m.mod_id
  from public.client_mods m
  where m.enabled = true
    and public.has_client_mod_access(m.mod_id)
  order by m.mod_id;
$$;

revoke all on function public.has_client_mod_access(text) from public, anon;
revoke all on function public.get_my_client_mod_entitlements() from public, anon;
grant execute on function public.has_client_mod_access(text) to authenticated;
grant execute on function public.get_my_client_mod_entitlements() to authenticated;

commit;
