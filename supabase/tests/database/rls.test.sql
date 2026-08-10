begin;

-- Linked tests authenticate as cli_login_postgres, which is a non-inheriting
-- member of postgres. Assume that role only inside this transaction so the
-- suite can create and restore Auth fixtures without broadening app grants.
set local role postgres;
set local search_path = public, extensions, auth, storage;

create extension if not exists pgtap with schema extensions;

-- Rebuild the tracked mock fixtures inside this transaction. Existing staging
-- rows are restored by the final rollback, so tests do not depend on mutable
-- shared staging state and leave no changes behind.
delete from auth.users
where id between '00000000-0000-0000-0000-000000000001'::uuid
  and '00000000-0000-0000-0000-000000000006'::uuid;

delete from public.albums
where id between '10000000-0000-0000-0000-000000000001'::uuid
  and '10000000-0000-0000-0000-000000000012'::uuid;

\ir fixtures.inc

select plan(43);

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
  (select count(*) from public.profiles where username = 'maya'),
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
  '2026-08-05 12:00:00+00'
);

select is(
  (select count(*) from public.activity_events
    where actor_id = '00000000-0000-0000-0000-000000000001'
      and album_id = '10000000-0000-0000-0000-000000000007'
      and activity_type = 'listen_later_added'),
  1::bigint,
  'the first save creates one activity event'
);

select is(
  (select created_at from public.activity_events
    where actor_id = '00000000-0000-0000-0000-000000000001'
      and album_id = '10000000-0000-0000-0000-000000000007'
      and activity_type = 'listen_later_added'),
  '2026-08-05 12:00:00+00'::timestamptz,
  'save activity records the first-save timestamp'
);

insert into public.likes (user_id, activity_event_id)
select '00000000-0000-0000-0000-000000000001', id
from public.activity_events
where actor_id = '00000000-0000-0000-0000-000000000001'
  and album_id = '10000000-0000-0000-0000-000000000007'
  and activity_type = 'listen_later_added';

insert into public.comments (id, user_id, activity_event_id, body)
select
  '49000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  id,
  'Keeping this activity around.'
from public.activity_events
where actor_id = '00000000-0000-0000-0000-000000000001'
  and album_id = '10000000-0000-0000-0000-000000000007'
  and activity_type = 'listen_later_added';

delete from public.listen_later_items
where id = '39000000-0000-0000-0000-000000000001';

select is(
  (select count(*) from public.activity_events
    where actor_id = '00000000-0000-0000-0000-000000000001'
      and album_id = '10000000-0000-0000-0000-000000000007'
      and activity_type = 'listen_later_added'
      and listen_later_item_id is null),
  1::bigint,
  'unsaving preserves the activity and clears its active item link'
);

select is(
  (select count(*) from public.likes like_row
    join public.activity_events event on event.id = like_row.activity_event_id
    where event.actor_id = '00000000-0000-0000-0000-000000000001'
      and event.album_id = '10000000-0000-0000-0000-000000000007'),
  1::bigint,
  'unsaving preserves activity likes'
);

select is(
  (select count(*) from public.comments comment_row
    join public.activity_events event on event.id = comment_row.activity_event_id
    where event.actor_id = '00000000-0000-0000-0000-000000000001'
      and event.album_id = '10000000-0000-0000-0000-000000000007'),
  1::bigint,
  'unsaving preserves activity comments'
);

insert into public.listen_later_items (id, user_id, album_id, created_at)
values (
  '39000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000007',
  '2026-08-06 12:00:00+00'
);

select is(
  (select count(*) from public.activity_events
    where actor_id = '00000000-0000-0000-0000-000000000001'
      and album_id = '10000000-0000-0000-0000-000000000007'
      and activity_type = 'listen_later_added'),
  1::bigint,
  're-saving does not create a second activity event'
);

select is(
  (select created_at from public.activity_events
    where actor_id = '00000000-0000-0000-0000-000000000001'
      and album_id = '10000000-0000-0000-0000-000000000007'
      and activity_type = 'listen_later_added'),
  '2026-08-05 12:00:00+00'::timestamptz,
  're-saving preserves the first-save activity timestamp'
);

select is(
  (select listen_later_item_id from public.activity_events
    where actor_id = '00000000-0000-0000-0000-000000000001'
      and album_id = '10000000-0000-0000-0000-000000000007'
      and activity_type = 'listen_later_added'),
  '39000000-0000-0000-0000-000000000002'::uuid,
  're-saving reconnects the original event to the active item'
);

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
  $$insert into public.ratings (user_id, album_id, value)
    values (
      '00000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000007',
      4.0
    )$$,
  'rating an album currently in Listen Later succeeds'
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
      and activity_type = 'listen_later_added'
      and listen_later_item_id is null),
  1::bigint,
  'rating preserves the historical first-save activity'
);

delete from public.ratings
where user_id = '00000000-0000-0000-0000-000000000001'
  and album_id = '10000000-0000-0000-0000-000000000007';

select lives_ok(
  $$insert into public.listen_later_items (id, user_id, album_id)
    values (
      '39000000-0000-0000-0000-000000000003',
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

select * from finish();
rollback;
