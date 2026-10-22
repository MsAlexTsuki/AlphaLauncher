begin;

insert into public.community_ranks (rank_key, rank_name, sort_order, badge_color, badge_icon)
values ('donator', 'Donator', 22, '#808080', '')
on conflict (rank_key) do update
set rank_name = excluded.rank_name;

-- Give Donator the same baseline mod defaults as Member; administrators can
-- customize every mod independently from Mods -> Rank Permission.
insert into public.client_mod_rank_permissions (rank_key, mod_id, enabled)
select 'donator', p.mod_id, p.enabled
from public.client_mod_rank_permissions p
where p.rank_key = 'member'
on conflict (rank_key, mod_id) do nothing;

commit;
