begin;

-- Mirror the top-level modules registered in AlphaModuleRegistry.
-- Existing catalog entries and permission rows are intentionally left untouched.
insert into public.client_mods (mod_id, display_name, category_key, description, enabled)
values
  ('singleplayer', 'Singleplayer', 'general', 'Mods designed specifically for singleplayer worlds.', true),
  ('world-edit', 'World Edit', 'general', 'Singleplayer WorldEdit commands controlled through the World Edit toggle.', true),
  ('misc', 'Misc', 'general', 'Miscellaneous client features.', true),
  ('minimap', 'Minimap', 'general', 'Terrain, entity and waypoint map with configurable position and appearance.', true),
  ('ping', 'Ping', 'general', 'Show your current server latency in milliseconds with configurable HUD appearance.', true),
  ('armor-hud-info', 'Armor HUD', 'general', 'Show held-item and equipped-armor durability in a movable horizontal or vertical HUD.', true),
  ('potion-hud-info', 'Potion HUD', 'general', 'Display active potion effects with four selectable display modes.', true),
  ('keystrokes', 'Keystrokes', 'general', 'Display movement keys, mouse clicks, and optional CPS on the HUD.', true),
  ('combo-counter', 'Combo Counter', 'general', 'Count confirmed consecutive hits on players and reset when you take damage.', true),
  ('win-loss-tracker', 'W&L Tracker', 'general', 'Track Practice match wins, losses, and win rate for the connected server.', true),
  ('pixelgarden', 'Pixel Garden', 'scout', 'Grow plants, harvest crops, sell them, and expand your garden.', true),
  ('s-tap-assistance', 'S-Tap Assistance', 'founder', 'Randomizable W-key tap style; does not require the S key.', true),
  ('aim-assist', 'AimAssist', 'founder', 'Smoothly correct aim only when a visible player is already close to the crosshair.', true)
on conflict (mod_id) do nothing;

-- General modules remain available to every rank, matching existing public defaults.
-- Pixel Garden follows the Client's Scout-tier folder inheritance and Partner access.
-- Founder modules remain exclusive to Founder; Owner is deliberately excluded.
insert into public.client_mod_rank_permissions (rank_key, mod_id, enabled)
select
  r.rank_key,
  m.mod_id,
  case
    when m.category_key = 'general' then true
    when m.category_key = 'scout' then r.rank_key in (
      'scout', 'rogue', 'elite', 'alpha', 'alpha_plus', 'partner', 'owner', 'founder'
    )
    when m.category_key = 'founder' then r.rank_key = 'founder'
    else false
  end
from public.community_ranks r
cross join public.client_mods m
where m.mod_id in (
  'singleplayer', 'world-edit', 'misc', 'minimap', 'ping',
  'armor-hud-info', 'potion-hud-info', 'keystrokes', 'combo-counter',
  'win-loss-tracker', 'pixelgarden', 's-tap-assistance', 'aim-assist'
)
on conflict (rank_key, mod_id) do nothing;

commit;
