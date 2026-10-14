# Friends: Cancel Outgoing Requests

- Added a **Cancel request** action to pending outgoing friend requests in the Friends menu.
- Cancelling removes the pending request from the sender's outgoing list after the community data refreshes.
- Added a Supabase RPC that only permits authenticated users to cancel their own pending requests; incoming requests and accepted friendships are unaffected.
- Apply the accompanying Supabase migration before using the new action.
