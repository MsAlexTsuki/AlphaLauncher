# AlphaClient Community Rank Colors — Changelog

## Rank badges
- Applied the approved colors to the eleven non-Founder ranks.
- Added rank-aware badge rendering to the signed-in profile using the profile's `rank_key`.
- Preserved the existing Founder badge, cherry blossom icon, gold styling, and Founder status line.
- Kept existing profile editing and other launcher functionality unchanged.

## Database
- Updated the rank catalog migration seed colors to match the approved palette.
- Existing databases that already ran the earlier migration must run this SQL in Supabase SQL Editor to refresh stored colors:

```sql
update public.community_ranks as ranks
set badge_color = palette.badge_color
from (values
  ('owner', '#FF2D00'),
  ('management', '#5C0303'),
  ('senior_admin', '#D67020'),
  ('admin', '#E08D16'),
  ('senior_moderator', '#8C17D1'),
  ('moderator', '#29AFCC'),
  ('trial_moderator', '#D1CF1D'),
  ('beta', '#00FF52'),
  ('alpha_plus', '#FFF300'),
  ('alpha', '#F300FF'),
  ('member', '#C3BFE0')
) as palette(rank_key, badge_color)
where ranks.rank_key = palette.rank_key;
```

## Scope
- Updated `src/App.tsx`, `src/App.css`, and `supabase/migrations/20261011000000_community_rank_catalog.sql`.
- No rank assignment permissions were changed.
