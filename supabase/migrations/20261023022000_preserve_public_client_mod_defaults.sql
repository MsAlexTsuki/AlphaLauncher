update public.client_mod_rank_permissions
set enabled = true
where mod_id in ('quality', 'name-viewer', 'legacy-pvp', 'public.custom_hud', 'public.performance_monitor');

update public.client_mod_rank_permissions
set enabled = (rank_key = 'founder')
where mod_id = 'w-tap-assistance';
