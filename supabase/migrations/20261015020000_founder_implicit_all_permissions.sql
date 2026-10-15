-- Founder is the platform owner role and implicitly has every rank-managed permission.
-- Keep this server-side so UI state cannot accidentally remove Founder access.
begin;

create or replace function public.has_rank_permission(p_scope text, p_permission_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    auth.uid() is not null
    and p_scope in ('community', 'launcher')
    and (
      exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and (p.rank_key = 'founder' or p.is_founder is true)
      )
      or exists (
        select 1
        from public.profiles p
        join public.rank_permissions rp on rp.rank_key = p.rank_key
        where p.id = auth.uid()
          and rp.scope = p_scope
          and rp.permission_key = p_permission_key
          and rp.enabled = true
      )
    ),
    false
  );
$$;

revoke all on function public.has_rank_permission(text, text) from public, anon;
grant execute on function public.has_rank_permission(text, text) to authenticated;

commit;
