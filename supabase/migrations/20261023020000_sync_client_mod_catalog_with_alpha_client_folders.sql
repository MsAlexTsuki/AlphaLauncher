begin;

alter table public.client_mods drop constraint if exists client_mods_category_key_check;
alter table public.client_mods add constraint client_mods_category_key_check
check (category_key = any (array[
  'general','staff','beta','donator','alpha','alpha_plus',
  'trial_moderator','moderator','senior_moderator','mod','sr_mod',
  'admin','senior_admin','management','plat_admin','manager','owner','founder'
]::text[]));

insert into public.client_mods (mod_id, display_name, category_key, description, enabled)
values
  ('quality', 'Quality', 'general', 'Quality of Life tools and module management.', true),
  ('name-viewer', 'Name Viewer', 'general', 'Show your own Minecraft name above your character.', true),
  ('legacy-pvp', 'Legacy PvP', 'general', 'Legacy PvP presentation and settings.', true),
  ('w-tap-assistance', 'W-Tap Assistance', 'founder', 'Founder-only W-Tap Assistance settings.', true)
on conflict (mod_id) do update
set display_name = excluded.display_name,
    category_key = excluded.category_key,
    description = excluded.description,
    enabled = excluded.enabled;

update public.client_mods
set category_key = 'general',
    description = 'Bhop module shown only in StaffMods → General → Bhop.'
where mod_id = 'staff.bhop';

update public.client_mods
set category_key = 'general',
    display_name = case mod_id
      when 'public.custom_hud' then 'CPS'
      when 'public.performance_monitor' then 'FPS'
      else display_name
    end,
    description = case mod_id
      when 'public.custom_hud' then 'Clicks per second HUD with selectable mouse buttons and appearance settings.'
      when 'public.performance_monitor' then 'Compact FPS counter and performance monitor.'
      else description
    end
where mod_id in ('public.custom_hud', 'public.performance_monitor');

-- Ensure every existing rank has a row for every catalogued module.
-- Missing rank/module pairs start disabled and can be changed in Rank Permission.
insert into public.client_mod_rank_permissions (rank_key, mod_id, enabled)
select r.rank_key, m.mod_id, (r.rank_key = 'founder')
from public.community_ranks r
cross join public.client_mods m
on conflict (rank_key, mod_id) do nothing;

commit;