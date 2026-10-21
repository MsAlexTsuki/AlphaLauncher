begin;

-- Keep the existing rank ordering intact; only normalize the visible name.
update public.community_ranks
set rank_name = 'Platform Admin'
where rank_key = 'plat_admin'
  and rank_name <> 'Platform Admin';

-- Manager inherits the current Platform Admin permissions for both management scopes.
insert into public.rank_permissions (scope, rank_key, permission_key, enabled)
select scope, 'manager', permission_key, enabled
from public.rank_permissions
where rank_key = 'plat_admin'
on conflict (scope, rank_key, permission_key)
do update set enabled = excluded.enabled, updated_at = now();

-- Mirror Platform Admin's configured client-mod permissions for Manager.
insert into public.client_mod_rank_permissions (rank_key, mod_id, enabled)
select 'manager', mod_id, enabled
from public.client_mod_rank_permissions
where rank_key = 'plat_admin'
on conflict (rank_key, mod_id)
do update set enabled = excluded.enabled, updated_at = now();

commit;
