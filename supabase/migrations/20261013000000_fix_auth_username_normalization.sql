-- Fix username normalization when provisioning profiles from auth metadata.
-- Lowercase before filtering so uppercase letters are converted, not removed.
begin;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  preferred_name text;
  base_name text;
begin
  preferred_name := regexp_replace(
    lower(coalesce(new.raw_user_meta_data ->> 'username', '')),
    '[^a-z0-9_]', '', 'g'
  );

  if char_length(preferred_name) < 3 then
    base_name := 'alpha_' || substr(replace(new.id::text, '-', ''), 1, 8);
  else
    base_name := substr(preferred_name, 1, 20);
  end if;

  -- UUID suffix ensures newly provisioned usernames do not collide.
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    case
      when exists (select 1 from public.profiles p where p.username = base_name)
        then substr(base_name, 1, 11) || '_' || substr(replace(new.id::text, '-', ''), 1, 8)
      else base_name
    end,
    left(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), 32)
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

commit;
