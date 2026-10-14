# Profile Bio and Avatar Storage — Changelog

## Database
- Added the profile `bio` and `avatar_url` columns when they do not already exist.
- Enforced a maximum bio length of 160 characters.
- Granted authenticated users permission to update their own editable profile fields.
- Configured the public `profile-avatars` bucket with a 5 MB upload limit and PNG, JPEG, WEBP, and GIF support.
- Added storage policies that allow public avatar viewing while restricting uploads, updates, and deletion to each user's own UUID folder.

## Compatibility
- Uses additive `IF NOT EXISTS` column additions and does not replace developer-auth RPCs or changelog tables.
- Intended to run after `alpha_community_friends.sql`.
- SQL was committed to the repository but has not been executed against Supabase by this change.
