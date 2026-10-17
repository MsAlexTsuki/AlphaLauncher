-- Add The Nibbler as the thirteenth Alpha community rank.
-- Additive migration; existing rank assignments and permissions remain unchanged.

begin;

insert into public.community_ranks (rank_key, rank_name, sort_order, badge_color, badge_icon)
values ('the_nibbler', 'The Nibbler', 13, '#C3BFE0', '')
on conflict (rank_key) do update
set rank_name = excluded.rank_name,
    sort_order = excluded.sort_order,
    badge_color = excluded.badge_color;

commit;
