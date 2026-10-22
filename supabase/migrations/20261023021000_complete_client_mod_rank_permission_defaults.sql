insert into public.client_mod_rank_permissions (rank_key, mod_id, enabled)
select r.rank_key, m.mod_id, (r.rank_key = 'founder')
from public.community_ranks r
cross join public.client_mods m
on conflict (rank_key, mod_id) do nothing;
