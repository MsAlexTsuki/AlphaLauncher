# Fix: Friend Request Cancellation Permissions

- Fixed the Supabase permission error when cancelling an outgoing friend request.
- The cancellation RPC now runs as a security-definer function and explicitly restricts deletion to the authenticated sender's own pending request.
- No broad DELETE privilege is granted to the authenticated role.
- Apply the new Supabase migration to update the function.
