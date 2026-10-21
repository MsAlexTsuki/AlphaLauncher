-- Add Platform Admin and Manager as distinct community ranks.
-- Existing "management" profiles remain valid for backward compatibility.
begin;

update public.community_ranks
set sort_order = sort_order + 100;

insert into public.community_ranks (rank_key, rank_name, sort_order, badge_color, badge_icon)
values
  ('manager', 'Manager', 3, '#808080', ''),
  ('plat_admin', 'Platform Admin', 4, '#808080', '')
on conflict (rank_key) do update
set rank_name = excluded.rank_name,
    badge_color = excluded.badge_color,
    badge_icon = excluded.badge_icon;

-- Restore the existing ranks' ordering while reserving positions for the new ranks.
update public.community_ranks
set sort_order = case rank_key
  when 'founder' then 1
  when 'owner' then 2
  when 'manager' then 3
  when 'plat_admin' then 4
  when 'management' then 5
  when 'senior_admin' then 6
  when 'admin' then 7
  when 'senior_moderator' then 8
  when 'moderator' then 9
  when 'trial_moderator' then 10
  when 'beta' then 11
  when 'alpha_plus' then 12
  when 'alpha' then 13
  when 'member' then 14
  else sort_order
end;

commit;
