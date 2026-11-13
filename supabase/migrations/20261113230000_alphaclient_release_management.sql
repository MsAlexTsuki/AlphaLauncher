create table if not exists public.alphaclient_releases (
  version text primary key,
  channel text not null check (channel in ('official', 'test', 'archived')),
  asset_name text not null,
  github_asset_id bigint,
  download_url text,
  storage_path text,
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  file_size bigint not null check (file_size > 0),
  release_notes text not null default '',
  published_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint alphaclient_releases_storage_or_github check (
    (channel = 'test' and storage_path is not null)
    or (channel = 'official' and github_asset_id is not null and download_url is not null)
    or channel = 'archived'
  )
);
create table if not exists public.alphaclient_release_settings (
  singleton boolean primary key default true check (singleton),
  official_version text references public.alphaclient_releases(version) on update cascade on delete restrict,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.alphaclient_release_settings (singleton) values (true) on conflict (singleton) do nothing;
create index if not exists alphaclient_releases_channel_created_idx on public.alphaclient_releases (channel, created_at desc);
alter table public.alphaclient_releases enable row level security;
alter table public.alphaclient_release_settings enable row level security;
revoke all on table public.alphaclient_releases from anon, authenticated;
revoke all on table public.alphaclient_release_settings from anon, authenticated;
grant all on table public.alphaclient_releases to service_role;
grant all on table public.alphaclient_release_settings to service_role;