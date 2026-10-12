### Rank Management — Founder & Owner Access

- Replaced the Rank Management placeholder with a working community member search and rank assignment interface.
- Added current-rank display, rank selection, and reset-to-Member actions using the approved 12-rank catalog.
- Restricted rank management to authenticated Founder and Owner accounts in a server-side Supabase RPC.
- Protected the Founder account from rank changes and restricted Owners from changing Founder/Owner accounts or assigning the Founder rank.
- Kept direct authenticated profile rank updates blocked; rank changes go through the authorized RPC.
- Apply the new Supabase migration `20261012000000_secure_community_rank_management.sql` before using rank assignment.


### Rank Management — Prevent accidental Founder assignments

- Removed Founder from assignable ranks in the interface and enforced the restriction in the server-side RPC.
- Allowed the authenticated Founder to demote another account that was accidentally assigned Founder, while preventing changes to their own rank.
- Kept Owner restrictions on Founder and Owner accounts.
- Replaced disabled-button wait cursors with a not-allowed cursor and added clearer explanations for disabled rank actions.
- Apply the new migration `20261012020000_prevent_accidental_founder_assignment.sql`.
