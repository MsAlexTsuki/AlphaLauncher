-- Update the Alpha community rank hierarchy used by Rank Management.
-- Additive and compatibility-safe: existing Beta assignments remain stored but Beta is no longer offered for new assignments.

begin;

-- Move current values out of the way before inserting/updating unique sort_order values.
update public.community_ranks
set sort_order = sort_order + 1000;

insert into public.community_ranks (rank_key, rank_name, sort_order, badge_color, badge_icon)
values
  ('manager', 'Manager', 1101, '#808080', ''),
  ('elite', 'Elite', 1102, '#808080', ''),
  ('rogue', 'Rogue', 1103, '#808080', ''),
  ('scout', 'Scout', 1104, '#808080', '')
on conflict (rank_key) do update
set rank_name = excluded.rank_name,
    sort_order = excluded.sort_order,
    badge_color = excluded.badge_color;

-- Move all rows again so the final 1..17 ordering cannot collide with temporary values.
update public.community_ranks
set sort_order = sort_order + 1000;

update public.community_ranks
set
  rank_name = case rank_key
    when 'management' then 'Plat Admin (Management)'
    when 'senior_moderator' then 'Sr Mod'
    when 'trial_moderator' then 'T-Mod'
    when 'senior_admin' then 'Sr Admin'
    else rank_name
  end,
  sort_order = case rank_key
    when 'founder' then 1
    when 'owner' then 2
    when 'manager' then 3
    when 'management' then 4
    when 'senior_admin' then 5
    when 'admin' then 6
    when 'senior_moderator' then 7
    when 'moderator' then 8
    when 'trial_moderator' then 9
    when 'the_nibbler' then 10
    when 'alpha_plus' then 11
    when 'alpha' then 12
    when 'elite' then 13
    when 'rogue' then 14
    when 'scout' then 15
    when 'member' then 16
    when 'beta' then 17
    else sort_order
  end,
  badge_color = case
    when rank_key in ('manager', 'elite', 'rogue', 'scout') then '#808080'
    else badge_color
  end;

commit;
