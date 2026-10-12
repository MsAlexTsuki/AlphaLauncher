### Rank Management — Founder & Owner Access

- Replaced the Rank Management placeholder with a working community member search and rank assignment interface.
- Added current-rank display, rank selection, and reset-to-Member actions using the approved 12-rank catalog.
- Restricted rank management to authenticated Founder and Owner accounts in a server-side Supabase RPC.
- Protected the Founder account from rank changes and restricted Owners from changing Founder/Owner accounts or assigning the Founder rank.
- Kept direct authenticated profile rank updates blocked; rank changes go through the authorized RPC.
- Apply the new Supabase migration `20261012000000_secure_community_rank_management.sql` before using rank assignment.
