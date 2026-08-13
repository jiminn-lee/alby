begin isolation level serializable;

set local search_path = public, extensions, auth, pg_temp;

do $$
begin
  perform public.materialize_catalog_album(
    'musicbrainz',
    '48117b90-a16e-34ca-a514-19c702df1158',
    'https://musicbrainz.org/release-group/48117b90-a16e-34ca-a514-19c702df1158',
    'Discovery',
    'Daft Punk',
    'https://coverartarchive.org/release-group/48117b90-a16e-34ca-a514-19c702df1158/front-500',
    '2001-02-26',
    null,
    'album'
  );
  perform public.materialize_catalog_album(
    'musicbrainz',
    'f8f4167d-897c-4b25-a171-638374d1dfa4',
    'https://musicbrainz.org/release-group/f8f4167d-897c-4b25-a171-638374d1dfa4',
    'channel ORANGE',
    'Frank Ocean',
    'https://coverartarchive.org/release-group/f8f4167d-897c-4b25-a171-638374d1dfa4/front-500',
    '2012-07-10',
    null,
    'album'
  );
  perform public.materialize_catalog_album(
    'musicbrainz',
    '18be804e-9b7c-4b19-b6af-3eae9dc752e9',
    'https://musicbrainz.org/release-group/18be804e-9b7c-4b19-b6af-3eae9dc752e9',
    'SS-POP 3',
    'SYSTEM SEOUL',
    'https://coverartarchive.org/release-group/18be804e-9b7c-4b19-b6af-3eae9dc752e9/front-500',
    '2026-07-15',
    null,
    'album'
  );
  perform public.materialize_catalog_album(
    'musicbrainz',
    '4ddcc4fb-423b-4c98-9265-804071debce9',
    'https://musicbrainz.org/release-group/4ddcc4fb-423b-4c98-9265-804071debce9',
    'pullup to busan 4 morE hypEr summEr it’s gonna bE a fuckin moviE',
    'Effie',
    'https://coverartarchive.org/release-group/4ddcc4fb-423b-4c98-9265-804071debce9/front-500',
    '2025-08-01',
    null,
    'ep'
  );

  if (
    select count(*)
    from public.album_catalog_sources source
    where source.provider = 'musicbrainz'
      and source.external_id in (
        '48117b90-a16e-34ca-a514-19c702df1158',
        'f8f4167d-897c-4b25-a171-638374d1dfa4',
        '18be804e-9b7c-4b19-b6af-3eae9dc752e9',
        '4ddcc4fb-423b-4c98-9265-804071debce9'
      )
  ) <> 4 then
    raise exception using
      message = 'Staging social fixtures require all four tracked MusicBrainz albums.';
  end if;

  perform public.sync_catalog_album_genres(
    (
      select source.album_id
      from public.album_catalog_sources source
      where source.provider = 'musicbrainz'
        and source.external_id = '48117b90-a16e-34ca-a514-19c702df1158'
    ),
    'musicbrainz',
    jsonb_build_array(
      jsonb_build_object('external_id', 'a2782cb6-1cd0-477c-a61d-b3f8b42dd1b3', 'name', 'house', 'vote_count', 20, 'rank', 1),
      jsonb_build_object('external_id', '89255676-1f14-4dd8-bbad-fca839d6aff4', 'name', 'electronic', 'vote_count', 14, 'rank', 2),
      jsonb_build_object('external_id', '5acda04e-995d-4f79-9a66-5fe6a977ce15', 'name', 'french house', 'vote_count', 8, 'rank', 3),
      jsonb_build_object('external_id', '70adb285-e1f7-458a-823f-5cbda5e291c4', 'name', 'progressive house', 'vote_count', 4, 'rank', 4),
      jsonb_build_object('external_id', 'e5bba957-8c91-496a-a675-c6d0c6b51c33', 'name', 'dance', 'vote_count', 3, 'rank', 5)
    )
  );
  perform public.sync_catalog_album_genres(
    (
      select source.album_id
      from public.album_catalog_sources source
      where source.provider = 'musicbrainz'
        and source.external_id = 'f8f4167d-897c-4b25-a171-638374d1dfa4'
    ),
    'musicbrainz',
    jsonb_build_array(
      jsonb_build_object('external_id', '4bb4043a-0ee5-4b84-93fa-6ba4567a6ba0', 'name', 'contemporary r&b', 'vote_count', 3, 'rank', 1),
      jsonb_build_object('external_id', '4e03fb35-d571-4111-824d-88c9f8a3d0c9', 'name', 'alternative r&b', 'vote_count', 2, 'rank', 2),
      jsonb_build_object('external_id', '911c7bbb-172d-4df8-9478-dbff4296e791', 'name', 'pop', 'vote_count', 1, 'rank', 3),
      jsonb_build_object('external_id', '31be54b2-4d0c-42df-aa44-c496c7b4c3c3', 'name', 'r&b', 'vote_count', 1, 'rank', 4)
    )
  );
  perform public.sync_catalog_album_genres(
    (
      select source.album_id
      from public.album_catalog_sources source
      where source.provider = 'musicbrainz'
        and source.external_id = '18be804e-9b7c-4b19-b6af-3eae9dc752e9'
    ),
    'musicbrainz',
    '[]'::jsonb
  );
  perform public.sync_catalog_album_genres(
    (
      select source.album_id
      from public.album_catalog_sources source
      where source.provider = 'musicbrainz'
        and source.external_id = '4ddcc4fb-423b-4c98-9265-804071debce9'
    ),
    'musicbrainz',
    '[]'::jsonb
  );

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
    '48117b90-a16e-34ca-a514-19c702df1158',
    5.0::numeric,
    'Still sounds like the future.',
    interval '6 days'
  ),
  (
    'f17e1000-0000-4000-8000-000000000002'::uuid,
    'f17e0000-0000-4000-8000-000000000001'::uuid,
    'f8f4167d-897c-4b25-a171-638374d1dfa4',
    4.5::numeric,
    null,
    interval '4 days'
  ),
  (
    'f17e1000-0000-4000-8000-000000000003'::uuid,
    'f17e0000-0000-4000-8000-000000000001'::uuid,
    '18be804e-9b7c-4b19-b6af-3eae9dc752e9',
    4.0::numeric,
    null,
    interval '2 days'
  ),
  (
    'f17e1000-0000-4000-8000-000000000004'::uuid,
    'f17e0000-0000-4000-8000-000000000002'::uuid,
    'f8f4167d-897c-4b25-a171-638374d1dfa4',
    5.0::numeric,
    'Every detail lands.',
    interval '5 days 12 hours'
  ),
  (
    'f17e1000-0000-4000-8000-000000000006'::uuid,
    'f17e0000-0000-4000-8000-000000000002'::uuid,
    '4ddcc4fb-423b-4c98-9265-804071debce9',
    3.5::numeric,
    'Great energy front to back.',
    interval '1 day 12 hours'
  ),
  (
    'f17e1000-0000-4000-8000-000000000007'::uuid,
    'f17e0000-0000-4000-8000-000000000003'::uuid,
    '48117b90-a16e-34ca-a514-19c702df1158',
    4.5::numeric,
    null,
    interval '5 days'
  )
) as fixture(id, user_id, release_group_id, value, note, age)
join public.album_catalog_sources source
  on source.provider = 'musicbrainz'
 and source.external_id = fixture.release_group_id
join public.albums album on album.id = source.album_id
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
    '4ddcc4fb-423b-4c98-9265-804071debce9',
    interval '18 hours'
  ),
  (
    'f17e2000-0000-4000-8000-000000000002'::uuid,
    'f17e0000-0000-4000-8000-000000000002'::uuid,
    '48117b90-a16e-34ca-a514-19c702df1158',
    interval '30 hours'
  ),
  (
    'f17e2000-0000-4000-8000-000000000003'::uuid,
    'f17e0000-0000-4000-8000-000000000003'::uuid,
    'f8f4167d-897c-4b25-a171-638374d1dfa4',
    interval '42 hours'
  )
) as fixture(id, user_id, release_group_id, age)
join public.album_catalog_sources source
  on source.provider = 'musicbrainz'
 and source.external_id = fixture.release_group_id
join public.albums album on album.id = source.album_id
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
  )
) as fixture(user_id, rating_id, age)
join public.activity_events event on event.rating_id = fixture.rating_id
on conflict (user_id, activity_event_id) do nothing;

insert into public.comments (
  id,
  user_id,
  activity_event_id,
  parent_comment_id,
  body,
  created_at,
  updated_at
)
select
  fixture.id,
  fixture.user_id,
  event.id,
  null,
  fixture.body,
  now() - fixture.age,
  now() - fixture.age
from (values
  (
    'f17e3000-0000-4000-8000-000000000001'::uuid,
    'f17e0000-0000-4000-8000-000000000003'::uuid,
    'f17e1000-0000-4000-8000-000000000001'::uuid,
    null::uuid,
    'Perfect opener, too.',
    interval '5 days 22 hours'
  ),
  (
    'f17e3000-0000-4000-8000-000000000002'::uuid,
    'f17e0000-0000-4000-8000-000000000001'::uuid,
    'f17e1000-0000-4000-8000-000000000004'::uuid,
    null::uuid,
    'This one never gets old.',
    interval '5 days 10 hours'
  ),
  (
    'f17e3000-0000-4000-8000-000000000004'::uuid,
    'f17e0000-0000-4000-8000-000000000002'::uuid,
    'f17e1000-0000-4000-8000-000000000002'::uuid,
    null::uuid,
    'The second half is where it really clicked for me.',
    interval '3 days 23 hours'
  ),
  (
    'f17e3000-0000-4000-8000-000000000006'::uuid,
    'f17e0000-0000-4000-8000-000000000002'::uuid,
    null::uuid,
    'f17e2000-0000-4000-8000-000000000001'::uuid,
    'I have been meaning to hear this one too.',
    interval '17 hours'
  ),
  (
    'f17e3000-0000-4000-8000-000000000007'::uuid,
    'f17e0000-0000-4000-8000-000000000003'::uuid,
    null::uuid,
    'f17e2000-0000-4000-8000-000000000002'::uuid,
    'Good call. The production is gorgeous.',
    interval '28 hours'
  ),
  (
    'f17e3000-0000-4000-8000-000000000008'::uuid,
    'f17e0000-0000-4000-8000-000000000001'::uuid,
    null::uuid,
    'f17e2000-0000-4000-8000-000000000003'::uuid,
    'This has been sitting in my queue forever.',
    interval '40 hours'
  )
) as fixture(id, user_id, rating_id, listen_later_item_id, body, age)
join public.activity_events event
  on event.rating_id = fixture.rating_id
  or event.listen_later_item_id = fixture.listen_later_item_id
on conflict (id) do update set
  user_id = excluded.user_id,
  activity_event_id = excluded.activity_event_id,
  parent_comment_id = excluded.parent_comment_id,
  body = excluded.body,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at;

insert into public.comments (
  id,
  user_id,
  activity_event_id,
  parent_comment_id,
  body,
  created_at,
  updated_at
)
select
  fixture.id,
  fixture.user_id,
  parent.activity_event_id,
  parent.id,
  fixture.body,
  now() - fixture.age,
  now() - fixture.age
from (values
  (
    'f17e3000-0000-4000-8000-000000000009'::uuid,
    'f17e0000-0000-4000-8000-000000000002'::uuid,
    'f17e3000-0000-4000-8000-000000000001'::uuid,
    'The bass entrance gets me every time.',
    interval '5 days 20 hours'
  ),
  (
    'f17e3000-0000-4000-8000-000000000010'::uuid,
    'f17e0000-0000-4000-8000-000000000001'::uuid,
    'f17e3000-0000-4000-8000-000000000001'::uuid,
    'Same. It sets up the whole record perfectly.',
    interval '5 days 18 hours'
  ),
  (
    'f17e3000-0000-4000-8000-000000000011'::uuid,
    'f17e0000-0000-4000-8000-000000000003'::uuid,
    'f17e3000-0000-4000-8000-000000000001'::uuid,
    'The transition into the next track is unreal.',
    interval '5 days'
  ),
  (
    'f17e3000-0000-4000-8000-000000000012'::uuid,
    'f17e0000-0000-4000-8000-000000000002'::uuid,
    'f17e3000-0000-4000-8000-000000000001'::uuid,
    'I caught a detail there today that I had never noticed.',
    interval '4 days'
  ),
  (
    'f17e3000-0000-4000-8000-000000000013'::uuid,
    'f17e0000-0000-4000-8000-000000000001'::uuid,
    'f17e3000-0000-4000-8000-000000000001'::uuid,
    'That is why this album keeps rewarding replays.',
    interval '3 days'
  ),
  (
    'f17e3000-0000-4000-8000-000000000014'::uuid,
    'f17e0000-0000-4000-8000-000000000003'::uuid,
    'f17e3000-0000-4000-8000-000000000001'::uuid,
    'Putting it back on tonight.',
    interval '2 days'
  ),
  (
    'f17e3000-0000-4000-8000-000000000015'::uuid,
    'f17e0000-0000-4000-8000-000000000002'::uuid,
    'f17e3000-0000-4000-8000-000000000001'::uuid,
    'Report back when you do.',
    interval '1 day'
  ),
  (
    'f17e3000-0000-4000-8000-000000000016'::uuid,
    'f17e0000-0000-4000-8000-000000000003'::uuid,
    'f17e3000-0000-4000-8000-000000000006'::uuid,
    'The closing track alone is worth it.',
    interval '15 hours'
  ),
  (
    'f17e3000-0000-4000-8000-000000000017'::uuid,
    'f17e0000-0000-4000-8000-000000000001'::uuid,
    'f17e3000-0000-4000-8000-000000000006'::uuid,
    'Okay, moving it to the top of the list.',
    interval '12 hours'
  ),
  (
    'f17e3000-0000-4000-8000-000000000018'::uuid,
    'f17e0000-0000-4000-8000-000000000002'::uuid,
    'f17e3000-0000-4000-8000-000000000006'::uuid,
    'You will not regret it.',
    interval '8 hours'
  ),
  (
    'f17e3000-0000-4000-8000-000000000019'::uuid,
    'f17e0000-0000-4000-8000-000000000003'::uuid,
    'f17e3000-0000-4000-8000-000000000006'::uuid,
    'Now I want to replay it too.',
    interval '3 hours'
  )
) as fixture(id, user_id, parent_comment_id, body, age)
join public.comments parent on parent.id = fixture.parent_comment_id
on conflict (id) do update set
  user_id = excluded.user_id,
  activity_event_id = excluded.activity_event_id,
  parent_comment_id = excluded.parent_comment_id,
  body = excluded.body,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at;

insert into public.comment_likes (user_id, comment_id, created_at)
select fixture.user_id, fixture.comment_id, now() - fixture.age
from (values
  ('f17e0000-0000-4000-8000-000000000002'::uuid, 'f17e3000-0000-4000-8000-000000000001'::uuid, interval '5 days 19 hours'),
  ('f17e0000-0000-4000-8000-000000000001'::uuid, 'f17e3000-0000-4000-8000-000000000001'::uuid, interval '5 days 17 hours'),
  ('f17e0000-0000-4000-8000-000000000003'::uuid, 'f17e3000-0000-4000-8000-000000000002'::uuid, interval '5 days 9 hours'),
  ('f17e0000-0000-4000-8000-000000000002'::uuid, 'f17e3000-0000-4000-8000-000000000004'::uuid, interval '3 days 22 hours'),
  ('f17e0000-0000-4000-8000-000000000001'::uuid, 'f17e3000-0000-4000-8000-000000000006'::uuid, interval '16 hours'),
  ('f17e0000-0000-4000-8000-000000000003'::uuid, 'f17e3000-0000-4000-8000-000000000006'::uuid, interval '14 hours'),
  ('f17e0000-0000-4000-8000-000000000001'::uuid, 'f17e3000-0000-4000-8000-000000000009'::uuid, interval '5 days 16 hours'),
  ('f17e0000-0000-4000-8000-000000000002'::uuid, 'f17e3000-0000-4000-8000-000000000011'::uuid, interval '4 days 23 hours'),
  ('f17e0000-0000-4000-8000-000000000003'::uuid, 'f17e3000-0000-4000-8000-000000000016'::uuid, interval '13 hours'),
  ('f17e0000-0000-4000-8000-000000000002'::uuid, 'f17e3000-0000-4000-8000-000000000019'::uuid, interval '2 hours')
) as fixture(user_id, comment_id, age)
on conflict (user_id, comment_id) do update set created_at = excluded.created_at;

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
      'f17e0000-0000-4000-8000-000000000003'::uuid) <> 6
    or (select count(*) from public.listen_later_items where user_id between
      'f17e0000-0000-4000-8000-000000000001'::uuid and
      'f17e0000-0000-4000-8000-000000000003'::uuid) <> 3
    or (select count(*) from public.activity_events where actor_id between
      'f17e0000-0000-4000-8000-000000000001'::uuid and
      'f17e0000-0000-4000-8000-000000000003'::uuid) <> 9
    or (select count(*) from public.likes where user_id between
      'f17e0000-0000-4000-8000-000000000001'::uuid and
      'f17e0000-0000-4000-8000-000000000003'::uuid) <> 3
    or (select count(*) from public.comments where user_id between
      'f17e0000-0000-4000-8000-000000000001'::uuid and
      'f17e0000-0000-4000-8000-000000000003'::uuid) <> 17
    or (select count(*) from public.comments
      where user_id between
        'f17e0000-0000-4000-8000-000000000001'::uuid and
        'f17e0000-0000-4000-8000-000000000003'::uuid
      and parent_comment_id is null) <> 6
    or (select count(*) from public.comment_likes where user_id between
      'f17e0000-0000-4000-8000-000000000001'::uuid and
      'f17e0000-0000-4000-8000-000000000003'::uuid) <> 10
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
