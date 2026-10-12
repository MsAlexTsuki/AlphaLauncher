-- Restrict editable rank permissions to staff ranks and Beta (pre-release access).
-- Remove obsolete non-staff permission rows before tightening the constraint.
delete from public.rank_permissions
where rank_key in ('alpha_plus', 'alpha', 'member');

alter table public.rank_permissions
  drop constraint if exists rank_permissions_rank_key_check;

alter table public.rank_permissions
  add constraint rank_permissions_rank_key_check
  check (rank_key in (
    'founder', 'owner', 'management', 'senior_admin', 'admin',
    'senior_moderator', 'moderator', 'trial_moderator', 'beta'
  ));
