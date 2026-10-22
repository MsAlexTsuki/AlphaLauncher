alter table public.client_mods
  drop constraint if exists client_mods_category_key_check;

alter table public.client_mods
  add constraint client_mods_category_key_check
  check (
    category_key = any (array[
      'general',
      'staff',
      'beta',
      'donator',
      'scout',
      'rogue',
      'elite',
      'alpha',
      'alpha_plus',
      'trial_moderator',
      'moderator',
      'sr_moderator',
      'mod',
      'sr_mod',
      'admin',
      'senior_admin',
      'management',
      'plat_admin',
      'manager',
      'owner',
      'founder'
    ]::text[])
  );
