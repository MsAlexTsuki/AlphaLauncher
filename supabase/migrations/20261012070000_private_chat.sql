-- Alpha Community private chat: participant-only access and friend-gated sending.
begin;
create table if not exists public.private_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint private_messages_not_self check (sender_id <> recipient_id),
  constraint private_messages_body_length check (char_length(btrim(body)) between 1 and 2000)
);
create index if not exists private_messages_conversation_created_idx on public.private_messages (sender_id, recipient_id, created_at);
create index if not exists private_messages_recipient_created_idx on public.private_messages (recipient_id, sender_id, created_at);
alter table public.private_messages enable row level security;
revoke all on public.private_messages from anon;
grant select, insert on public.private_messages to authenticated;
drop policy if exists "Participants can read private messages" on public.private_messages;
create policy "Participants can read private messages" on public.private_messages for select to authenticated
using (auth.uid() = sender_id or auth.uid() = recipient_id);
drop policy if exists "Friends can send private messages" on public.private_messages;
create policy "Friends can send private messages" on public.private_messages for insert to authenticated
with check (
  auth.uid() = sender_id and auth.uid() <> recipient_id
  and exists (select 1 from public.friendships f
    where (f.user_a = auth.uid() and f.user_b = recipient_id)
       or (f.user_b = auth.uid() and f.user_a = recipient_id))
);
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'private_messages') then
    execute 'alter publication supabase_realtime add table public.private_messages';
  end if;
end
$$;
commit;
