-- Align client mod permission audit writes with the deployed audit table schema.
-- The audit table stores action metadata in details (jsonb); it has no effect, expires_at, or reason columns.
-- Expiry remains recorded on the actual access rule.

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
  v_reason text := nullif(left(trim(p_reason), 300), '');
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
    (p_user_id, p_mod_id, p_effect, p_expires_at, v_reason, auth.uid())
  returning id into v_id;

  insert into public.client_mod_permission_audit
    (actor_id, target_user_id, action, mod_id, details)
  values
    (auth.uid(), p_user_id, 'user_override_set', p_mod_id,
     jsonb_strip_nulls(jsonb_build_object('effect', p_effect, 'expires_at', p_expires_at, 'reason', v_reason)));

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
  v_reason text := nullif(left(trim(p_reason), 300), '');
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
    (p_user_id, p_category_key, p_expires_at, v_reason, auth.uid())
  returning id into v_id;

  insert into public.client_mod_permission_audit
    (actor_id, target_user_id, action, category_key, details)
  values
    (auth.uid(), p_user_id, 'category_grant_set', p_category_key,
     jsonb_strip_nulls(jsonb_build_object('expires_at', p_expires_at, 'reason', v_reason)));

  return v_id;
end;
$$;
