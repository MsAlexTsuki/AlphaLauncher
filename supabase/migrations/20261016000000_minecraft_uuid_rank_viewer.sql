-- AlphaClient public Rank Viewer: link a Minecraft UUID to the signed-in Alpha profile.
-- The UUID mapping is used only to display public rank badges. It must never be
-- used as proof of identity or as an authorization source for client/server features.

begin;

alter table public.profiles
  add column if not exists minecraft_uuid uuid;

create unique index if not exists profiles_minecraft_uuid_unique
  on public.profiles (minecraft_uuid)
  where minecraft_uuid is not null;

create or replace function public.get_public_ranks(uuids uuid[])
returns table (mc_uuid uuid, rank text)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.minecraft_uuid as mc_uuid,
    case
      when coalesce(p.is_founder, false) or p.rank_key = 'founder' then 'founder'
      else coalesce(nullif(p.rank_key, ''), 'member')
    end as rank
  from public.profiles p
  where p.minecraft_uuid = any (coalesce(uuids[1:100], array[]::uuid[]));
$$;

revoke all on function public.get_public_ranks(uuid[]) from public;
grant execute on function public.get_public_ranks(uuid[]) to anon, authenticated;

-- Each authenticated user may link their own profile to the UUID from the current
-- Minecraft session. The unique index prevents one UUID being linked to two profiles.
-- This remains a display association, not a trusted identity assertion.
create or replace function public.link_minecraft_uuid(target_uuid uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if target_uuid is null then
    raise exception 'Minecraft UUID is required.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.profiles p
    where p.minecraft_uuid = target_uuid
      and p.id <> auth.uid()
  ) then
    raise exception 'This Minecraft UUID is already linked to another Alpha account.'
      using errcode = '23505';
  end if;

  update public.profiles
  set minecraft_uuid = target_uuid
  where id = auth.uid();

  if not found then
    raise exception 'Alpha community profile not found.' using errcode = 'P0002';
  end if;

  return jsonb_build_object('minecraft_uuid', target_uuid);
end;
$$;

revoke all on function public.link_minecraft_uuid(uuid) from public, anon;
grant execute on function public.link_minecraft_uuid(uuid) to authenticated;

commit;
