-- Add Scout, Rogue, and Elite to the AlphaClient Community rank catalog.
-- Keeps the existing staff hierarchy and existing profile assignments intact.
-- Run through the normal Supabase migration/deployment workflow.

begin;

-- Move existing rows out of the target range first to preserve the unique sort_order constraint.
update public.community_ranks
set sort_order = sort_order + 100;

update public.community_ranks
set sort_order = case rank_key
  when 'founder' then 1
  when 'owner' then 2
  when 'management' then 3
  when 'senior_admin' then 4
  when 'admin' then 5
  when 'senior_moderator' then 6
  when 'moderator' then 7
  when 'trial_moderator' then 8
  when 'scout' then 9
  when 'rogue' then 10
  when 'elite' then 11
  when 'beta' then 12
  when 'alpha_plus' then 13
  when 'alpha' then 14
  when 'member' then 15
  else sort_order
end;

insert into public.community_ranks (rank_key, rank_name, sort_order, badge_color, badge_icon)
values
  ('scout', 'Scout', 9, '#F2C14E', '⌖'),
  ('rogue', 'Rogue', 10, '#9B5DE5', '♜'),
  ('elite', 'Elite', 11, '#00D9FF', '✦')
on conflict (rank_key) do update
set rank_name = excluded.rank_name,
    sort_order = excluded.sort_order,
    badge_color = excluded.badge_color,
    badge_icon = excluded.badge_icon;

commit;
