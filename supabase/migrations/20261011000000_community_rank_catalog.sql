-- AlphaClient Community: rank catalog and protected profile rank assignment
-- Additive migration. Preserves profiles.is_founder and existing profile/friend functionality.
-- Run in Supabase Dashboard -> SQL Editor.

begin;

create table if not exists public.community_ranks (
  rank_key text primary key,
  rank_name text not null unique,
  sort_order smallint not null unique,
  badge_color text not null,
  badge_icon text not null default '',
  created_at timestamptz not null default now(),
  constraint community_ranks_key_format check (rank_key ~ '^[a-z][a-z0-9_]*$'),
  constraint community_ranks_color_format check (badge_color ~ '^#[0-9A-Fa-f]{6}$')
);

insert into public.community_ranks (rank_key, rank_name, sort_order, badge_color, badge_icon)
values
  ('founder', 'Founder', 1, '#FFD866', 'cherry-blossom-tree'),
  ('owner', 'Owner', 2, '#808080', ''),
  ('management', 'Management', 3, '#808080', ''),
  ('senior_admin', 'Senior Admin', 4, '#808080', ''),
  ('admin', 'Admin', 5, '#808080', ''),
  ('senior_moderator', 'Senior Moderator', 6, '#808080', ''),
  ('moderator', 'Moderator', 7, '#808080', ''),
  ('trial_moderator', 'Trial Moderator', 8, '#808080', ''),
  ('beta', 'Beta', 9, '#808080', ''),
  ('alpha_plus', 'Alpha+', 10, '#808080', ''),
  ('alpha', 'Alpha', 11, '#808080', ''),
  ('member', 'Member', 12, '#808080', '')
on conflict (rank_key) do update
set rank_name = excluded.rank_name,
    sort_order = excluded.sort_order,
    badge_color = excluded.badge_color,
    badge_icon = case
      when public.community_ranks.rank_key = 'founder'
        then excluded.badge_icon
      else public.community_ranks.badge_icon
    end;

alter table public.profiles
  add column if not exists rank_key text not null default 'member';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_rank_key_fkey'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_rank_key_fkey
      foreign key (rank_key) references public.community_ranks(rank_key);
  end if;

  -- Preserve the existing Founder flag where that column is present.
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'is_founder'
  ) then
    execute $sql$
      update public.profiles
      set rank_key = 'founder'
      where is_founder is true
    $sql$;
  end if;
end;
$$;

alter table public.community_ranks enable row level security;

drop policy if exists "Anyone authenticated can view community ranks" on public.community_ranks;
create policy "Anyone authenticated can view community ranks"
  on public.community_ranks
  for select
  to authenticated
  using (true);

revoke insert, update, delete on public.community_ranks from anon, authenticated;
grant select on public.community_ranks to authenticated;

-- Prevent users from changing their own rank through direct profile updates.
-- Trusted service-role operations can assign ranks through a secured server-side workflow.
create or replace function public.prevent_profile_rank_self_assignment()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.rank_key is distinct from old.rank_key
     and coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'Profile ranks can only be changed by authorized administrators.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_rank_self_assignment on public.profiles;
create trigger profiles_prevent_rank_self_assignment
before update of rank_key on public.profiles
for each row execute function public.prevent_profile_rank_self_assignment();

revoke all on function public.prevent_profile_rank_self_assignment() from public, anon, authenticated;

commit;
