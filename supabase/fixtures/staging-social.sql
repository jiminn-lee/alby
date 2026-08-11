begin isolation level serializable;

set local search_path = public, extensions, auth, pg_temp;

do $$
begin
  if (
    select count(distinct album.spotify_id)
    from public.albums album
    where album.spotify_id in (
      '2noRn2Aes5aoNVsU6iWThc',
      '392p3shh2jkxUxY2VHvlH8',
      '3JYSv64ZaFK2qHEBZ3suUD',
      '0YNxRyJMnNXOfysgawFE8B',
      '0HhoqCRYpuH5sc9mlgCgrF',
      '4TJQ4ze7fqMJIzGB1Y4vTy'
    )
  ) <> 6 then
    raise exception using
      message = 'Staging social fixtures require all six tracked Spotify albums. Materialize the missing albums before seeding.';
  end if;

  if exists (
    select 1
    from auth.users app_user
    where app_user.email in (
        'sample-cody@fixtures.alby.test',
        'sample-maya@fixtures.alby.test',
        'sample-lena@fixtures.alby.test'
      )
      and app_user.id not in (
        'f17e0000-0000-4000-8000-000000000001'::uuid,
        'f17e0000-0000-4000-8000-000000000002'::uuid,
        'f17e0000-0000-4000-8000-000000000003'::uuid
      )
  ) then
    raise exception using
      message = 'A reserved staging fixture email belongs to an unexpected Auth user.';
  end if;

  if exists (
    select 1
    from public.profiles profile
    where profile.username::text in ('sample_cody', 'sample_maya', 'sample_lena')
      and profile.id not in (
        'f17e0000-0000-4000-8000-000000000001'::uuid,
        'f17e0000-0000-4000-8000-000000000002'::uuid,
        'f17e0000-0000-4000-8000-000000000003'::uuid
      )
  ) then
    raise exception using
      message = 'A reserved staging fixture username belongs to a legitimate profile.';
  end if;
end;
$$;

insert into auth.users as app_user (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
  phone_change,
  phone_change_token,
  email_change_token_current,
  reauthentication_token,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
select
  '00000000-0000-0000-0000-000000000000'::uuid,
  fixture.id,
  'authenticated',
  'authenticated',
  fixture.email,
  null,
  fixture.created_at,
  '', '', '', '', '', '', '', '',
  jsonb_build_object('provider', 'fixture', 'providers', jsonb_build_array()),
  jsonb_build_object('full_name', fixture.display_name),
  fixture.created_at,
  fixture.created_at
from (values
  (
    'f17e0000-0000-4000-8000-000000000001'::uuid,
    'sample-cody@fixtures.alby.test',
    'Cody Fowler',
    now() - interval '90 days'
  ),
  (
    'f17e0000-0000-4000-8000-000000000002'::uuid,
    'sample-maya@fixtures.alby.test',
    'Maya Chen',
    now() - interval '75 days'
  ),
  (
    'f17e0000-0000-4000-8000-000000000003'::uuid,
    'sample-lena@fixtures.alby.test',
    'Lena Ortiz',
    now() - interval '60 days'
  )
) as fixture(id, email, display_name, created_at)
on conflict (id) do update set
  email = excluded.email,
  encrypted_password = null,
  raw_app_meta_data = excluded.raw_app_meta_data,
  raw_user_meta_data = excluded.raw_user_meta_data,
  updated_at = now()
where app_user.email is distinct from excluded.email
  or nullif(app_user.encrypted_password, '') is not null
  or app_user.raw_app_meta_data is distinct from excluded.raw_app_meta_data
  or app_user.raw_user_meta_data is distinct from excluded.raw_user_meta_data;

delete from auth.identities
where user_id in (
  'f17e0000-0000-4000-8000-000000000001'::uuid,
  'f17e0000-0000-4000-8000-000000000002'::uuid,
  'f17e0000-0000-4000-8000-000000000003'::uuid
);

insert into public.profiles as profile (
  id,
  username,
  display_name,
  avatar_path,
  bio,
  is_private,
  created_at
)
select
  fixture.id,
  fixture.username::extensions.citext,
  fixture.display_name,
  null,
  fixture.bio,
  false,
  app_user.created_at
from (values
  (
    'f17e0000-0000-4000-8000-000000000001'::uuid,
    'sample_cody',
    'Cody Fowler',
    'Jazz, hip-hop, and impossible-to-ignore drums.'
  ),
  (
    'f17e0000-0000-4000-8000-000000000002'::uuid,
    'sample_maya',
    'Maya Chen',
    'Notes for friends, not the algorithm.'
  ),
  (
    'f17e0000-0000-4000-8000-000000000003'::uuid,
    'sample_lena',
    'Lena Ortiz',
    'Pop maximalist. Ballad apologist.'
  )
) as fixture(id, username, display_name, bio)
join auth.users app_user on app_user.id = fixture.id
on conflict (id) do update set
  username = excluded.username,
  display_name = excluded.display_name,
  avatar_path = excluded.avatar_path,
  bio = excluded.bio,
  is_private = excluded.is_private
where (
  profile.username,
  profile.display_name,
  profile.avatar_path,
  profile.bio,
  profile.is_private
) is distinct from (
  excluded.username,
  excluded.display_name,
  excluded.avatar_path,
  excluded.bio,
  excluded.is_private
);

insert into public.ratings (
  id,
  user_id,
  album_id,
  value,
  note,
  created_at,
  updated_at
)
select
  fixture.id,
  fixture.user_id,
  album.id,
  fixture.value,
  fixture.note,
  now() - fixture.age,
  now() - fixture.age
from (values
  (
    'f17e1000-0000-4000-8000-000000000001'::uuid,
    'f17e0000-0000-4000-8000-000000000001'::uuid,
    '2noRn2Aes5aoNVsU6iWThc',
    5.0::numeric,
    'Still sounds like the future.',
    interval '6 days'
  ),
  (
    'f17e1000-0000-4000-8000-000000000002'::uuid,
    'f17e0000-0000-4000-8000-000000000001'::uuid,
    '392p3shh2jkxUxY2VHvlH8',
    4.5::numeric,
    null,
    interval '4 days'
  ),
  (
    'f17e1000-0000-4000-8000-000000000003'::uuid,
    'f17e0000-0000-4000-8000-000000000001'::uuid,
    '3JYSv64ZaFK2qHEBZ3suUD',
    4.0::numeric,
    null,
    interval '2 days'
  ),
  (
    'f17e1000-0000-4000-8000-000000000004'::uuid,
    'f17e0000-0000-4000-8000-000000000002'::uuid,
    '392p3shh2jkxUxY2VHvlH8',
    5.0::numeric,
    'Every detail lands.',
    interval '5 days 12 hours'
  ),
  (
    'f17e1000-0000-4000-8000-000000000005'::uuid,
    'f17e0000-0000-4000-8000-000000000002'::uuid,
    '0HhoqCRYpuH5sc9mlgCgrF',
    4.0::numeric,
    null,
    interval '3 days 12 hours'
  ),
  (
    'f17e1000-0000-4000-8000-000000000006'::uuid,
    'f17e0000-0000-4000-8000-000000000002'::uuid,
    '4TJQ4ze7fqMJIzGB1Y4vTy',
    3.5::numeric,
    'Great energy front to back.',
    interval '1 day 12 hours'
  ),
  (
    'f17e1000-0000-4000-8000-000000000007'::uuid,
    'f17e0000-0000-4000-8000-000000000003'::uuid,
    '2noRn2Aes5aoNVsU6iWThc',
    4.5::numeric,
    null,
    interval '5 days'
  ),
  (
    'f17e1000-0000-4000-8000-000000000008'::uuid,
    'f17e0000-0000-4000-8000-000000000003'::uuid,
    '0YNxRyJMnNXOfysgawFE8B',
    3.5::numeric,
    null,
    interval '3 days'
  ),
  (
    'f17e1000-0000-4000-8000-000000000009'::uuid,
    'f17e0000-0000-4000-8000-000000000003'::uuid,
    '0HhoqCRYpuH5sc9mlgCgrF',
    4.5::numeric,
    'This one stays in rotation.',
    interval '1 day'
  )
) as fixture(id, user_id, spotify_id, value, note, age)
join public.albums album on album.spotify_id = fixture.spotify_id
on conflict (id) do nothing;

insert into public.listen_later_items (id, user_id, album_id, created_at)
select
  fixture.id,
  fixture.user_id,
  album.id,
  now() - fixture.age
from (values
  (
    'f17e2000-0000-4000-8000-000000000001'::uuid,
    'f17e0000-0000-4000-8000-000000000001'::uuid,
    '4TJQ4ze7fqMJIzGB1Y4vTy',
    interval '18 hours'
  ),
  (
    'f17e2000-0000-4000-8000-000000000002'::uuid,
    'f17e0000-0000-4000-8000-000000000002'::uuid,
    '2noRn2Aes5aoNVsU6iWThc',
    interval '30 hours'
  ),
  (
    'f17e2000-0000-4000-8000-000000000003'::uuid,
    'f17e0000-0000-4000-8000-000000000003'::uuid,
    '392p3shh2jkxUxY2VHvlH8',
    interval '42 hours'
  )
) as fixture(id, user_id, spotify_id, age)
join public.albums album on album.spotify_id = fixture.spotify_id
on conflict (id) do nothing;

insert into public.activity_events (
  activity_type,
  actor_id,
  album_id,
  rating_id,
  created_at
)
select
  'rating_created'::public.activity_type,
  rating.user_id,
  rating.album_id,
  rating.id,
  rating.created_at
from public.ratings rating
where rating.id between
  'f17e1000-0000-4000-8000-000000000001'::uuid and
  'f17e1000-0000-4000-8000-000000000009'::uuid
on conflict (rating_id) where rating_id is not null do nothing;

insert into public.activity_events (
  activity_type,
  actor_id,
  album_id,
  listen_later_item_id,
  created_at
)
select
  'listen_later_added'::public.activity_type,
  item.user_id,
  item.album_id,
  item.id,
  item.created_at
from public.listen_later_items item
where item.id between
  'f17e2000-0000-4000-8000-000000000001'::uuid and
  'f17e2000-0000-4000-8000-000000000003'::uuid
on conflict (listen_later_item_id) where listen_later_item_id is not null do nothing;

insert into public.follows (follower_id, followed_id, created_at)
select follower.id, followed.id, now() - interval '8 days'
from (values
  ('f17e0000-0000-4000-8000-000000000001'::uuid),
  ('f17e0000-0000-4000-8000-000000000002'::uuid),
  ('f17e0000-0000-4000-8000-000000000003'::uuid)
) as follower(id)
cross join (values
  ('f17e0000-0000-4000-8000-000000000001'::uuid),
  ('f17e0000-0000-4000-8000-000000000002'::uuid),
  ('f17e0000-0000-4000-8000-000000000003'::uuid)
) as followed(id)
where follower.id <> followed.id
on conflict (follower_id, followed_id) do nothing;

insert into public.follows (follower_id, followed_id, created_at)
select distinct profile.id, fixture.id, now()
from public.profiles profile
join auth.identities identity
  on identity.user_id = profile.id
 and identity.provider = 'google'
cross join (values
  ('f17e0000-0000-4000-8000-000000000001'::uuid),
  ('f17e0000-0000-4000-8000-000000000002'::uuid),
  ('f17e0000-0000-4000-8000-000000000003'::uuid)
) as fixture(id)
where profile.username is not null
  and profile.display_name is not null
on conflict (follower_id, followed_id) do nothing;

insert into public.likes (user_id, activity_event_id, created_at)
select fixture.user_id, event.id, now() - fixture.age
from (values
  (
    'f17e0000-0000-4000-8000-000000000002'::uuid,
    'f17e1000-0000-4000-8000-000000000001'::uuid,
    interval '5 days 23 hours'
  ),
  (
    'f17e0000-0000-4000-8000-000000000003'::uuid,
    'f17e1000-0000-4000-8000-000000000002'::uuid,
    interval '3 days 23 hours'
  ),
  (
    'f17e0000-0000-4000-8000-000000000001'::uuid,
    'f17e1000-0000-4000-8000-000000000004'::uuid,
    interval '5 days 11 hours'
  ),
  (
    'f17e0000-0000-4000-8000-000000000002'::uuid,
    'f17e1000-0000-4000-8000-000000000009'::uuid,
    interval '23 hours'
  )
) as fixture(user_id, rating_id, age)
join public.activity_events event on event.rating_id = fixture.rating_id
on conflict (user_id, activity_event_id) do nothing;

insert into public.comments (
  id,
  user_id,
  activity_event_id,
  body,
  created_at,
  updated_at
)
select
  fixture.id,
  fixture.user_id,
  event.id,
  fixture.body,
  now() - fixture.age,
  now() - fixture.age
from (values
  (
    'f17e3000-0000-4000-8000-000000000001'::uuid,
    'f17e0000-0000-4000-8000-000000000003'::uuid,
    'f17e1000-0000-4000-8000-000000000001'::uuid,
    'Perfect opener, too.',
    interval '5 days 22 hours'
  ),
  (
    'f17e3000-0000-4000-8000-000000000002'::uuid,
    'f17e0000-0000-4000-8000-000000000001'::uuid,
    'f17e1000-0000-4000-8000-000000000004'::uuid,
    'This one never gets old.',
    interval '5 days 10 hours'
  ),
  (
    'f17e3000-0000-4000-8000-000000000003'::uuid,
    'f17e0000-0000-4000-8000-000000000002'::uuid,
    'f17e1000-0000-4000-8000-000000000009'::uuid,
    'Adding this to the queue.',
    interval '22 hours'
  )
) as fixture(id, user_id, rating_id, body, age)
join public.activity_events event on event.rating_id = fixture.rating_id
on conflict (id) do nothing;

do $$
begin
  if (select count(*) from auth.users where id between
      'f17e0000-0000-4000-8000-000000000001'::uuid and
      'f17e0000-0000-4000-8000-000000000003'::uuid) <> 3
    or (select count(*) from public.profiles where id between
      'f17e0000-0000-4000-8000-000000000001'::uuid and
      'f17e0000-0000-4000-8000-000000000003'::uuid) <> 3
    or (select count(*) from auth.identities where user_id between
      'f17e0000-0000-4000-8000-000000000001'::uuid and
      'f17e0000-0000-4000-8000-000000000003'::uuid) <> 0
    or (select count(*) from auth.users where id between
      'f17e0000-0000-4000-8000-000000000001'::uuid and
      'f17e0000-0000-4000-8000-000000000003'::uuid
      and nullif(encrypted_password, '') is not null) <> 0
    or (select count(*) from public.ratings where user_id between
      'f17e0000-0000-4000-8000-000000000001'::uuid and
      'f17e0000-0000-4000-8000-000000000003'::uuid) <> 9
    or (select count(*) from public.listen_later_items where user_id between
      'f17e0000-0000-4000-8000-000000000001'::uuid and
      'f17e0000-0000-4000-8000-000000000003'::uuid) <> 3
    or (select count(*) from public.activity_events where actor_id between
      'f17e0000-0000-4000-8000-000000000001'::uuid and
      'f17e0000-0000-4000-8000-000000000003'::uuid) <> 12
    or (select count(*) from public.likes where user_id between
      'f17e0000-0000-4000-8000-000000000001'::uuid and
      'f17e0000-0000-4000-8000-000000000003'::uuid) <> 4
    or (select count(*) from public.comments where user_id between
      'f17e0000-0000-4000-8000-000000000001'::uuid and
      'f17e0000-0000-4000-8000-000000000003'::uuid) <> 3
    or (select count(*) from public.follows
      where follower_id between
        'f17e0000-0000-4000-8000-000000000001'::uuid and
        'f17e0000-0000-4000-8000-000000000003'::uuid
      and followed_id between
        'f17e0000-0000-4000-8000-000000000001'::uuid and
        'f17e0000-0000-4000-8000-000000000003'::uuid) <> 6
  then
    raise exception using
      message = 'Staging social fixture seed did not produce the expected deterministic dataset.';
  end if;

  if exists (
    select 1
    from public.profiles profile
    join auth.identities identity
      on identity.user_id = profile.id
     and identity.provider = 'google'
    cross join (values
      ('f17e0000-0000-4000-8000-000000000001'::uuid),
      ('f17e0000-0000-4000-8000-000000000002'::uuid),
      ('f17e0000-0000-4000-8000-000000000003'::uuid)
    ) as fixture(id)
    left join public.follows follow
      on follow.follower_id = profile.id
     and follow.followed_id = fixture.id
    where profile.username is not null
      and profile.display_name is not null
      and follow.follower_id is null
  ) then
    raise exception using
      message = 'A completed Google profile is missing a required fixture follow.';
  end if;
end;
$$;

commit;
