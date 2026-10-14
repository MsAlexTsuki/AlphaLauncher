# Community Rank Catalog — Database Migration

## Database
- Added a canonical catalog for the twelve Alpha Community ranks.
- Added a `rank_key` reference to community profiles while preserving the existing `is_founder` flag.
- Migrated existing profiles marked as Founder to the `founder` rank.
- Enabled authenticated read-only access to the rank catalog.
- Added a database trigger to reject rank changes made through ordinary authenticated profile updates.

## Compatibility and Safety
- Kept the migration additive; it does not alter developer authentication RPCs or changelog tables.
- Retained the existing Founder gold color and configured the Founder icon key as `cherry-blossom-tree`.
- Used neutral placeholder colors for ranks whose final colors have not yet been approved.
- Rank assignment from a trusted server-side service still needs to be connected to the future Rank Management interface.

## Status
- Branch: `feature/changelog-audit-logging`
- Migration: `supabase/migrations/20261011000000_community_rank_catalog.sql`
- Database execution: Not run by this change; review and run the SQL in Supabase SQL Editor.
