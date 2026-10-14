-- AlphaLauncher / AlphaClient: atomic changelog mutations + audit events
-- Apply this migration in Supabase SQL Editor before deploying the matching launcher code.
-- The authenticated actor is taken from auth.uid(); it cannot be supplied by the client.

create or replace function public.manage_changelog(
    p_action text,
    p_id bigint default null,
    p_version text default null,
    p_title text default null,
    p_body text default null,
    p_product text default 'client',
    p_published boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_actor_id uuid;
    v_actor_label text;
    v_old public.changelogs%rowtype;
    v_new public.changelogs%rowtype;
    v_log_id bigint;
    v_action text;
begin
    v_actor_id := auth.uid();

    if v_actor_id is null then
        raise exception 'Authentication required';
    end if;

    select u.email
      into v_actor_label
      from auth.users u
     where u.id = v_actor_id;

    if not exists (
        select 1
          from public.developer_admins da
         where da.user_id = v_actor_id
    ) then
        raise exception 'Developer admin access required';
    end if;

    if p_action is null or p_action not in ('create', 'update', 'delete', 'publish', 'unpublish') then
        raise exception 'Invalid changelog action';
    end if;

    if p_product is null or p_product not in ('launcher', 'client') then
        raise exception 'Invalid product';
    end if;

    if p_action in ('update', 'delete', 'publish', 'unpublish') and p_id is null then
        raise exception 'Changelog ID is required for this action';
    end if;

    if p_action in ('create', 'update') and (
        nullif(trim(coalesce(p_version, '')), '') is null
        or nullif(trim(coalesce(p_title, '')), '') is null
        or nullif(trim(coalesce(p_body, '')), '') is null
    ) then
        raise exception 'Version, title and body are required';
    end if;

    if p_action = 'create' then
        insert into public.changelogs (version, title, body, product, published)
        values (trim(p_version), trim(p_title), trim(p_body), p_product, coalesce(p_published, false))
        returning * into v_new;

        v_action := 'changelog.create';

    elsif p_action = 'update' then
        select * into v_old
          from public.changelogs
         where id = p_id
         for update;

        if not found then
            raise exception 'Changelog not found';
        end if;

        update public.changelogs
           set version = trim(p_version),
               title = trim(p_title),
               body = trim(p_body),
               product = p_product
         where id = p_id
         returning * into v_new;

        v_action := 'changelog.update';

    elsif p_action in ('publish', 'unpublish') then
        select * into v_old
          from public.changelogs
         where id = p_id
         for update;

        if not found then
            raise exception 'Changelog not found';
        end if;

        update public.changelogs
           set published = (p_action = 'publish')
         where id = p_id
         returning * into v_new;

        v_action := case when p_action = 'publish'
                         then 'changelog.publish'
                         else 'changelog.unpublish' end;

    else
        select * into v_old
          from public.changelogs
         where id = p_id
         for update;

        if not found then
            raise exception 'Changelog not found';
        end if;

        delete from public.changelogs where id = p_id;
        v_new := v_old;
        v_action := 'changelog.delete';
    end if;

    insert into public.audit_logs (
        actor_id, actor_label, product, category, action,
        target_label, outcome, details
    )
    values (
        v_actor_id,
        coalesce(v_actor_label, v_actor_id::text),
        coalesce(v_new.product, p_product),
        'changelog',
        v_action,
        coalesce(v_new.version, v_old.version, p_version),
        'success',
        jsonb_build_object(
            'changelog_id', coalesce(v_new.id, v_old.id),
            'before', case when p_action in ('update', 'delete', 'publish', 'unpublish')
                           then jsonb_build_object(
                               'version', v_old.version,
                               'title', v_old.title,
                               'body', v_old.body,
                               'product', v_old.product,
                               'published', v_old.published
                           ) else null end,
            'after', case when p_action <> 'delete'
                          then jsonb_build_object(
                              'version', v_new.version,
                              'title', v_new.title,
                              'body', v_new.body,
                              'product', v_new.product,
                              'published', v_new.published
                          ) else null end
        )
    )
    returning id into v_log_id;

    return jsonb_build_object(
        'id', coalesce(v_new.id, v_old.id),
        'audit_id', v_log_id,
        'action', v_action
    );
end;
$$;

revoke all on function public.manage_changelog(text, bigint, text, text, text, text, boolean)
    from public, anon;
grant execute on function public.manage_changelog(text, bigint, text, text, text, text, boolean)
    to authenticated;
