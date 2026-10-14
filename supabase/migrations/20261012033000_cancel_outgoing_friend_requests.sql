-- Allow a signed-in user to cancel only their own pending outgoing friend request.
create or replace function public.cancel_friend_request(p_request_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to cancel a friend request.';
  end if;

  delete from public.friend_requests
  where id = p_request_id
    and sender_id = auth.uid()
    and status = 'pending';

  if not found then
    raise exception 'This pending friend request could not be found or is not yours to cancel.';
  end if;
end;
$$;

revoke all on function public.cancel_friend_request(uuid) from public;
grant execute on function public.cancel_friend_request(uuid) to authenticated;
