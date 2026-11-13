-- Keep Founder-only personal modules out of the Developer → Mods catalog.
-- Their existing catalog and permission records are retained for client-side
-- entitlement checks; this migration only hides them from the admin manager.

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
  where m.category_key <> 'founder'
  order by m.category_key, m.display_name;
end;
$$;

grant execute on function public.admin_list_client_mods() to authenticated;
