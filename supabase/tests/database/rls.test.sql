begin;

-- Linked tests authenticate as cli_login_postgres, which is a non-inheriting
-- member of postgres. Assume that role only inside this transaction so the
-- suite can create and restore Auth fixtures without broadening app grants.
set local role postgres;
set local search_path = public, extensions, auth, storage;

create extension if not exists pgtap with schema extensions;

-- Build OAuth-shaped fixtures only inside this transaction. Existing staging
-- rows are restored by the final rollback, so tests do not depend on mutable
-- shared staging state and leave no changes behind.
delete from auth.users
where id between '00000000-0000-0000-0000-000000000001'::uuid
  and '00000000-0000-0000-0000-000000000006'::uuid;

delete from public.albums
where id between '10000000-0000-0000-0000-000000000001'::uuid
  and '10000000-0000-0000-0000-000000000012'::uuid;

\ir fixtures.inc

select plan(63);

insert into auth.users (
  instance_id, id, aud, role, email, email_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  phone_change, phone_change_token, email_change_token_current, reauthentication_token,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000'::uuid,
  '90000000-0000-0000-0000-000000000001'::uuid,
  'authenticated',
  'authenticated',
  'oauth-profile-test@alby.test',
  now(),
  '', '', '', '', '', '', '', '',
  '{"provider":"google","providers":["google"]}'::jsonb,
  '{"full_name":"OAuth Profile Test","avatar_url":"https://images.example.test/oauth-avatar.png"}'::jsonb,
  now(),
  now()
);

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (
  'google-oauth-profile-test',
  '90000000-0000-0000-0000-000000000001'::uuid,
  '{"sub":"google-oauth-profile-test","email":"oauth-profile-test@alby.test"}'::jsonb,
  'google',
  now(),
  now(),
  now()
);

select is(
  (select display_name || '|' || avatar_path || '|' || coalesce(username::text, '')
    from public.profiles
    where id = '90000000-0000-0000-0000-000000000001'::uuid),
  'OAuth Profile Test|https://images.example.test/oauth-avatar.png|',
  'a Google auth user receives provider profile metadata and still requires a username'
);

select hasnt_column(
  'public',
  'albums',
  'genres',
  'albums no longer expose genres'
);

select has_column(
  'public',
  'albums',
  'release_type',
  'albums expose a release type'
);

select is(
  (select data_type from information_schema.columns
    where table_schema = 'public' and table_name = 'albums' and column_name = 'release_date'),
  'text',
  'album release dates preserve Spotify precision as text'
);

select is(
  enum_range(null::public.album_release_type)::text,
  '{album,ep}',
  'album release types are album and ep'
);

select throws_ok(
  $$insert into public.albums (title, artist_name, release_date)
    values ('Invalid date', 'Schema test', '1981-13')$$,
  '23514',
  null,
  'invalid partial release dates are rejected'
);

select ok(
  not has_function_privilege(
      'authenticated',
      'public.materialize_spotify_album(text,text,text,text,text,integer,public.album_release_type,text)',
      'EXECUTE'
    )
    and has_function_privilege(
      'service_role',
      'public.materialize_spotify_album(text,text,text,text,text,integer,public.album_release_type,text)',
      'EXECUTE'
    ),
  'only the service role can invoke catalog materialization'
);

insert into public.albums (
  id, spotify_id, title, artist_name, release_date, track_count
) values (
  '50000000-0000-0000-0000-000000000001',
  'legacy-catalog-id',
  'Legacy Match',
  'Catalog Artist',
  '1981-01-01',
  4
);

insert into public.ratings (
  id, user_id, album_id, value, created_at, updated_at
) values (
  '52000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000001',
  4.5,
  '2026-08-09 22:00:00+00',
  '2026-08-09 22:00:00+00'
);

create temporary table legacy_materialization_result on commit drop as
select *
from public.materialize_spotify_album(
  '1234567890123456789012',
  'legacy match',
  'catalog artist',
  'https://i.scdn.co/image/legacy',
  '1981',
  5,
  'ep',
  'https://open.spotify.com/album/1234567890123456789012'
);

select is(
  (select album_id from legacy_materialization_result),
  '50000000-0000-0000-0000-000000000001'::uuid,
  'materialization reconciles the one exact legacy album'
);

select is(
  (select count(*) from public.ratings where album_id = '50000000-0000-0000-0000-000000000001'),
  1::bigint,
  'legacy reconciliation preserves ratings'
);

select is(
  (select release_date || ':' || release_type::text
    from public.albums where id = '50000000-0000-0000-0000-000000000001'),
  '1981:ep',
  'materialization preserves a partial date and inferred EP type'
);

create temporary table new_materialization_result on commit drop as
select *
from public.materialize_spotify_album(
  'abcdefghijklmnopqrstuv',
  'New Catalog Album',
  'Catalog Artist',
  null,
  '2026-08',
  10,
  'album',
  'https://open.spotify.com/album/abcdefghijklmnopqrstuv'
);

select is(
  (select outcome from new_materialization_result),
  'created',
  'materialization creates a missing canonical album'
);

create temporary table repeated_materialization_result on commit drop as
select *
from public.materialize_spotify_album(
  'abcdefghijklmnopqrstuv',
  'New Catalog Album',
  'Catalog Artist',
  null,
  '2026-08',
  10,
  'album',
  'https://open.spotify.com/album/abcdefghijklmnopqrstuv'
);

select is(
  (select result.outcome || ':' || count(album.id)::text
    from repeated_materialization_result result
    join public.albums album on album.spotify_id = 'abcdefghijklmnopqrstuv'
    group by result.outcome),
  'existing:1',
  'repeat materialization returns the single existing album'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select is(
  (select count(*) from public.ratings where user_id = '00000000-0000-0000-0000-000000000002'),
  5::bigint,
  'public profile ratings are visible'
);

select is(
  (select count(*) from public.ratings where user_id = '00000000-0000-0000-0000-000000000004'),
  4::bigint,
  'private profile ratings are visible to a mutual follow'
);

select is(
  (select count(*) from public.activity_events where actor_id = '00000000-0000-0000-0000-000000000004'),
  5::bigint,
  'activity visibility inherits private profile access'
);

insert into public.ratings (
  id, user_id, album_id, value, created_at, updated_at
) values (
  '52000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000001',
  4.0,
  '2026-08-10 00:00:00+00',
  '2026-08-10 00:00:00+00'
);

select is(
  (select listen_number from public.rating_listen_numbers
    where rating_id = '52000000-0000-0000-0000-000000000002'),
  2::bigint,
  'repeat ratings expose their listen number'
);

select is(
  (select rating_listen_number from public.get_home_feed(50)
    where album_id = '50000000-0000-0000-0000-000000000001'
      and rating_value = 4.0),
  2::bigint,
  'home feed exposes rating listen numbers'
);

delete from public.ratings
where id = '52000000-0000-0000-0000-000000000001';

select is(
  (select listen_number from public.rating_listen_numbers
    where rating_id = '52000000-0000-0000-0000-000000000002'),
  1::bigint,
  'listen numbers renumber after an earlier rating is deleted'
);

select lives_ok(
  $$insert into public.ratings (user_id, album_id, value)
    values (
      '00000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000012',
      3.5
    )$$,
  'owners can create their ratings'
);

select is(
  (select count(*) from public.ratings
    where user_id = '00000000-0000-0000-0000-000000000001'
      and album_id = '10000000-0000-0000-0000-000000000002'),
  2::bigint,
  'rating history keeps more than one rating per user and album'
);

select is(
  (select global_count from public.get_album_rating_summary('10000000-0000-0000-0000-000000000002')),
  3::bigint,
  'album aggregates count each user once'
);

select is(
  (select global_average from public.get_album_rating_summary('10000000-0000-0000-0000-000000000002')),
  3.2::numeric,
  'album aggregates use each user latest rating'
);

delete from public.ratings where id = '20000000-0000-0000-0000-000000000001';

select is(
  (select value from public.ratings
    where user_id = '00000000-0000-0000-0000-000000000001'
      and album_id = '10000000-0000-0000-0000-000000000002'
    order by created_at desc, id desc
    limit 1),
  2.5::numeric,
  'deleting the latest rating reveals the previous rating'
);

select throws_ok(
  $$insert into public.ratings (user_id, album_id, value)
    values (
      '00000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000000012',
      3.5
    )$$,
  '42501',
  null,
  'users cannot create another profile rating'
);

select throws_ok(
  $$insert into public.albums (title, artist_name) values ('Client album', 'Not allowed')$$,
  '42501',
  null,
  'album writes are not available to clients'
);

select is(
  (select global_count from public.get_album_rating_summary('10000000-0000-0000-0000-000000000001')),
  3::bigint,
  'global rating excludes private profiles'
);

select is(
  (select global_average from public.get_album_rating_summary('10000000-0000-0000-0000-000000000001')),
  4.3::numeric,
  'global rating average uses public profiles only'
);

select is(
  (select friend_count from public.get_album_rating_summary('10000000-0000-0000-0000-000000000001')),
  2::bigint,
  'friend rating includes mutual follows only'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000006","role":"authenticated"}',
  true
);

select is(
  (select count(*) from public.ratings where user_id = '00000000-0000-0000-0000-000000000004'),
  0::bigint,
  'private ratings are denied to non-mutual users'
);

select is(
  (select count(*) from public.profiles where username = 'test_maya'),
  1::bigint,
  'private basic identity remains discoverable'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

insert into public.listen_later_items (id, user_id, album_id, created_at)
values (
  '39000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000007',
  now()
);

select is(
  (select count(*) from public.activity_events
    where actor_id = '00000000-0000-0000-0000-000000000001'
      and album_id = '10000000-0000-0000-0000-000000000007'
      and activity_type = 'listen_later_added'),
  0::bigint,
  'a fresh save activity is hidden during the publication delay'
);

select is(
  (select count(*) from public.get_home_feed(50)
    where actor_id = '00000000-0000-0000-0000-000000000001'
      and album_id = '10000000-0000-0000-0000-000000000007'
      and activity_type = 'listen_later_added'),
  0::bigint,
  'the home feed omits a save during the publication delay'
);

delete from public.listen_later_items
where id = '39000000-0000-0000-0000-000000000001';

set local role postgres;

select is(
  (select count(*) from public.activity_events
    where actor_id = '00000000-0000-0000-0000-000000000001'
      and album_id = '10000000-0000-0000-0000-000000000007'
      and activity_type = 'listen_later_added'),
  0::bigint,
  'unsaving during the delay deletes the pending activity event'
);

select throws_ok(
  $$insert into public.activity_events (activity_type, actor_id, album_id)
    values (
      'listen_later_added',
      '00000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000007'
    )$$,
  '23514',
  null,
  'listen later activity cannot exist without a saved item'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

insert into public.listen_later_items (id, user_id, album_id, created_at)
values (
  '39000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000007',
  now() - interval '6 seconds'
);

select is(
  (select count(*) from public.activity_events
    where actor_id = '00000000-0000-0000-0000-000000000001'
      and album_id = '10000000-0000-0000-0000-000000000007'
      and activity_type = 'listen_later_added'),
  1::bigint,
  'a save activity becomes visible after five seconds'
);

select is(
  (select count(*) from public.get_home_feed(50)
    where actor_id = '00000000-0000-0000-0000-000000000001'
      and album_id = '10000000-0000-0000-0000-000000000007'
      and activity_type = 'listen_later_added'),
  1::bigint,
  'the home feed publishes a save after five seconds'
);

select is(
  (select listen_later_item_id from public.activity_events
    where actor_id = '00000000-0000-0000-0000-000000000001'
      and album_id = '10000000-0000-0000-0000-000000000007'
      and activity_type = 'listen_later_added'),
  '39000000-0000-0000-0000-000000000002'::uuid,
  'a published save activity is linked to its saved item'
);

insert into public.likes (user_id, activity_event_id, created_at)
select '00000000-0000-0000-0000-000000000001', id, '2099-01-01 00:00:00+00'
from public.activity_events
where listen_later_item_id = '39000000-0000-0000-0000-000000000002';

insert into public.comments (id, user_id, activity_event_id, body)
select
  '49000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  id,
  'This activity should be removed with the save.'
from public.activity_events
where listen_later_item_id = '39000000-0000-0000-0000-000000000002';

delete from public.listen_later_items
where id = '39000000-0000-0000-0000-000000000002';

select is(
  (select count(*) from public.activity_events
    where actor_id = '00000000-0000-0000-0000-000000000001'
      and album_id = '10000000-0000-0000-0000-000000000007'
      and activity_type = 'listen_later_added'),
  0::bigint,
  'unsaving deletes an already-published activity event'
);

set local role postgres;

select is(
  (select count(*) from public.likes where created_at = '2099-01-01 00:00:00+00')
    + (select count(*) from public.comments where id = '49000000-0000-0000-0000-000000000001'),
  0::bigint,
  'unsaving cascades deletion to activity engagement'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

insert into public.listen_later_items (id, user_id, album_id, created_at)
values (
  '39000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000007',
  now() - interval '6 seconds'
);

select is(
  (select count(*) from public.activity_events
    where actor_id = '00000000-0000-0000-0000-000000000001'
      and album_id = '10000000-0000-0000-0000-000000000007'
      and activity_type = 'listen_later_added'),
  1::bigint,
  're-saving creates a new activity event'
);

select is(
  (select listen_later_item_id from public.activity_events
    where actor_id = '00000000-0000-0000-0000-000000000001'
      and album_id = '10000000-0000-0000-0000-000000000007'
      and activity_type = 'listen_later_added'),
  '39000000-0000-0000-0000-000000000003'::uuid,
  'the re-save activity belongs to the new saved item'
);

select ok(
  (select event.created_at = saved.created_at
    from public.activity_events event
    join public.listen_later_items saved on saved.id = event.listen_later_item_id
    where saved.id = '39000000-0000-0000-0000-000000000003'),
  'the re-save activity uses the new save timestamp'
);

insert into public.likes (user_id, activity_event_id, created_at)
select '00000000-0000-0000-0000-000000000001', id, '2099-01-02 00:00:00+00'
from public.activity_events
where listen_later_item_id = '39000000-0000-0000-0000-000000000003';

insert into public.comments (id, user_id, activity_event_id, body)
select
  '49000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  id,
  'Rating should remove this activity too.'
from public.activity_events
where listen_later_item_id = '39000000-0000-0000-0000-000000000003';

select throws_ok(
  $$insert into public.listen_later_items (user_id, album_id)
    values (
      '00000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000002'
    )$$,
  '23514',
  'Rated albums cannot be saved for later.',
  'rated albums cannot be added to Listen Later'
);

select lives_ok(
  $$insert into public.ratings (id, user_id, album_id, value)
    values (
      '59000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000007',
      4.0
    )$$,
  'rating an album currently in Listen Later succeeds'
);

select is(
  (select count(*) from public.activity_events
    where rating_id = '59000000-0000-0000-0000-000000000001'),
  1::bigint,
  'rating activity is visible immediately'
);

select is(
  (select count(*) from public.listen_later_items
    where user_id = '00000000-0000-0000-0000-000000000001'
      and album_id = '10000000-0000-0000-0000-000000000007'),
  0::bigint,
  'rating an album removes its active Listen Later item'
);

select is(
  (select count(*) from public.activity_events
    where actor_id = '00000000-0000-0000-0000-000000000001'
      and album_id = '10000000-0000-0000-0000-000000000007'
      and activity_type = 'listen_later_added'),
  0::bigint,
  'rating deletes the associated save activity'
);

set local role postgres;

select is(
  (select count(*) from public.likes where created_at = '2099-01-02 00:00:00+00')
    + (select count(*) from public.comments where id = '49000000-0000-0000-0000-000000000002'),
  0::bigint,
  'rating cascades deletion to save activity engagement'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

delete from public.ratings
where user_id = '00000000-0000-0000-0000-000000000001'
  and album_id = '10000000-0000-0000-0000-000000000007';

select lives_ok(
  $$insert into public.listen_later_items (id, user_id, album_id)
    values (
      '39000000-0000-0000-0000-000000000004',
      '00000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000007'
    )$$,
  'Listen Later becomes available after all ratings are deleted'
);

select is(
  (select count(*) from public.listen_later_items
    where user_id = '00000000-0000-0000-0000-000000000001'
      and album_id = '10000000-0000-0000-0000-000000000007'),
  1::bigint,
  'the album is active in Listen Later again'
);

select is(
  (select count(*) from public.activity_events
    where actor_id = '00000000-0000-0000-0000-000000000001'
      and album_id = '10000000-0000-0000-0000-000000000007'
      and activity_type = 'listen_later_added'),
  0::bigint,
  'a re-save after rating starts a fresh publication delay'
);

set local role postgres;

select is(
  (select count(*) from public.activity_events
    where listen_later_item_id = '39000000-0000-0000-0000-000000000004'),
  1::bigint,
  'the delayed re-save has its own pending activity event'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select lives_ok(
  $$insert into public.comments (id, user_id, activity_event_id, body)
    select
      '49000000-0000-0000-0000-000000000010',
      '00000000-0000-0000-0000-000000000001',
      event.id,
      'A root comment for reply tests.'
    from public.activity_events event
    where event.rating_id = '20000000-0000-0000-0000-000000000006'$$,
  'a user can create a root comment on visible activity'
);

select lives_ok(
  $$insert into public.comments (id, user_id, activity_event_id, parent_comment_id, body)
    select
      '49000000-0000-0000-0000-000000000011',
      '00000000-0000-0000-0000-000000000001',
      event.id,
      '49000000-0000-0000-0000-000000000010',
      'A valid one-level reply.'
    from public.activity_events event
    where event.rating_id = '20000000-0000-0000-0000-000000000006'$$,
  'a user can reply to a root comment on the same activity'
);

select throws_ok(
  $$insert into public.comments (user_id, activity_event_id, parent_comment_id, body)
    select
      '00000000-0000-0000-0000-000000000001',
      event.id,
      '49000000-0000-0000-0000-000000000011',
      'Nested replies are not allowed.'
    from public.activity_events event
    where event.rating_id = '20000000-0000-0000-0000-000000000006'$$,
  '23514',
  'Replies must belong to a root comment.',
  'a reply cannot use another reply as its parent'
);

select throws_ok(
  $$insert into public.comments (user_id, activity_event_id, parent_comment_id, body)
    select
      '00000000-0000-0000-0000-000000000001',
      event.id,
      '49000000-0000-0000-0000-000000000010',
      'Cross-activity replies are not allowed.'
    from public.activity_events event
    where event.rating_id = '20000000-0000-0000-0000-000000000007'$$,
  '23514',
  'Replies must belong to the same activity as their root comment.',
  'a reply cannot move its root thread to another activity'
);

select lives_ok(
  $$insert into public.comment_likes (user_id, comment_id)
    values (
      '00000000-0000-0000-0000-000000000001',
      '49000000-0000-0000-0000-000000000011'
    )$$,
  'a user can like a visible reply'
);

select is(
  (select count(*) from public.comment_likes
    where user_id = '00000000-0000-0000-0000-000000000001'
      and comment_id = '49000000-0000-0000-0000-000000000011'),
  1::bigint,
  'a comment like is readable on a visible reply'
);

select throws_ok(
  $$insert into public.comment_likes (user_id, comment_id)
    values (
      '00000000-0000-0000-0000-000000000002',
      '49000000-0000-0000-0000-000000000010'
    )$$,
  '42501',
  null,
  'a user cannot create a comment like for another user'
);

select is(
  (select comments_count
    from public.get_home_feed(50)
    where id = (
      select event.id
      from public.activity_events event
      where event.rating_id = '20000000-0000-0000-0000-000000000006'
    )),
  3::bigint,
  'home feed comment counts include roots but exclude replies'
);

select is(
  (select count(*) from public.comments
    where parent_comment_id = '49000000-0000-0000-0000-000000000010'),
  1::bigint,
  'a root comment owns its direct replies'
);

select lives_ok(
  $$delete from public.comments
    where id = '49000000-0000-0000-0000-000000000010'$$,
  'an author can delete their root comment'
);

select is(
  (select count(*) from public.comments
    where id in (
      '49000000-0000-0000-0000-000000000010',
      '49000000-0000-0000-0000-000000000011'
    ))
    + (select count(*) from public.comment_likes
      where comment_id = '49000000-0000-0000-0000-000000000011'),
  0::bigint,
  'deleting a root cascades to replies and their likes'
);

select * from finish();
rollback;
