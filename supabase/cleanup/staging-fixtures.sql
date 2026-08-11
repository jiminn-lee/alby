begin isolation level serializable;

do $$
begin
  if exists (
    select 1
    from public.ratings rating
    where rating.user_id not between '00000000-0000-0000-0000-000000000001'::uuid
      and '00000000-0000-0000-0000-000000000006'::uuid
      and rating.album_id between '10000000-0000-0000-0000-000000000001'::uuid
        and '10000000-0000-0000-0000-000000000012'::uuid
  ) or exists (
    select 1
    from public.listen_later_items item
    where item.user_id not between '00000000-0000-0000-0000-000000000001'::uuid
      and '00000000-0000-0000-0000-000000000006'::uuid
      and item.album_id between '10000000-0000-0000-0000-000000000001'::uuid
        and '10000000-0000-0000-0000-000000000012'::uuid
  ) or exists (
    select 1
    from public.follows follow
    where (
      follow.follower_id not between '00000000-0000-0000-0000-000000000001'::uuid
        and '00000000-0000-0000-0000-000000000006'::uuid
      and follow.followed_id between '00000000-0000-0000-0000-000000000001'::uuid
        and '00000000-0000-0000-0000-000000000006'::uuid
    ) or (
      follow.followed_id not between '00000000-0000-0000-0000-000000000001'::uuid
        and '00000000-0000-0000-0000-000000000006'::uuid
      and follow.follower_id between '00000000-0000-0000-0000-000000000001'::uuid
        and '00000000-0000-0000-0000-000000000006'::uuid
    )
  ) or exists (
    select 1
    from public.activity_events event
    where event.actor_id not between '00000000-0000-0000-0000-000000000001'::uuid
      and '00000000-0000-0000-0000-000000000006'::uuid
      and event.album_id between '10000000-0000-0000-0000-000000000001'::uuid
        and '10000000-0000-0000-0000-000000000012'::uuid
  ) or exists (
    select 1
    from public.likes reaction
    join public.activity_events event on event.id = reaction.activity_event_id
    where reaction.user_id not between '00000000-0000-0000-0000-000000000001'::uuid
      and '00000000-0000-0000-0000-000000000006'::uuid
      and reaction.user_id not in (
        'f17e0000-0000-4000-8000-000000000001'::uuid,
        'f17e0000-0000-4000-8000-000000000002'::uuid,
        'f17e0000-0000-4000-8000-000000000003'::uuid
      )
      and (
        event.actor_id between '00000000-0000-0000-0000-000000000001'::uuid
          and '00000000-0000-0000-0000-000000000006'::uuid
        or event.album_id between '10000000-0000-0000-0000-000000000001'::uuid
          and '10000000-0000-0000-0000-000000000012'::uuid
        or event.actor_id in (
          'f17e0000-0000-4000-8000-000000000001'::uuid,
          'f17e0000-0000-4000-8000-000000000002'::uuid,
          'f17e0000-0000-4000-8000-000000000003'::uuid
        )
      )
  ) or exists (
    select 1
    from public.comments comment
    join public.activity_events event on event.id = comment.activity_event_id
    where comment.user_id not between '00000000-0000-0000-0000-000000000001'::uuid
      and '00000000-0000-0000-0000-000000000006'::uuid
      and comment.user_id not in (
        'f17e0000-0000-4000-8000-000000000001'::uuid,
        'f17e0000-0000-4000-8000-000000000002'::uuid,
        'f17e0000-0000-4000-8000-000000000003'::uuid
      )
      and (
        event.actor_id between '00000000-0000-0000-0000-000000000001'::uuid
          and '00000000-0000-0000-0000-000000000006'::uuid
        or event.album_id between '10000000-0000-0000-0000-000000000001'::uuid
          and '10000000-0000-0000-0000-000000000012'::uuid
        or event.actor_id in (
          'f17e0000-0000-4000-8000-000000000001'::uuid,
          'f17e0000-0000-4000-8000-000000000002'::uuid,
          'f17e0000-0000-4000-8000-000000000003'::uuid
        )
      )
  ) then
    raise exception using
      message = 'Refusing to purge staging fixtures because an OAuth user has data attached to mock content.';
  end if;
end;
$$;

delete from auth.users
where id between '00000000-0000-0000-0000-000000000001'::uuid
    and '00000000-0000-0000-0000-000000000006'::uuid
  or id in (
    'f17e0000-0000-4000-8000-000000000001'::uuid,
    'f17e0000-0000-4000-8000-000000000002'::uuid,
    'f17e0000-0000-4000-8000-000000000003'::uuid
  )
  or email in (
    'jimin@alby.local',
    'cody@alby.local',
    'aaron@alby.local',
    'maya@alby.local',
    'lena@alby.local',
    'devon@alby.local',
    'sample-cody@fixtures.alby.test',
    'sample-maya@fixtures.alby.test',
    'sample-lena@fixtures.alby.test'
  );

delete from public.albums
where id between '10000000-0000-0000-0000-000000000001'::uuid
  and '10000000-0000-0000-0000-000000000012'::uuid;

commit;
