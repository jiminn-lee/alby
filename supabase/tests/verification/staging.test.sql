begin;
set local role postgres;
set local search_path = public, extensions, auth, storage;
select plan(24);
select hasnt_column('public', 'albums', 'genres', 'staging albums do not expose genres');
select has_column('public', 'albums', 'release_type', 'staging albums expose release types');
select has_column('public', 'comments', 'parent_comment_id', 'staging comments support one-level replies');
select has_table('public', 'comment_likes', 'staging has comment-level likes');
select is(
  (select data_type from information_schema.columns
    where table_schema = 'public' and table_name = 'albums' and column_name = 'release_date'),
  'text',
  'staging release dates preserve Spotify precision'
);
select is(
  (select count(*) from auth.users
    where id between '00000000-0000-0000-0000-000000000001'::uuid
      and '00000000-0000-0000-0000-000000000006'::uuid
      or email in (
        'jimin@alby.local', 'cody@alby.local', 'aaron@alby.local',
        'maya@alby.local', 'lena@alby.local', 'devon@alby.local'
      )),
  0::bigint,
  'staging has no tracked mock users'
);
select is(
  (select count(*) from public.profiles
    where id between '00000000-0000-0000-0000-000000000001'::uuid
      and '00000000-0000-0000-0000-000000000006'::uuid),
  0::bigint,
  'staging has no tracked mock profiles'
);
select is(
  (select count(*) from public.albums
    where id between '10000000-0000-0000-0000-000000000001'::uuid
      and '10000000-0000-0000-0000-000000000012'::uuid),
  0::bigint,
  'staging has no tracked mock albums'
);
select is(
  (select count(*)
    from auth.users app_user
    where (
        app_user.id = 'f17e0000-0000-4000-8000-000000000001'::uuid
        and app_user.email = 'sample-cody@fixtures.alby.test'
      ) or (
        app_user.id = 'f17e0000-0000-4000-8000-000000000002'::uuid
        and app_user.email = 'sample-maya@fixtures.alby.test'
      ) or (
        app_user.id = 'f17e0000-0000-4000-8000-000000000003'::uuid
        and app_user.email = 'sample-lena@fixtures.alby.test'
      )),
  3::bigint,
  'staging has exactly three reserved social fixture principals'
);
select is(
  (select count(*)
    from public.profiles profile
    where profile.avatar_path is null
      and profile.is_private = false
      and (
        (
          profile.id = 'f17e0000-0000-4000-8000-000000000001'::uuid
          and profile.username::text = 'sample_cody'
          and profile.display_name = 'Cody Fowler'
        ) or (
          profile.id = 'f17e0000-0000-4000-8000-000000000002'::uuid
          and profile.username::text = 'sample_maya'
          and profile.display_name = 'Maya Chen'
        ) or (
          profile.id = 'f17e0000-0000-4000-8000-000000000003'::uuid
          and profile.username::text = 'sample_lena'
          and profile.display_name = 'Lena Ortiz'
        )
      )),
  3::bigint,
  'staging has exactly three completed public social fixture profiles'
);
select is(
  (select count(*) from auth.identities
    where user_id between 'f17e0000-0000-4000-8000-000000000001'::uuid
      and 'f17e0000-0000-4000-8000-000000000003'::uuid),
  0::bigint,
  'staging social fixtures have no login identities'
);
select is(
  (select count(*) from auth.users
    where id between 'f17e0000-0000-4000-8000-000000000001'::uuid
      and 'f17e0000-0000-4000-8000-000000000003'::uuid
      and nullif(encrypted_password, '') is not null),
  0::bigint,
  'staging social fixtures have no passwords'
);
select is(
  (select count(*) from public.ratings
    where user_id between 'f17e0000-0000-4000-8000-000000000001'::uuid
      and 'f17e0000-0000-4000-8000-000000000003'::uuid),
  9::bigint,
  'staging has nine fixture ratings'
);
select is(
  (select count(*) from public.listen_later_items
    where user_id between 'f17e0000-0000-4000-8000-000000000001'::uuid
      and 'f17e0000-0000-4000-8000-000000000003'::uuid),
  3::bigint,
  'staging has three fixture saves'
);
select is(
  (select count(*) from public.activity_events
    where actor_id between 'f17e0000-0000-4000-8000-000000000001'::uuid
      and 'f17e0000-0000-4000-8000-000000000003'::uuid),
  12::bigint,
  'staging has twelve fixture activity events'
);
select is(
  (select count(*) from public.likes
    where user_id between 'f17e0000-0000-4000-8000-000000000001'::uuid
      and 'f17e0000-0000-4000-8000-000000000003'::uuid),
  4::bigint,
  'staging has four fixture-authored likes'
);
select is(
  (select count(*) from public.comments
    where user_id between 'f17e0000-0000-4000-8000-000000000001'::uuid
      and 'f17e0000-0000-4000-8000-000000000003'::uuid),
  19::bigint,
  'staging has nineteen fixture-authored comments and replies'
);
select is(
  (select count(*) from public.comments
    where user_id between 'f17e0000-0000-4000-8000-000000000001'::uuid
      and 'f17e0000-0000-4000-8000-000000000003'::uuid
      and parent_comment_id is null),
  8::bigint,
  'staging has eight fixture-authored root comments'
);
select is(
  (select count(*) from public.comment_likes
    where user_id between 'f17e0000-0000-4000-8000-000000000001'::uuid
      and 'f17e0000-0000-4000-8000-000000000003'::uuid),
  12::bigint,
  'staging has twelve fixture-authored comment likes'
);
select is(
  (select count(*) from public.follows
    where follower_id between 'f17e0000-0000-4000-8000-000000000001'::uuid
      and 'f17e0000-0000-4000-8000-000000000003'::uuid
      and followed_id between 'f17e0000-0000-4000-8000-000000000001'::uuid
        and 'f17e0000-0000-4000-8000-000000000003'::uuid),
  6::bigint,
  'staging fixture personas follow each other'
);
select is(
  (with completed_google_profiles as (
      select distinct profile.id
      from public.profiles profile
      join auth.identities identity
        on identity.user_id = profile.id
       and identity.provider = 'google'
      where profile.username is not null
        and profile.display_name is not null
    ), fixture_profiles(id) as (
      values
        ('f17e0000-0000-4000-8000-000000000001'::uuid),
        ('f17e0000-0000-4000-8000-000000000002'::uuid),
        ('f17e0000-0000-4000-8000-000000000003'::uuid)
    )
    select count(*)
    from completed_google_profiles profile
    cross join fixture_profiles fixture
    left join public.follows follow
      on follow.follower_id = profile.id
     and follow.followed_id = fixture.id
    where follow.follower_id is null),
  0::bigint,
  'every completed Google profile follows all staging fixtures'
);
select is(
  (select count(*)
    from auth.identities identity
    left join public.profiles profile on profile.id = identity.user_id
    where identity.provider = 'google' and profile.id is null),
  0::bigint,
  'every staging Google identity has a profile'
);
select is((select count(*) from storage.buckets where id = 'media'), 1::bigint, 'staging has the media bucket');
select is(
  (select count(*) from storage.objects
    where bucket_id = 'media'
      and name in (
        'albums/album-rest-in-bass.png',
        'albums/album-to-pimp-a-butterfly.png',
        'albums/album-brat.png',
        'albums/album-i-barely-know-her.png',
        'avatars/jimin.png'
      )),
  0::bigint,
  'staging has no tracked mock media files'
);
select * from finish();
rollback;
