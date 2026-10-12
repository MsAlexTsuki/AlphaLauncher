# Rank Permissions Manager

- Added the Rank Permissions Manager to configure six access categories for each community rank.
- Added separate permission scopes for the community website and launcher dashboard.
- Added Supabase storage and server-side RPC checks; only developer administrators can read or edit the permission matrix.
- Added the has_rank_permission authorization helper for protected server-side RPCs and row-level security policies.
- Apply the Supabase migration before using the manager.

- Fixed the authorization helper to use the existing `public.profiles` table and its `rank_key` column.

- Refined the permissions interface with a clearer product-area/rank selector, enabled-count summary, aligned toggle rows and responsive spacing.
- Limited the permission editor to staff ranks plus Beta; removed Alpha, Alpha+ and Member from the editor.

- Added a Community destination between Mods and Friends, with a community identity card linked to the existing profile editor and a styled preview of planned AlphaClient forum sections.
- Added a Home-page “Make your Alpha Client account” call-to-action that opens the Community page.
- Positioned the “Make your Alpha Client account” button centered below the News and Last played cards on Home.
- Updated the Community identity card to show the saved profile username/name from `public.profiles` above the account email.
- Prevented the Community identity card from briefly displaying an email as the profile name by waiting for the saved profile and filtering email-shaped name candidates.
