-- Align the community rank colors with the Scout, Rogue, and Elite badge designs.
begin;

update public.community_ranks
set badge_color = case rank_key
  when 'scout' then '#FFD700'
  when 'rogue' then '#A855F7'
  when 'elite' then '#00D9FF'
  else badge_color
end
where rank_key in ('scout', 'rogue', 'elite');

commit;
