-- Run the cancellation delete with the function owner's privileges, while
-- explicitly restricting it to the authenticated sender's own pending request.
create or replace function public.cancel_friend_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
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
